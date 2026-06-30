package sqlite

import (
	"sort"
	"strings"
	"unicode"

	"aistock/backend/internal/workbench/domain/stock"
)

func rankStockSearchResults(keyword string, results []stock.StockInfo) []stock.StockInfo {
	kw := strings.TrimSpace(keyword)
	if kw == "" || len(results) == 0 {
		return results
	}

	sorted := make([]stock.StockInfo, len(results))
	copy(sorted, results)
	sort.SliceStable(sorted, func(i, j int) bool {
		si := stockSearchScore(kw, sorted[i])
		sj := stockSearchScore(kw, sorted[j])
		if si != sj {
			return si > sj
		}
		return sorted[i].Code < sorted[j].Code
	})
	return sorted
}

func stockSearchScore(keyword string, info stock.StockInfo) int {
	kw := strings.TrimSpace(keyword)
	if kw == "" {
		return 0
	}

	kwUpper := strings.ToUpper(kw)
	code := strings.ToUpper(strings.TrimSpace(info.Code))
	name := strings.TrimSpace(info.Name)

	score := 0
	if code == kwUpper {
		score = maxInt(score, 1000)
	}
	if name == kw {
		score = maxInt(score, 950)
	}
	if strings.HasPrefix(code, kwUpper) {
		score = maxInt(score, 800)
	}
	if strings.HasPrefix(name, kw) {
		score = maxInt(score, 750)
	}
	if strings.Contains(name, kw) {
		score = maxInt(score, 600)
	}
	if strings.Contains(code, kwUpper) {
		score = maxInt(score, 500)
	}
	if containsHan(kw) && fuzzySubsequenceMatch(kw, name) {
		score = maxInt(score, 400)
	}

	// Prefer shorter names when relevance is equal.
	return score*1000 - len([]rune(name))
}

func fuzzySubsequenceMatch(query, target string) bool {
	if query == "" || target == "" {
		return false
	}
	qr := []rune(query)
	tr := []rune(target)
	qi := 0
	for _, r := range tr {
		if qi < len(qr) && r == qr[qi] {
			qi++
		}
	}
	return qi == len(qr)
}

func containsHan(s string) bool {
	for _, r := range s {
		if unicode.Is(unicode.Han, r) {
			return true
		}
	}
	return false
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// searchStocksBySubsequence 在 LIKE 无结果时，用首字缩小候选集再做子序列模糊匹配。
func (r *StockRepositoryImpl) searchStocksBySubsequence(keyword string) ([]stock.StockInfo, error) {
	runes := []rune(strings.TrimSpace(keyword))
	if len(runes) == 0 {
		return nil, nil
	}

	anchor := string(runes[0])
	var candidates []stock.StockInfo
	if err := r.db.Where("name LIKE ?", "%"+anchor+"%").Limit(400).Find(&candidates).Error; err != nil {
		return nil, err
	}

	matched := make([]stock.StockInfo, 0, 32)
	for _, info := range candidates {
		if fuzzySubsequenceMatch(keyword, info.Name) {
			matched = append(matched, info)
		}
	}
	return matched, nil
}
