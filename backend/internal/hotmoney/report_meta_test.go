package hotmoney

import (
	"strings"
	"testing"

	"aistock/backend/internal/workbench/domain/stock"
)

func TestExtractReportMeta_EmptyDims(t *testing.T) {
	meta := ExtractReportMeta("600519.SH", map[string]Dimension{})
	if meta.TSCode != "600519.SH" {
		t.Fatalf("tsCode=%q", meta.TSCode)
	}
	if meta.DataTime == "" {
		t.Fatal("expected data time")
	}
}

func TestFormatReportMetaBlock(t *testing.T) {
	block := FormatReportMetaBlock(ReportMeta{
		TSCode:    "600519.SH",
		Name:      "贵州茅台",
		Price:     "1688.00",
		ChangePct: "-1.2",
		PE:        "28.5",
		Concepts:  []string{"白酒", "消费"},
	})
	for _, want := range []string{"600519.SH", "贵州茅台", "1688.00", "白酒"} {
		if !strings.Contains(block, want) {
			t.Fatalf("missing %q in block:\n%s", want, block)
		}
	}
}

func TestParseConceptTags_MarkdownTable(t *testing.T) {
	text := `# 板块归属 | 603345

共 4 个板块:

板块名 | 涨跌幅 | 龙头股
--- | --- | ---
预制菜 | -1.23% | 安井食品
冻品 | 0.50% | 某某
大消费 | 1.00% | 某某
MSCI | 0.10% | 某某
`
	tags := parseConceptTags(text)
	want := []string{"预制菜", "冻品", "大消费", "MSCI"}
	if len(tags) != len(want) {
		t.Fatalf("got %v want %v", tags, want)
	}
	for i, w := range want {
		if tags[i] != w {
			t.Fatalf("tag[%d]=%q want %q all=%v", i, tags[i], w, tags)
		}
	}
}

func TestApplyMapFields(t *testing.T) {
	meta := &ReportMeta{}
	text := `1. map[close:72.35 name:安井食品 pct_chg:1.25 turnover_rate:0.88 total_mv:212345.6 pe:18.5]`
	applyMapFields(meta, text)
	if meta.Name != "安井食品" {
		t.Fatalf("name=%q", meta.Name)
	}
	if meta.Price != "72.35" {
		t.Fatalf("price=%q", meta.Price)
	}
	if meta.ChangePct != "1.25" {
		t.Fatalf("change=%q", meta.ChangePct)
	}
	if meta.Turnover != "0.88" {
		t.Fatalf("turnover=%q", meta.Turnover)
	}
}

func TestEnrichMetaFromQuote(t *testing.T) {
	meta := ReportMeta{TSCode: "603345.SH"}
	EnrichMetaFromQuote(&meta, &stock.StockQuote{
		Name:           "安井食品",
		Price:          72.35,
		ChangePct:      -1.23,
		TurnoverRate:   0.88,
		Pe:             18.5,
		TotalMarketCap: 212.3,
	})
	if meta.Name != "安井食品" || meta.Price != "72.35" {
		t.Fatalf("meta=%+v", meta)
	}
	if meta.ChangePct != "-1.23" {
		t.Fatalf("change=%q", meta.ChangePct)
	}
}

func TestReportNavItems(t *testing.T) {
	items := ReportNavItems()
	if len(items) != 9 {
		t.Fatalf("expected 9 nav items, got %d", len(items))
	}
	if items[0].ID != "section-info" {
		t.Fatalf("first id=%q", items[0].ID)
	}
	found := false
	for _, it := range items {
		if it.ID == "section-fund-holders" {
			found = true
			break
		}
	}
	if !found {
		t.Fatal("missing section-fund-holders nav item")
	}
}
