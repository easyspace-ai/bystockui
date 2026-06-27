package tencent

import (
	"testing"
)

func TestGetQuote(t *testing.T) {
	c := NewClient()
	q, err := c.GetQuote("600519")
	if err != nil {
		t.Fatalf("GetQuote failed: %v", err)
	}
	if q.Code != "600519" || q.Name == "" || q.Price <= 0 {
		t.Fatalf("unexpected quote: %+v", q)
	}
	if q.PeTTM <= 0 || q.Pb <= 0 {
		t.Fatalf("expected pe/pb, got pe=%.2f pb=%.2f", q.PeTTM, q.Pb)
	}
	if q.MarketCapYi <= 0 {
		t.Fatalf("expected market cap, got %.2f", q.MarketCapYi)
	}
	t.Logf("600519: price=%.2f pe=%.2f pb=%.2f cap=%.0f亿 turnover=%.2f%%",
		q.Price, q.PeTTM, q.Pb, q.MarketCapYi, q.TurnoverPct)
}

func TestGetQuotesBatch(t *testing.T) {
	c := NewClient()
	quotes, err := c.GetQuotes([]string{"600519", "000001"})
	if err != nil {
		t.Fatalf("GetQuotes failed: %v", err)
	}
	if len(quotes) < 2 {
		t.Fatalf("expected 2 quotes, got %d", len(quotes))
	}
}
