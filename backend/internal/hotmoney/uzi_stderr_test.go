package hotmoney

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func TestIsTqdmProgressLine(t *testing.T) {
	cases := []struct {
		line string
		want bool
	}{
		{"  0%|          | 0/58 [00:00<?, ?it/s]", true},
		{"  2%|▏         | 1/58 [00:01<01:06,  1.17s/it]", true},
		{"Traceback (most recent call last):", false},
		{"ModuleNotFoundError: No module named 'akshare'", false},
		{"", false},
	}
	for _, c := range cases {
		if got := IsTqdmProgressLine(c.line); got != c.want {
			t.Errorf("IsTqdmProgressLine(%q) = %v, want %v", c.line, got, c.want)
		}
	}
}

func TestUZIStderrToProgress(t *testing.T) {
	if msg := UZIStderrToProgress("  2%|▏         | 1/58 [00:01<01:06,  1.17s/it]"); msg != "UZI 进度 1/58" {
		t.Fatalf("unexpected progress: %q", msg)
	}
	if msg := UZIStderrToProgress("ModuleNotFoundError: akshare"); msg != "ModuleNotFoundError: akshare" {
		t.Fatalf("unexpected stderr line: %q", msg)
	}
}

func TestFormatCapturedStderrError(t *testing.T) {
	raw := "\r  0%|          | 0/58 [00:00<?, ?it/s]\r  2%|▏         | 1/58 [00:01<01:06,  1.17s/it]\nModuleNotFoundError: No module named 'akshare'"
	msg := FormatCapturedStderrError(errors.New("exit status 1"), raw)
	if strings.Contains(msg, "%|") {
		t.Fatalf("tqdm leaked into error: %q", msg)
	}
	if !strings.Contains(msg, "ModuleNotFoundError") {
		t.Fatalf("expected real error in message: %q", msg)
	}
}

func TestFormatCapturedStderrErrorTqdmOnly(t *testing.T) {
	raw := "\r  0%|          | 0/58 [00:00<?, ?it/s]\r  2%|▏         | 1/58 [00:01<01:06,  1.17s/it]"
	msg := FormatCapturedStderrError(errors.New("exit status 1"), raw)
	if strings.Contains(msg, "%|") {
		t.Fatalf("tqdm leaked into error: %q", msg)
	}
	if !strings.Contains(msg, "exit status 1") {
		t.Fatalf("expected wait error fallback: %q", msg)
	}
}

func TestFormatCapturedStderrErrorTimeout(t *testing.T) {
	msg := FormatCapturedStderrError(context.DeadlineExceeded, "")
	if !strings.Contains(msg, "超时") {
		t.Fatalf("expected timeout message: %q", msg)
	}
}

func TestNormalizeTqdmBuffer(t *testing.T) {
	raw := "\r  0%|          | 0/58 [00:00<?, ?it/s]\rreal error line\n"
	got := NormalizeTqdmBuffer(raw)
	if strings.Contains(got, "%|") {
		t.Fatalf("tqdm not stripped: %q", got)
	}
	if got != "real error line" {
		t.Fatalf("unexpected normalized buffer: %q", got)
	}
}

func TestStripTqdmFromError(t *testing.T) {
	raw := "uzi report: \r  0%|          | 0/58 [00:00<?, ?it/s]\r  2%|▏         | 1/58 [00:01<01:06,  1.17s/it]"
	got := StripTqdmFromError(raw)
	if strings.Contains(got, "%|") {
		t.Fatalf("tqdm not stripped: %q", got)
	}
}
