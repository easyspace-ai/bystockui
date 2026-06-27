package hotmoney

import (
	"os"
	"path/filepath"
	"testing"
)

func TestFindUZICollectScript(t *testing.T) {
	root := filepath.Join("..", "..", "..", "UZI-Skill")
	if st, err := os.Stat(root); err != nil || !st.IsDir() {
		t.Skip("UZI-Skill not present in workspace")
	}
	abs, _ := filepath.Abs(root)
	script := findUZICollectScript(abs)
	if script == "" {
		t.Fatal("expected collect_context.py under UZI-Skill")
	}
	if _, err := os.Stat(script); err != nil {
		t.Fatalf("script not found: %s", script)
	}
}

func TestFindUZIRunPy(t *testing.T) {
	root := filepath.Join("..", "..", "..", "UZI-Skill")
	if st, err := os.Stat(root); err != nil || !st.IsDir() {
		t.Skip("UZI-Skill not present in workspace")
	}
	abs, _ := filepath.Abs(root)
	runPy := findUZIRunPy(abs)
	if runPy == "" {
		t.Fatal("expected run.py under UZI-Skill")
	}
}

func TestResolveUZIDir(t *testing.T) {
	root := filepath.Join("..", "..", "..", "UZI-Skill")
	if st, err := os.Stat(root); err != nil || !st.IsDir() {
		t.Skip("UZI-Skill not present in workspace")
	}
	t.Setenv("HOTMONEY_UZI_DIR", "")
	dir := ResolveUZIDir()
	if dir == "" {
		t.Fatal("expected auto-detected UZI-Skill dir")
	}
	if findUZIRunPy(dir) == "" {
		t.Fatalf("run.py not found under %s", dir)
	}
}

func TestResolveUZIDirFromEnv(t *testing.T) {
	root := filepath.Join("..", "..", "..", "UZI-Skill")
	if st, err := os.Stat(root); err != nil || !st.IsDir() {
		t.Skip("UZI-Skill not present in workspace")
	}
	abs, err := filepath.Abs(root)
	if err != nil {
		t.Fatal(err)
	}
	t.Setenv("HOTMONEY_UZI_DIR", abs)
	if dir := ResolveUZIDir(); dir != abs {
		t.Fatalf("expected %s, got %s", abs, dir)
	}
}

func TestDefaultReportMode(t *testing.T) {
	t.Setenv("HOTMONEY_REPORT_MODE", "")
	if DefaultReportMode() != "uzi" {
		t.Fatalf("expected uzi default, got %s", DefaultReportMode())
	}
	t.Setenv("HOTMONEY_REPORT_MODE", "llm")
	if DefaultReportMode() != "llm" {
		t.Fatalf("expected llm, got %s", DefaultReportMode())
	}
}
