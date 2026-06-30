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
	for _, code := range []string{"600519", "600903"} {
		q, err := c.GetQuoteByCode(code)
		if err != nil {
			t.Fatalf("GetQuoteByCode(%s) failed: %v", code, err)
		}
		if q.Code != code || q.Name == "" {
			t.Fatalf("unexpected quote: %+v", q)
		}
		if q.Pe <= 0 || q.Pb <= 0 {
			t.Fatalf("%s: expected pe/pb from eastmoney, got pe=%.2f pb=%.2f", code, q.Pe, q.Pb)
		}
		if q.Industry == "" {
			t.Fatalf("%s: expected industry, got empty", code)
		}
		if q.ListDate == "" {
			t.Fatalf("%s: expected list date, got empty", code)
		}
		if q.TotalMarketCap <= 0 {
			t.Fatalf("%s: expected total market cap, got %.2f", code, q.TotalMarketCap)
		}
		t.Logf("%s quote: name=%s price=%.2f pe=%.2f pb=%.2f industry=%s listDate=%s cap=%.0f亿",
			code, q.Name, q.Price, q.Pe, q.Pb, q.Industry, q.ListDate, q.TotalMarketCap)
	}
}
