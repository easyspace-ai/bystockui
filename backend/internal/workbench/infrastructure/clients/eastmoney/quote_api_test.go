package eastmoney

import (
	"testing"

	"aistock/backend/internal/workbench/infrastructure/clients"
)

func TestGetAllAShareQuotes(t *testing.T) {
	c := NewClient(&clients.SettingConfig{CrawlTimeOut: 15})
	quotes, err := c.GetAllAShareQuotes()
	if err != nil {
		t.Fatalf("GetAllAShareQuotes failed: %v", err)
	}
	if len(quotes) == 0 {
		t.Fatal("expected non-empty quotes from East Money API")
	}
	t.Logf("got %d quotes, first=%s %s", len(quotes), quotes[0].Code, quotes[0].Name)
}

func TestGetQuoteByCode(t *testing.T) {
	c := NewClient(&clients.SettingConfig{CrawlTimeOut: 15})
	q, err := c.GetQuoteByCode("600519")
	if err != nil {
		t.Fatalf("GetQuoteByCode failed: %v", err)
	}
	if q.Code != "600519" || q.Name == "" || q.Price <= 0 {
		t.Fatalf("unexpected quote: %+v", q)
	}
	if q.Pe <= 0 || q.Pb <= 0 {
		t.Fatalf("expected pe/pb from eastmoney, got pe=%.2f pb=%.2f", q.Pe, q.Pb)
	}
	if q.Industry == "" {
		t.Fatalf("expected industry, got empty")
	}
	if q.ListDate == "" {
		t.Fatalf("expected list date, got empty")
	}
	if q.TotalMarketCap <= 0 {
		t.Fatalf("expected total market cap, got %.2f", q.TotalMarketCap)
	}
	t.Logf("600519 quote: name=%s price=%.2f pe=%.2f pb=%.2f industry=%s cap=%.0f亿",
		q.Name, q.Price, q.Pe, q.Pb, q.Industry, q.TotalMarketCap)
}
