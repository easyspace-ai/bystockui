package hotmoney

import (
	"context"
	"errors"
	"strings"
	"os"
	"path/filepath"
	"testing"
)

func TestIsUZIPythonSyntaxError(t *testing.T) {
	raw := "SyntaxError: future feature annotations is not defined"
	if !isUZIPythonSyntaxError(raw) {
		t.Fatal("expected syntax error detection for annotations")
	}
}

func TestUserFacingUZIErrorPythonTooOld(t *testing.T) {
	raw := errors.New("uzi report: SyntaxError: future feature annotations is not defined")
	got := UserFacingUZIError(raw)
	if !strings.Contains(got, "Python 3.10+") {
		t.Fatalf("expected python version hint, got: %q", got)
	}
}

func TestUziPythonTooOldMessage(t *testing.T) {
	msg := uziPythonTooOldMessage("python3", "Python 3.9.18")
	if !strings.Contains(msg, "HOTMONEY_UZI_PYTHON") {
		t.Fatalf("expected env hint in %q", msg)
	}
	if !strings.Contains(msg, "Python 3.9.18") {
		t.Fatalf("expected version detail in %q", msg)
	}
}

func TestCheckUZIPythonLocalVenv(t *testing.T) {
	python := filepath.Join("..", "..", "..", "UZI-Skill", ".venv", "bin", "python")
	abs, err := filepath.Abs(python)
	if err != nil {
		t.Fatalf("abs: %v", err)
	}
	if _, err := os.Stat(abs); err != nil {
		t.Skipf("local UZI venv missing: %v", err)
	}
	t.Setenv("HOTMONEY_UZI_PYTHON", abs)
	if err := CheckUZIPython(context.Background()); err != nil {
		t.Fatalf("CheckUZIPython: %v", err)
	}
}

