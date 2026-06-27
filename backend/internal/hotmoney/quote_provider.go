package hotmoney

import (
	"fmt"
	"strings"

	"aistock/backend/internal/workbench/domain/stock"
	"aistock/backend/internal/workbench/ports"
)

// QuoteProvider fetches live quotes for hero metrics.
type QuoteProvider interface {
	GetQuote(code string) (*stock.StockQuote, error)
	GetByCode(code string) (*stock.StockInfo, error)
}

// RepoQuoteProvider adapts StockRepository for hot-money hero enrichment.
type RepoQuoteProvider struct {
	repo ports.StockRepository
}

func NewRepoQuoteProvider(repo ports.StockRepository) *RepoQuoteProvider {
	if repo == nil {
		return nil
	}
	return &RepoQuoteProvider{repo: repo}
}

func (p *RepoQuoteProvider) GetQuote(code string) (*stock.StockQuote, error) {
	return p.repo.GetQuote(code)
}

func (p *RepoQuoteProvider) GetByCode(code string) (*stock.StockInfo, error) {
	return p.repo.GetByCode(code)
}

// EnrichMetaFromQuote fills hero fields from a live quote (overrides stale/missing lake data).
func EnrichMetaFromQuote(meta *ReportMeta, q *stock.StockQuote) {
	if meta == nil || q == nil {
		return
	}
	if q.Name != "" && q.Name != "-" {
		meta.Name = q.Name
	}
	if q.Price > 0 {
		meta.Price = fmt.Sprintf("%.2f", q.Price)
	}
	if q.ChangePct != 0 || q.Price > 0 {
		meta.ChangePct = fmt.Sprintf("%+.2f", q.ChangePct)
	}
	if q.TurnoverRate > 0 {
		meta.Turnover = fmt.Sprintf("%.2f", q.TurnoverRate)
	}
	if q.Pe > 0 && meta.PE == "" {
		meta.PE = fmt.Sprintf("%.2f", q.Pe)
	}
	if q.Pb > 0 && meta.PB == "" {
		meta.PB = fmt.Sprintf("%.2f", q.Pb)
	}
	if q.TotalMarketCap > 0 && meta.MarketCap == "" {
		meta.MarketCap = fmt.Sprintf("%.0f 亿", q.TotalMarketCap)
	}
}

// EnrichMetaFromStockInfo fills name/industry/concepts from stock DB when lake basic is missing.
func EnrichMetaFromStockInfo(meta *ReportMeta, info *stock.StockInfo) {
	if meta == nil || info == nil {
		return
	}
	if info.Name != "" {
		meta.Name = info.Name
	}
	if info.Industry != "" && meta.Industry == "" {
		meta.Industry = info.Industry
	}
	if len(meta.Concepts) == 0 && info.Concept != "" {
		meta.Concepts = splitConceptString(info.Concept)
	}
}

func splitConceptString(s string) []string {
	var out []string
	seen := map[string]bool{}
	for _, part := range strings.FieldsFunc(s, func(r rune) bool {
		return r == '|' || r == ',' || r == '、' || r == ';'
	}) {
		part = strings.TrimSpace(part)
		if part == "" || seen[part] {
			continue
		}
		seen[part] = true
		out = append(out, part)
		if len(out) >= 8 {
			break
		}
	}
	return out
}
