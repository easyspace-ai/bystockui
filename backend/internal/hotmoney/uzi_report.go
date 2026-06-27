package hotmoney

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
)

// UZIReportResult holds the generated standalone HTML report and optional metadata.
type UZIReportResult struct {
	HTML     string
	MetaPath string
	OutDir   string
}

// TryUZIReport runs UZI-Skill run.py to produce a full HTML report (66-persona pipeline).
// Uses --no-browser --output-dir for headless SaaS integration.
// onStdout receives log lines; onStderr receives stderr (tqdm progress is filtered from fatal errors).
func TryUZIReport(ctx context.Context, uziDir, tsCode string, onStdout, onStderr func(string)) (*UZIReportResult, error) {
	uziDir = strings.TrimSpace(uziDir)
	tsCode = strings.TrimSpace(tsCode)
	if uziDir == "" || tsCode == "" {
		return nil, fmt.Errorf("uzi report: uzi dir and ts code required")
	}

	runPy := findUZIRunPy(uziDir)
	if runPy == "" {
		return nil, fmt.Errorf("uzi report: run.py not found under %s", uziDir)
	}

	if err := CheckUZIPython(ctx); err != nil {
		return nil, fmt.Errorf("uzi report: %s", err.Error())
	}

	outDir, err := os.MkdirTemp("", "hotmoney-uzi-*")
	if err != nil {
		return nil, fmt.Errorf("uzi report: temp dir: %w", err)
	}

	depth := strings.TrimSpace(os.Getenv("HOTMONEY_UZI_DEPTH"))
	if depth == "" {
		depth = "lite"
	}

	args := []string{
		tsCode,
		"--no-browser",
		"--depth", depth,
		"--output-dir", outDir,
	}
	if os.Getenv("HOTMONEY_UZI_NO_RESUME") == "1" {
		args = append(args, "--no-resume")
	}

	cmd := exec.CommandContext(ctx, uziPython(), append([]string{runPy}, args...)...)
	cmd.Dir = filepath.Dir(runPy)
	cmd.Env = append(os.Environ(),
		"UZI_CLI_ONLY=1",
		"PYTHONUNBUFFERED=1",
		"PYTHONIOENCODING=utf-8",
		"TQDM_DISABLE=1",
		"NO_COLOR=1",
	)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		_ = os.RemoveAll(outDir)
		return nil, fmt.Errorf("uzi report: stdout pipe: %w", err)
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		_ = os.RemoveAll(outDir)
		return nil, fmt.Errorf("uzi report: stderr pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		_ = os.RemoveAll(outDir)
		return nil, fmt.Errorf("uzi report: start: %w", err)
	}

	stderrTracker := &uziStderrTracker{}
	stdoutTracker := &uziStdoutTracker{}
	streamSubprocessIO(stdout, stderr, onStdout, onStderr, stderrTracker, stdoutTracker)

	waitErr := cmd.Wait()
	if result, readErr := loadUZIReportResult(outDir, uziDir, tsCode); readErr == nil {
		if waitErr != nil {
			log.Printf("hotmoney uzi: subprocess exited with %v but HTML report found (%d bytes)", waitErr, len(result.HTML))
		}
		return result, nil
	}

	if waitErr != nil {
		msg := formatUZIProcessError(waitErr, stderrTracker.snapshot())
		stderrTail := tailLines(meaningfulStderrLines(stderrTracker.snapshot()), 12)
		stdoutTail := tailLines(stdoutTracker.snapshot(), 12)
		log.Printf("hotmoney uzi report failed ts=%s dir=%s: %s", tsCode, uziDir, msg)
		if stderrTail != "" {
			log.Printf("hotmoney uzi stderr tail:\n%s", stderrTail)
		}
		if stdoutTail != "" {
			log.Printf("hotmoney uzi stdout tail:\n%s", stdoutTail)
		}
		_ = os.RemoveAll(outDir)
		return nil, fmt.Errorf("uzi report: %s", msg)
	}

	_ = os.RemoveAll(outDir)
	return nil, fmt.Errorf("uzi report: html output not found")
}

func loadUZIReportResult(outDir, uziDir, tsCode string) (*UZIReportResult, error) {
	htmlPath := findStandaloneHTML(outDir)
	if htmlPath == "" {
		htmlPath = findLatestUZIStandaloneHTML(uziDir, tsCode)
	}
	if htmlPath == "" {
		return nil, fmt.Errorf("html not found")
	}
	htmlBytes, err := os.ReadFile(htmlPath)
	if err != nil {
		return nil, err
	}
	html := strings.TrimSpace(string(htmlBytes))
	if html == "" {
		return nil, fmt.Errorf("empty html")
	}
	html = stripUZIBrandingFooter(html)
	metaPath := filepath.Join(outDir, "report.meta.json")
	if st, err := os.Stat(metaPath); err != nil || st.IsDir() {
		metaPath = filepath.Join(filepath.Dir(htmlPath), "report.meta.json")
	}
	return &UZIReportResult{
		HTML:     html,
		MetaPath: metaPath,
		OutDir:   outDir,
	}, nil
}

func findStandaloneHTML(dir string) string {
	dir = strings.TrimSpace(dir)
	if dir == "" {
		return ""
	}
	for _, name := range []string{"full-report-standalone.html", "index.html"} {
		path := filepath.Join(dir, name)
		if st, err := os.Stat(path); err == nil && !st.IsDir() && st.Size() > 0 {
			return path
		}
	}
	return ""
}

func uziReportsDirs(uziDir string) []string {
	return []string{
		filepath.Join(uziDir, "deep-analysis", "scripts", "reports"),
		filepath.Join(uziDir, "skills", "deep-analysis", "scripts", "reports"),
	}
}

func findLatestUZIStandaloneHTML(uziDir, tsCode string) string {
	tsCode = strings.TrimSpace(tsCode)
	if tsCode == "" {
		return ""
	}
	var matches []string
	for _, reportsDir := range uziReportsDirs(uziDir) {
		found, err := filepath.Glob(filepath.Join(reportsDir, tsCode+"_*", "full-report-standalone.html"))
		if err != nil {
			continue
		}
		matches = append(matches, found...)
	}
	if len(matches) == 0 {
		return ""
	}
	sort.Slice(matches, func(i, j int) bool {
		ii, _ := os.Stat(matches[i])
		jj, _ := os.Stat(matches[j])
		if ii == nil || jj == nil {
			return matches[i] > matches[j]
		}
		return ii.ModTime().After(jj.ModTime())
	})
	return matches[0]
}

type uziStdoutTracker struct {
	mu    sync.Mutex
	lines []string
}

func (t *uziStdoutTracker) append(line string) {
	line = strings.TrimSpace(line)
	if line == "" {
		return
	}
	t.mu.Lock()
	defer t.mu.Unlock()
	t.lines = append(t.lines, line)
	if len(t.lines) > 40 {
		t.lines = t.lines[len(t.lines)-40:]
	}
}

func (t *uziStdoutTracker) snapshot() []string {
	t.mu.Lock()
	defer t.mu.Unlock()
	out := make([]string, len(t.lines))
	copy(out, t.lines)
	return out
}

// UZIExposeDebugErrors reports whether full subprocess errors should be sent to clients.
func UZIExposeDebugErrors() bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv("HOTMONEY_UZI_DEBUG"))) {
	case "1", "true", "yes", "on":
		return true
	}
	if strings.EqualFold(strings.TrimSpace(os.Getenv("GIN_MODE")), "debug") {
		return true
	}
	return false
}

// UZIReportTimeout returns the subprocess timeout for full UZI reports.
func UZIReportTimeout() time.Duration {
	raw := strings.TrimSpace(os.Getenv("HOTMONEY_UZI_TIMEOUT"))
	if raw == "" {
		return 25 * time.Minute
	}
	if d, err := time.ParseDuration(raw); err == nil && d > 0 {
		return d
	}
	return 25 * time.Minute
}

// ParseUZIReportMeta reads report.meta.json when present.
func ParseUZIReportMeta(metaPath string) map[string]any {
	b, err := os.ReadFile(metaPath)
	if err != nil {
		return nil
	}
	var meta map[string]any
	if json.Unmarshal(b, &meta) != nil {
		return nil
	}
	return meta
}

// UZIStdoutToProgress maps run.py log lines to user-facing status text.
func UZIStdoutToProgress(line string) string {
	line = strings.TrimSpace(line)
	if line == "" {
		return ""
	}
	switch {
	case strings.Contains(line, "pipeline"):
		return "UZI pipeline 运行中…"
	case strings.Contains(line, "collect") || strings.Contains(line, "fetcher") || strings.Contains(line, "wave"):
		return "UZI 数据采集…"
	case strings.Contains(line, "score") || strings.Contains(line, "评委"):
		return "UZI 多视角评分…"
	case strings.Contains(line, "synthesize") || strings.Contains(line, "stage2"):
		return "UZI 合成报告…"
	case strings.Contains(line, "报告路径") || strings.Contains(line, "standalone"):
		return "UZI 报告组装完成…"
	case strings.Contains(line, "导出到"):
		return "UZI 报告导出完成"
	default:
		if len(line) > 120 {
			line = line[:120] + "…"
		}
		return line
	}
}

// StreamHTMLAsSSE splits large HTML into content chunks for the existing SSE client.
func StreamHTMLAsSSE(html string, chunkSize int, emit func(content string)) {
	if chunkSize <= 0 {
		chunkSize = 48 * 1024
	}
	prefix := "完整 UZI 报告已生成。\n\n```html\n"
	suffix := "\n```"
	emit(prefix)
	body := html
	for len(body) > 0 {
		n := chunkSize
		if n > len(body) {
			n = len(body)
		}
		emit(body[:n])
		body = body[n:]
	}
	emit(suffix)
}

var (
	uziGeneratedByRe = regexp.MustCompile(`(?is)\s*Generated by[\s\S]*?O\.o\s*</span>\s*<br>\s*`)
	uziGitHubLinkRe  = regexp.MustCompile(`(?is)\s*<a[^>]*github\.com/wbh604/UZI-Skill[^>]*>[\s\S]*?</a>\s*<br>\s*`)
	uziPoweredByRe   = regexp.MustCompile(`(?is)\s*<span[^>]*>\s*POWERED BY FloatFu-true\s*</span>\s*`)
)

// stripUZIBrandingFooter removes UZI-Skill upstream branding from standalone HTML footers.
func stripUZIBrandingFooter(html string) string {
	if strings.TrimSpace(html) == "" {
		return html
	}
	out := uziGeneratedByRe.ReplaceAllString(html, "<br>")
	out = uziGitHubLinkRe.ReplaceAllString(out, "")
	out = uziPoweredByRe.ReplaceAllString(out, "")
	return out
}

// DrainReader is a test helper for subprocess stdout.
func DrainReader(r io.Reader, onLine func(string)) {
	scan := bufio.NewScanner(r)
	scan.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for scan.Scan() {
		if onLine != nil {
			onLine(scan.Text())
		}
	}
}
