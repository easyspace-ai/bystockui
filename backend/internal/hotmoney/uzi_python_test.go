package hotmoney

import (
	"errors"
	"strings"
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
	msg := uziPythonTooOldMessage("python3")
	if !strings.Contains(msg, "HOTMONEY_UZI_PYTHON") {
		t.Fatalf("expected env hint in %q", msg)
	}
}
