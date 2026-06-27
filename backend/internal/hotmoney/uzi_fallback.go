package hotmoney

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// TryUZICollect runs the optional UZI-Skill Python collector when HOTMONEY_UZI_DIR is configured.
// Expected entry points (first match wins):
//   - $HOTMONEY_UZI_DIR/scripts/collect_context.py
//   - $HOTMONEY_UZI_DIR/deep-analysis/scripts/collect_context.py
//   - $HOTMONEY_UZI_DIR/skills/deep-analysis/scripts/collect_context.py
//   - $HOTMONEY_UZI_DIR/collect_context.py
//
// The script receives ts_code as argv[1] and should print plain-text market context on stdout.
func TryUZICollect(ctx context.Context, uziDir, tsCode string) (string, error) {
	uziDir = strings.TrimSpace(uziDir)
	tsCode = strings.TrimSpace(tsCode)
	if uziDir == "" || tsCode == "" {
		return "", nil
	}

	script := findUZICollectScript(uziDir)
	if script == "" {
		return "", fmt.Errorf("no collect_context.py under %s", uziDir)
	}

	cmd := exec.CommandContext(ctx, uziPython(), script, tsCode)
	cmd.Dir = filepath.Dir(script)
	cmd.Env = append(os.Environ(), "PYTHONUNBUFFERED=1", "PYTHONIOENCODING=utf-8")
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = err.Error()
		}
		return "", fmt.Errorf("uzi collect: %s", msg)
	}
	out := strings.TrimSpace(stdout.String())
	if out == "" {
		return "", fmt.Errorf("uzi collect: empty output")
	}
	return out, nil
}

func uziPython() string {
	python := strings.TrimSpace(os.Getenv("HOTMONEY_UZI_PYTHON"))
	if python == "" {
		python = "python3"
	}
	return python
}

// CheckUZIPython verifies the configured interpreter is Python 3.10+ (required by UZI-Skill).
func CheckUZIPython(ctx context.Context) error {
	python := uziPython()
	cmd := exec.CommandContext(ctx, python, "-c", "import sys; sys.exit(0 if sys.version_info[:2] >= (3, 10) else 1)")
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("%s", uziPythonTooOldMessage(python))
	}
	return nil
}

func uziPythonTooOldMessage(python string) string {
	return fmt.Sprintf(
		"UZI-Skill 需要 Python 3.10+，当前 %s 版本过低。请安装 Python 3.11，在 UZI 目录执行 python3.11 -m venv .venv && pip install -r requirements.txt，并在 backend/.env 设置 HOTMONEY_UZI_PYTHON 指向 .venv/bin/python",
		python,
	)
}

func isUZIPythonSyntaxError(msg string) bool {
	msg = strings.ToLower(msg)
	return strings.Contains(msg, "future feature annotations") ||
		strings.Contains(msg, "syntaxerror") && strings.Contains(msg, "annotations")
}

func findUZICollectScript(uziDir string) string {
	candidates := []string{
		filepath.Join(uziDir, "scripts", "collect_context.py"),
		filepath.Join(uziDir, "deep-analysis", "scripts", "collect_context.py"),
		filepath.Join(uziDir, "skills", "deep-analysis", "scripts", "collect_context.py"),
		filepath.Join(uziDir, "collect_context.py"),
	}
	for _, p := range candidates {
		if st, err := os.Stat(p); err == nil && !st.IsDir() {
			return p
		}
	}
	return ""
}

func findUZIRunPy(uziDir string) string {
	candidates := []string{
		filepath.Join(uziDir, "run.py"),
	}
	for _, p := range candidates {
		if st, err := os.Stat(p); err == nil && !st.IsDir() {
			return p
		}
	}
	return ""
}

// ResolveUZIDir returns configured or auto-detected UZI-Skill root (empty if not found).
// Search order: HOTMONEY_UZI_DIR → ../UZI-Skill from cwd → UZI-Skill under cwd → walk up from cwd and executable.
func ResolveUZIDir() string {
	if env := strings.TrimSpace(os.Getenv("HOTMONEY_UZI_DIR")); env != "" {
		if dir := validUZIDir(absPath(env)); dir != "" {
			return dir
		}
	}
	for _, candidate := range uziDirCandidates() {
		if dir := validUZIDir(candidate); dir != "" {
			return dir
		}
	}
	return ""
}

func validUZIDir(dir string) string {
	dir = strings.TrimSpace(dir)
	if dir == "" {
		return ""
	}
	if findUZIRunPy(dir) == "" {
		return ""
	}
	abs, err := filepath.Abs(dir)
	if err != nil {
		return filepath.Clean(dir)
	}
	return abs
}

func absPath(dir string) string {
	dir = strings.TrimSpace(dir)
	if dir == "" {
		return ""
	}
	if filepath.IsAbs(dir) {
		return filepath.Clean(dir)
	}
	if cwd, err := os.Getwd(); err == nil {
		return filepath.Clean(filepath.Join(cwd, dir))
	}
	return filepath.Clean(dir)
}

func uziDirCandidates() []string {
	var out []string
	seen := make(map[string]struct{})
	add := func(dir string) {
		dir = strings.TrimSpace(dir)
		if dir == "" {
			return
		}
		abs := absPath(dir)
		if _, ok := seen[abs]; ok {
			return
		}
		seen[abs] = struct{}{}
		out = append(out, abs)
	}

	add("../UZI-Skill")
	add("UZI-Skill")
	add("../UZI-SKILL")
	add("UZI-SKILL")

	if cwd, err := os.Getwd(); err == nil {
		for d := cwd; ; d = filepath.Dir(d) {
			add(filepath.Join(d, "UZI-Skill"))
			add(filepath.Join(d, "UZI-SKILL"))
			parent := filepath.Dir(d)
			if parent == d {
				break
			}
		}
	}

	if exe, err := os.Executable(); err == nil {
		for d := filepath.Dir(exe); ; d = filepath.Dir(d) {
			add(filepath.Join(d, "UZI-Skill"))
			add(filepath.Join(d, "UZI-SKILL"))
			parent := filepath.Dir(d)
			if parent == d {
				break
			}
		}
	}

	return out
}

// DefaultReportMode returns uzi or llm from HOTMONEY_REPORT_MODE (default uzi).
func DefaultReportMode() string {
	mode := strings.ToLower(strings.TrimSpace(os.Getenv("HOTMONEY_REPORT_MODE")))
	if mode == "llm" {
		return "llm"
	}
	return "uzi"
}
