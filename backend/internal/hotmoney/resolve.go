package hotmoney

import (
	"regexp"
	"strings"
	"unicode"
)

var (
	codeWithSuffix = regexp.MustCompile(`(?i)\b(\d{6})\.(SH|SZ|BJ)\b`)
	sixDigitCode   = regexp.MustCompile(`\b([036]\d{5}|[68]\d{5})\b`)
	cjkNameChunk   = regexp.MustCompile(`[\p{Han}]{2,8}`)
)

// StockMatch is a lightweight search hit for name→code resolution.
type StockMatch struct {
	Code   string
	Name   string
	Market string
}

// StockSearcher resolves Chinese names or partial codes via stock DB search.
type StockSearcher interface {
	Search(keyword string) ([]StockMatch, error)
}

var nameStopWords = map[string]struct{}{
	"分析": {}, "看看": {}, "帮我": {}, "今天": {}, "能不能": {}, "打板": {},
	"游资": {}, "大佬": {}, "看盘": {}, "最近": {}, "龙虎榜": {}, "妖股": {},
	"股票": {}, "代码": {}, "名称": {}, "怎么样": {}, "如何": {}, "请问": {},
}

// ResolveTSCode extracts a Tushare-style ts_code from free text (e.g. "分析 600519").
func ResolveTSCode(text string) string {
	if m := codeWithSuffix.FindStringSubmatch(text); len(m) == 3 {
		return strings.ToUpper(m[1]) + "." + strings.ToUpper(m[2])
	}
	if m := sixDigitCode.FindStringSubmatch(text); len(m) == 2 {
		return toTSCode(m[1])
	}
	return ""
}

// ResolveTSCodeWithSearch tries numeric patterns first, then stock name search.
func ResolveTSCodeWithSearch(text string, search StockSearcher) string {
	if code := ResolveTSCode(text); code != "" {
		return code
	}
	if search == nil {
		return ""
	}
	for _, name := range extractNameCandidates(text) {
		matches, err := search.Search(name)
		if err != nil || len(matches) == 0 {
			continue
		}
		for _, m := range matches {
			if m.Name == name {
				return InfoToTSCode(m.Code, m.Market)
			}
		}
		if len(matches) == 1 {
			return InfoToTSCode(matches[0].Code, matches[0].Market)
		}
	}
	return ""
}

func extractNameCandidates(text string) []string {
	seen := make(map[string]struct{})
	var out []string
	for _, chunk := range cjkNameChunk.FindAllString(text, -1) {
		for _, name := range expandNameChunk(chunk) {
			if _, skip := nameStopWords[name]; skip {
				continue
			}
			if _, ok := seen[name]; ok {
				continue
			}
			seen[name] = struct{}{}
			out = append(out, name)
		}
	}
	for i := 0; i < len(out); i++ {
		for j := i + 1; j < len(out); j++ {
			if len([]rune(out[j])) > len([]rune(out[i])) {
				out[i], out[j] = out[j], out[i]
			}
		}
	}
	return out
}

func expandNameChunk(chunk string) []string {
	runes := []rune(chunk)
	if len(runes) <= 2 {
		return []string{chunk}
	}
	var out []string
	for size := len(runes); size >= 2; size-- {
		for i := 0; i <= len(runes)-size; i++ {
			out = append(out, string(runes[i:i+size]))
		}
	}
	return out
}

// InfoToTSCode maps stock DB code + market to ts_code.
func InfoToTSCode(code, market string) string {
	code = strings.TrimSpace(code)
	switch strings.ToUpper(strings.TrimSpace(market)) {
	case "SH", "沪", "上海":
		return code + ".SH"
	case "SZ", "深", "深圳":
		return code + ".SZ"
	case "BJ", "京", "北京":
		return code + ".BJ"
	default:
		return toTSCode(code)
	}
}

// StripNonStockText removes punctuation for cleaner name extraction tests.
func StripNonStockText(text string) string {
	var b strings.Builder
	for _, r := range text {
		if unicode.Is(unicode.Han, r) || unicode.IsDigit(r) || r == '.' {
			b.WriteRune(r)
		} else {
			b.WriteRune(' ')
		}
	}
	return strings.Join(strings.Fields(b.String()), " ")
}

func toTSCode(code string) string {
	switch {
	case strings.HasPrefix(code, "6"), strings.HasPrefix(code, "5"):
		return code + ".SH"
	case strings.HasPrefix(code, "0"), strings.HasPrefix(code, "3"):
		return code + ".SZ"
	case strings.HasPrefix(code, "8"), strings.HasPrefix(code, "4"):
		return code + ".BJ"
	default:
		return code + ".SZ"
	}
}

// EMCode returns East Money 6-digit code from ts_code.
func EMCode(tsCode string) string {
	parts := strings.Split(tsCode, ".")
	if len(parts) > 0 {
		return parts[0]
	}
	return tsCode
}
