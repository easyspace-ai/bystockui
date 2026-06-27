package hotmoney

import (
	"fmt"
	"regexp"
	"strings"
	"time"
)

// ReportMeta holds structured header fields for the HTML report hero.
type ReportMeta struct {
	TSCode      string   `json:"tsCode"`
	Name        string   `json:"name"`
	Industry    string   `json:"industry,omitempty"`
	Price       string   `json:"price,omitempty"`
	ChangePct   string   `json:"changePct,omitempty"`
	Turnover    string   `json:"turnover,omitempty"`
	MarketCap   string   `json:"marketCap,omitempty"`
	PE          string   `json:"pe,omitempty"`
	PB          string   `json:"pb,omitempty"`
	Concepts    []string `json:"concepts,omitempty"`
	DataTime    string   `json:"dataTime,omitempty"`
	LimitHeight string   `json:"limitHeight,omitempty"`
}

var (
	reKV     = regexp.MustCompile(`(?i)([\p{Han}a-z_]+)\s*[:：]\s*([^\n|,]+)`)
	reMapKV  = regexp.MustCompile(`(?i)([a-z_]+|[\p{Han}]+):([^ \]\n,]+)`)
	reNumber = regexp.MustCompile(`[-+]?\d+\.?\d*`)
)

// ExtractReportMeta parses collected dimensions into hero/header fields.
func ExtractReportMeta(tsCode string, dims map[string]Dimension) ReportMeta {
	meta := ReportMeta{
		TSCode:   tsCode,
		DataTime: time.Now().Format("2006-01-02 15:04"),
	}
	if basic, ok := dims["basic"]; ok && basic.Err == nil {
		applyKVBlock(&meta, basic.Content)
		applyMapFields(&meta, basic.Content)
	}
	if daily, ok := dims["daily_basic"]; ok && daily.Err == nil {
		applyDailyBasic(&meta, daily.Content)
		applyMapFields(&meta, daily.Content)
	}
	if kline, ok := dims["kline"]; ok && kline.Err == nil {
		applyKline(&meta, kline.Content)
		applyMapFields(&meta, kline.Content)
	}
	if concept, ok := dims["concept"]; ok && concept.Err == nil {
		if tags := parseConceptTags(concept.Content); len(tags) > 0 {
			meta.Concepts = tags
		}
	}
	if meta.Name == "" {
		meta.Name = strings.TrimSuffix(tsCode, ".SH")
		meta.Name = strings.TrimSuffix(meta.Name, ".SZ")
	}
	return meta
}

// applyMapFields parses tusharedb DataFrame rows formatted as map[key:value ...].
func applyMapFields(meta *ReportMeta, text string) {
	for _, m := range reMapKV.FindAllStringSubmatch(text, -1) {
		key := strings.ToLower(strings.TrimSpace(m[1]))
		val := strings.TrimSpace(m[2])
		if val == "" || val == "<nil>" {
			continue
		}
		switch key {
		case "name", "名称", "ts_name":
			if meta.Name == "" {
				meta.Name = val
			}
		case "industry", "行业":
			if meta.Industry == "" {
				meta.Industry = val
			}
		case "close", "收盘":
			if meta.Price == "" {
				meta.Price = extractNum(val)
			}
		case "pct_chg", "涨跌幅":
			if meta.ChangePct == "" {
				meta.ChangePct = extractNum(val)
			}
		case "turnover_rate", "turnover", "换手率":
			if meta.Turnover == "" {
				meta.Turnover = extractNum(val)
			}
		case "pe", "pe_ttm", "市盈率":
			if meta.PE == "" {
				meta.PE = extractNum(val)
			}
		case "pb", "市净率":
			if meta.PB == "" {
				meta.PB = extractNum(val)
			}
		case "total_mv", "总市值":
			if meta.MarketCap == "" {
				meta.MarketCap = formatMarketCap(val)
			}
		}
	}
}

func applyKVBlock(meta *ReportMeta, text string) {
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		lower := strings.ToLower(line)
		switch {
		case strings.Contains(lower, "name") || strings.Contains(line, "名称"):
			meta.Name = pickField(line, "name", "名称")
		case strings.Contains(lower, "industry") || strings.Contains(line, "行业"):
			meta.Industry = pickField(line, "industry", "行业")
		}
	}
}

func pickField(line string, keys ...string) string {
	for _, k := range keys {
		if i := strings.Index(strings.ToLower(line), strings.ToLower(k)); i >= 0 {
			rest := line[i+len(k):]
			rest = strings.TrimLeft(rest, " :：")
			if v := strings.TrimSpace(strings.Split(rest, "|")[0]); v != "" {
				return v
			}
		}
	}
	parts := strings.FieldsFunc(line, func(r rune) bool { return r == '|' || r == ',' })
	if len(parts) >= 2 {
		return strings.TrimSpace(parts[len(parts)-1])
	}
	return ""
}

func applyDailyBasic(meta *ReportMeta, text string) {
	lines := strings.Split(text, "\n")
	// Use last data row when tabular.
	for i := len(lines) - 1; i >= 0; i-- {
		line := lines[i]
		if !strings.Contains(line, ".") && !reNumber.MatchString(line) {
			continue
		}
		fields := splitRow(line)
		if len(fields) < 3 {
			continue
		}
		for _, f := range fields {
			l := strings.ToLower(f)
			switch {
			case strings.Contains(l, "pe") || strings.Contains(f, "市盈"):
				meta.PE = extractNum(f)
			case strings.Contains(l, "pb") || strings.Contains(f, "市净"):
				meta.PB = extractNum(f)
			case strings.Contains(l, "turnover") || strings.Contains(f, "换手"):
				meta.Turnover = extractNum(f)
			case strings.Contains(l, "total_mv") || strings.Contains(f, "总市值"):
				meta.MarketCap = formatMarketCap(f)
			}
		}
		break
	}
	if meta.PE == "" || meta.Turnover == "" {
		for _, m := range reKV.FindAllStringSubmatch(text, -1) {
			key, val := strings.ToLower(m[1]), strings.TrimSpace(m[2])
			switch {
			case strings.Contains(key, "pe") || strings.Contains(key, "市盈"):
				meta.PE = extractNum(val)
			case strings.Contains(key, "pb") || strings.Contains(key, "市净"):
				meta.PB = extractNum(val)
			case strings.Contains(key, "turnover") || strings.Contains(key, "换手"):
				meta.Turnover = extractNum(val)
			case strings.Contains(key, "total_mv") || strings.Contains(key, "总市值"):
				meta.MarketCap = formatMarketCap(val)
			}
		}
	}
}

func applyKline(meta *ReportMeta, text string) {
	lines := strings.Split(text, "\n")
	for i := len(lines) - 1; i >= 0; i-- {
		line := lines[i]
		if !reNumber.MatchString(line) {
			continue
		}
		fields := splitRow(line)
		if len(fields) < 4 {
			continue
		}
		// Typical OHLCV row: date open high low close vol ...
		for _, f := range fields {
			if strings.Contains(f, "close") || strings.Contains(f, "收盘") {
				meta.Price = extractNum(f)
			}
		}
		if meta.Price == "" {
			// Heuristic: 5th numeric field often close in tushare dumps.
			nums := numericFields(fields)
			if len(nums) >= 4 {
				meta.Price = nums[3]
			} else if len(nums) >= 1 {
				meta.Price = nums[len(nums)-1]
			}
		}
		if meta.ChangePct == "" {
			for _, f := range fields {
				if strings.Contains(strings.ToLower(f), "pct") || strings.Contains(f, "涨跌") {
					meta.ChangePct = extractNum(f)
					break
				}
			}
		}
		break
	}
}

func parseConceptTags(text string) []string {
	var tags []string
	seen := map[string]bool{}
	addTag := func(part string) {
		part = strings.TrimSpace(part)
		if part == "" || seen[part] || len(part) > 24 {
			return
		}
		lower := strings.ToLower(part)
		switch lower {
		case "板块名", "涨跌幅", "龙头股", "概念", "板块归属", "---":
			return
		}
		if strings.HasPrefix(part, "#") || strings.HasPrefix(part, "---") {
			return
		}
		if strings.HasPrefix(part, "共 ") && strings.Contains(part, "板块") {
			return
		}
		if reNumber.MatchString(part) && !strings.Contains(part, "Ⅱ") && len([]rune(part)) < 4 {
			return
		}
		seen[part] = true
		tags = append(tags, part)
	}

	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if strings.Contains(line, "|") {
			cols := strings.Split(line, "|")
			if len(cols) > 0 {
				addTag(strings.TrimSpace(cols[0]))
			}
			continue
		}
		for _, part := range strings.FieldsFunc(line, func(r rune) bool {
			return r == ',' || r == '、' || r == ';'
		}) {
			addTag(part)
		}
		if len(tags) >= 8 {
			return tags
		}
	}
	return tags
}

func splitRow(line string) []string {
	line = strings.TrimSpace(line)
	if strings.Contains(line, "|") {
		parts := strings.Split(line, "|")
		for i := range parts {
			parts[i] = strings.TrimSpace(parts[i])
		}
		return parts
	}
	return strings.Fields(line)
}

func numericFields(fields []string) []string {
	var out []string
	for _, f := range fields {
		if n := extractNum(f); n != "" {
			out = append(out, n)
		}
	}
	return out
}

func extractNum(s string) string {
	m := reNumber.FindString(s)
	return m
}

func formatMarketCap(s string) string {
	n := extractNum(s)
	if n == "" {
		return s
	}
	return n + " 亿"
}

// FormatReportMetaBlock renders structured hero hints for the LLM prompt.
func FormatReportMetaBlock(meta ReportMeta) string {
	var sb strings.Builder
	sb.WriteString("## 报告头部结构化数据（hero 区必须引用，勿编造）\n\n")
	sb.WriteString(fmt.Sprintf("- ts_code: %s\n", meta.TSCode))
	sb.WriteString(fmt.Sprintf("- name: %s\n", meta.Name))
	if meta.Industry != "" {
		sb.WriteString(fmt.Sprintf("- industry: %s\n", meta.Industry))
	}
	if meta.Price != "" {
		sb.WriteString(fmt.Sprintf("- price: %s\n", meta.Price))
	}
	if meta.ChangePct != "" {
		sb.WriteString(fmt.Sprintf("- change_pct: %s%%\n", meta.ChangePct))
	}
	if meta.Turnover != "" {
		sb.WriteString(fmt.Sprintf("- turnover: %s%%\n", meta.Turnover))
	}
	if meta.MarketCap != "" {
		sb.WriteString(fmt.Sprintf("- market_cap: %s\n", meta.MarketCap))
	}
	if meta.PE != "" {
		sb.WriteString(fmt.Sprintf("- pe: %s\n", meta.PE))
	}
	if meta.PB != "" {
		sb.WriteString(fmt.Sprintf("- pb: %s\n", meta.PB))
	}
	if len(meta.Concepts) > 0 {
		sb.WriteString(fmt.Sprintf("- concepts: %s\n", strings.Join(meta.Concepts, " · ")))
	}
	sb.WriteString(fmt.Sprintf("- data_time: %s\n", meta.DataTime))
	sb.WriteString("\n")
	return sb.String()
}
