package eastmoney

import (
	"testing"

	"aistock/backend/internal/workbench/infrastructure/clients"
)

func TestGetConceptBlocks(t *testing.T) {
	c := NewClient(&clients.SettingConfig{CrawlTimeOut: 15})
	boards, err := c.GetConceptBlocks("600519")
	if err != nil {
		t.Fatalf("GetConceptBlocks failed: %v", err)
	}
	if len(boards) == 0 {
		t.Fatal("expected concept boards")
	}
	formatted := FormatConceptTags(boards, "白酒Ⅱ")
	if formatted == "" {
		t.Fatalf("expected formatted concept tags, boards=%v", boards)
	}
	t.Logf("600519 boards=%d concept=%q listDate sample ok", len(boards), formatted)
}

func TestFormatListDate(t *testing.T) {
	if got := FormatListDate("20010827"); got != "2001-08-27" {
		t.Fatalf("got %q", got)
	}
}
