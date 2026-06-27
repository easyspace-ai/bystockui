package hotmoney

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os/exec"
	"regexp"
	"strings"
	"sync"
	"syscall"
)

var tqdmCountRE = regexp.MustCompile(`\|\s*(\d+/\d+)\s*\[`)

// IsTqdmProgressLine reports whether a stderr line is tqdm/rich progress bar output.
func IsTqdmProgressLine(line string) bool {
	line = strings.TrimSpace(line)
	if line == "" {
		return false
	}
	if strings.Contains(line, "%|") && (strings.Contains(line, "it/s") || strings.Contains(line, "/")) {
		return true
	}
	return false
}

// UZIStderrToProgress maps stderr lines (incl. tqdm) to user-facing progress text.
func UZIStderrToProgress(line string) string {
	line = strings.TrimSpace(line)
	if line == "" {
		return ""
	}
	if IsTqdmProgressLine(line) {
		if m := tqdmCountRE.FindStringSubmatch(line); len(m) >= 2 {
			return "UZI 进度 " + m[1]
		}
		if i := strings.Index(line, "%"); i > 0 {
			pct := strings.TrimSpace(line[:i+1])
			if pct != "" {
				return "UZI 进度 " + pct
			}
		}
		return "UZI 运行中…"
	}
	if len(line) > 120 {
		line = line[:120] + "…"
	}
	return line
}

// formatUZIProcessError builds a user-facing message from subprocess failure.
// ctx is the CommandContext passed to exec; when it times out Go sends SIGKILL and Wait()
// returns "signal: killed" rather than context.DeadlineExceeded.
func formatUZIProcessError(ctx context.Context, waitErr error, stderrLines []string) string {
	if waitErr == nil {
		return "unknown error"
	}
	if ctx != nil {
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return uziTimeoutMessage()
		}
		if errors.Is(ctx.Err(), context.Canceled) {
			return "已取消"
		}
	}
	if errors.Is(waitErr, context.DeadlineExceeded) {
		return uziTimeoutMessage()
	}
	if errors.Is(waitErr, context.Canceled) {
		return "已取消"
	}

	meaningful := meaningfulStderrLines(stderrLines)
	if len(meaningful) > 0 {
		return tailLines(meaningful, 8)
	}
	if isProcessSignalKilled(waitErr) {
		return uziSignalKilledMessage()
	}
	return waitErr.Error()
}

func uziTimeoutMessage() string {
	return fmt.Sprintf(
		"超时（当前 HOTMONEY_UZI_TIMEOUT=%s，可在 backend/.env 延长；lite 模式通常 5–15 分钟）",
		UZIReportTimeout(),
	)
}

func uziSignalKilledMessage() string {
	return "进程被系统强制终止（常见于 VPS 内存不足 OOM，或代理/网关超时后服务端杀进程）。" +
		"请执行 free -h 与 dmesg | grep -i oom 排查；生产环境务必 HOTMONEY_UZI_DEPTH=lite，建议 RAM ≥ 2GB；" +
		"若走 Nginx 反代，proxy_read_timeout 需 ≥ HOTMONEY_UZI_TIMEOUT"
}

func isProcessSignalKilled(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(strings.TrimSpace(err.Error()))
	if strings.Contains(msg, "signal: killed") || strings.Contains(msg, "signal killed") {
		return true
	}
	var exitErr *exec.ExitError
	if errors.As(err, &exitErr) {
		if ws, ok := exitErr.Sys().(syscall.WaitStatus); ok && ws.Signaled() && ws.Signal() == syscall.SIGKILL {
			return true
		}
	}
	return false
}

func meaningfulStderrLines(stderrLines []string) []string {
	meaningful := make([]string, 0, len(stderrLines))
	for _, line := range stderrLines {
		for _, part := range strings.FieldsFunc(line, func(r rune) bool { return r == '\r' || r == '\n' }) {
			part = strings.TrimSpace(part)
			if part == "" || IsTqdmProgressLine(part) {
				continue
			}
			meaningful = append(meaningful, part)
		}
	}
	return meaningful
}

func tailLines(lines []string, max int) string {
	if max <= 0 {
		max = 8
	}
	tail := lines
	if len(tail) > max {
		tail = tail[len(tail)-max:]
	}
	return strings.Join(tail, "\n")
}

// UserFacingUZIError strips noise and returns a concise message for SSE clients.
func UserFacingUZIError(err error) string {
	if err == nil {
		return "未知错误"
	}
	msg := strings.TrimSpace(err.Error())
	msg = strings.TrimPrefix(msg, "uzi report:")
	msg = strings.TrimSpace(msg)
	msg = StripTqdmFromError(msg)
	if isProcessSignalKilled(errors.New(msg)) || msg == uziSignalKilledMessage() {
		return uziSignalKilledMessage()
	}
	if strings.Contains(msg, "超时（当前 HOTMONEY_UZI_TIMEOUT") {
		return msg
	}
	if isUZIPythonSyntaxError(msg) {
		return uziPythonTooOldMessage(uziPython(), uziPythonVersionLine(context.Background(), uziPython()))
	}
	if msg == "" || msg == "UZI 报告生成失败" {
		return "UZI 报告生成失败（详见服务端日志）"
	}
	const maxLen = 500
	if len(msg) > maxLen {
		msg = msg[len(msg)-maxLen:]
		if i := strings.Index(msg, "\n"); i >= 0 && i < 80 {
			msg = msg[i+1:]
		}
	}
	return msg
}

// UZIErrorDetail returns the full error for dev logging / debug responses.
func UZIErrorDetail(err error) string {
	if err == nil {
		return ""
	}
	return StripTqdmFromError(err.Error())
}

func splitOnCRLF(data []byte, atEOF bool) (advance int, token []byte, err error) {
	for i, b := range data {
		if b == '\r' || b == '\n' {
			return i + 1, data[:i], nil
		}
	}
	if atEOF && len(data) > 0 {
		return len(data), data, nil
	}
	return 0, nil, nil
}

type uziStderrTracker struct {
	mu    sync.Mutex
	lines []string
}

func (t *uziStderrTracker) append(line string) {
	for _, part := range strings.FieldsFunc(line, func(r rune) bool { return r == '\r' || r == '\n' }) {
		part = strings.TrimSpace(part)
		if part == "" || IsTqdmProgressLine(part) {
			continue
		}
		t.mu.Lock()
		t.lines = append(t.lines, part)
		if len(t.lines) > 40 {
			t.lines = t.lines[len(t.lines)-40:]
		}
		t.mu.Unlock()
	}
}

func (t *uziStderrTracker) snapshot() []string {
	t.mu.Lock()
	defer t.mu.Unlock()
	out := make([]string, len(t.lines))
	copy(out, t.lines)
	return out
}

func drainUZIStderr(r io.Reader, onLine func(string), tracker *uziStderrTracker) {
	scan := bufio.NewScanner(r)
	scan.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	scan.Split(splitOnCRLF)
	for scan.Scan() {
		line := strings.TrimSpace(scan.Text())
		if line == "" {
			continue
		}
		if tracker != nil {
			tracker.append(line)
		}
		if onLine != nil {
			onLine(line)
		}
	}
}

func streamSubprocessIO(stdout, stderr io.Reader, onStdout, onStderr func(string), stderrTracker *uziStderrTracker, stdoutTracker *uziStdoutTracker) {
	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		drainUZIStdout(stdout, onStdout, stdoutTracker)
	}()
	go func() {
		defer wg.Done()
		drainUZIStderr(stderr, onStderr, stderrTracker)
	}()
	wg.Wait()
}

func drainUZIStdout(r io.Reader, onLine func(string), tracker *uziStdoutTracker) {
	scan := bufio.NewScanner(r)
	scan.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for scan.Scan() {
		line := strings.TrimSpace(scan.Text())
		if line == "" {
			continue
		}
		if tracker != nil {
			tracker.append(line)
		}
		if onLine != nil {
			onLine(line)
		}
	}
}

// NormalizeTqdmBuffer collapses carriage-return progress spam for tests/diagnostics.
func NormalizeTqdmBuffer(raw string) string {
	var b strings.Builder
	for _, part := range strings.FieldsFunc(raw, func(r rune) bool { return r == '\r' || r == '\n' }) {
		part = strings.TrimSpace(part)
		if part == "" || IsTqdmProgressLine(part) {
			continue
		}
		if b.Len() > 0 {
			b.WriteByte('\n')
		}
		b.WriteString(part)
	}
	return b.String()
}

// FormatCapturedStderrError is a test helper mirroring failure-path error formatting.
func FormatCapturedStderrError(ctx context.Context, waitErr error, stderrRaw string) string {
	var lines []string
	for _, part := range strings.FieldsFunc(stderrRaw, func(r rune) bool { return r == '\r' || r == '\n' }) {
		part = strings.TrimSpace(part)
		if part != "" {
			lines = append(lines, part)
		}
	}
	msg := formatUZIProcessError(ctx, waitErr, lines)
	return fmt.Sprintf("uzi report: %s", msg)
}

// StripTqdmFromError removes embedded tqdm progress from an already formatted error string.
func StripTqdmFromError(msg string) string {
	if !strings.Contains(msg, "%|") {
		return msg
	}
	parts := strings.FieldsFunc(msg, func(r rune) bool { return r == '\r' || r == '\n' })
	var kept []string
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" || IsTqdmProgressLine(p) {
			continue
		}
		kept = append(kept, p)
	}
	if len(kept) == 0 {
		return "UZI 报告生成失败"
	}
	return strings.Join(kept, "\n")
}

// HasTqdmProgress reports whether raw stderr contains tqdm bar output.
func HasTqdmProgress(raw string) bool {
	return bytes.Contains([]byte(raw), []byte("%|"))
}
