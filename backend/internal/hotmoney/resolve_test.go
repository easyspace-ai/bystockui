package hotmoney

import "testing"

func TestResolveTSCode(t *testing.T) {
	tests := []struct {
		in   string
		want string
	}{
		{"分析 600519 贵州茅台", "600519.SH"},
		{"002217 今天能不能打板", "002217.SZ"},
		{"000001.SZ 平安银行", "000001.SZ"},
		{"帮我看看最近龙虎榜", ""},
		{"688001 科创板", "688001.SH"},
	}
	for _, tc := range tests {
		got := ResolveTSCode(tc.in)
		if got != tc.want {
			t.Errorf("ResolveTSCode(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}

func TestEMCode(t *testing.T) {
	if got := EMCode("600519.SH"); got != "600519" {
		t.Errorf("EMCode = %q", got)
	}
}

func TestInfoToTSCode(t *testing.T) {
	if got := InfoToTSCode("600519", "沪"); got != "600519.SH" {
		t.Errorf("InfoToTSCode = %q", got)
	}
	if got := InfoToTSCode("000001", "SZ"); got != "000001.SZ" {
		t.Errorf("InfoToTSCode = %q", got)
	}
}

func TestExtractNameCandidates(t *testing.T) {
	cands := extractNameCandidates("分析一下贵州茅台能不能买")
	found := false
	for _, c := range cands {
		if c == "贵州茅台" {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("candidates = %v, want 贵州茅台", cands)
	}
}

type stubSearcher struct {
	hits map[string][]StockMatch
}

func (s *stubSearcher) Search(keyword string) ([]StockMatch, error) {
	return s.hits[keyword], nil
}

func TestResolveTSCodeWithSearch(t *testing.T) {
	search := &stubSearcher{
		hits: map[string][]StockMatch{
			"贵州茅台": {{Code: "600519", Name: "贵州茅台", Market: "沪"}},
		},
	}
	got := ResolveTSCodeWithSearch("分析一下贵州茅台", search)
	if got != "600519.SH" {
		t.Errorf("ResolveTSCodeWithSearch = %q, want 600519.SH", got)
	}
}
