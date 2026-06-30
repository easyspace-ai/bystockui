package sqlite

import (
	"testing"

	"aistock/backend/internal/workbench/domain/stock"
)

func TestStockSearchScore(t *testing.T) {
	maotai := stock.StockInfo{Code: "600519", Name: "贵州茅台", Market: "沪"}
	pingan := stock.StockInfo{Code: "000001", Name: "平安银行", Market: "深"}

	if got := stockSearchScore("600519", maotai); got <= stockSearchScore("600519", pingan) {
		t.Fatalf("exact code should rank highest, got maotai=%d pingan=%d", got, stockSearchScore("600519", pingan))
	}
	if stockSearchScore("贵州茅台", maotai) <= stockSearchScore("贵州茅台", pingan) {
		t.Fatal("exact name should rank maotai first")
	}
	if stockSearchScore("茅台", maotai) <= stockSearchScore("茅台", pingan) {
		t.Fatal("partial name should rank maotai first")
	}
	if stockSearchScore("6005", maotai) <= stockSearchScore("6005", pingan) {
		t.Fatal("code prefix should rank maotai first")
	}
}

func TestRankStockSearchResults(t *testing.T) {
	results := []stock.StockInfo{
		{Code: "000001", Name: "平安银行", Market: "深"},
		{Code: "600519", Name: "贵州茅台", Market: "沪"},
		{Code: "600809", Name: "山西汾酒", Market: "沪"},
	}
	ranked := rankStockSearchResults("茅台", results)
	if ranked[0].Code != "600519" {
		t.Fatalf("expected 600519 first, got %s", ranked[0].Code)
	}
}

func TestFuzzySubsequenceMatch(t *testing.T) {
	if !fuzzySubsequenceMatch("贵茅", "贵州茅台") {
		t.Fatal("expected 贵茅 to match 贵州茅台")
	}
	if fuzzySubsequenceMatch("银行", "贵州茅台") {
		t.Fatal("expected 银行 not to match 贵州茅台")
	}
}
