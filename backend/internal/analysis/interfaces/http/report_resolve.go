package httpapi

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

var (
	reConfidenceZH = regexp.MustCompile(`(?i)置信度[:：]\s*(\d+)%`)
	reConfidenceEN = regexp.MustCompile(`(?i)confidence[:：]\s*(\d+)%`)
	reTargetPrice  = regexp.MustCompile(`(?i)(?:目标价|目标价格|target)[:：]\s*[¥$]?\s*(\d+\.?\d*)`)
	reStopLoss     = regexp.MustCompile(`(?i)(?:止损价|止损价格|stop[-\s_]?loss)[:：]\s*[¥$]?\s*(\d+\.?\d*)`)
	reVerdict      = regexp.MustCompile(`(?is)<!--\s*VERDICT:\s*(\{.*?\})\s*-->`)
	reInlineRisk   = regexp.MustCompile(`(?:^|\n)\s*(?:\d+\.\s*)?主要风险[:：]\s*([^\n]+)`)
	reRiskNotice   = regexp.MustCompile(`(?s)【风险提示】\s*(.*?)(?:\n【|$)`)
)

func extractConfidenceRegex(text string) *int {
	if text == "" {
		return nil
	}
	for _, re := range []*regexp.Regexp{reConfidenceZH, reConfidenceEN} {
		m := re.FindStringSubmatch(text)
		if len(m) > 1 {
			v, err := strconv.Atoi(m[1])
			if err == nil && v >= 0 && v <= 100 {
				return &v
			}
		}
	}
	return nil
}

func extractTargetPriceRegex(text string) *float64 {
	if text == "" {
		return nil
	}
	m := reTargetPrice.FindStringSubmatch(text)
	if len(m) > 1 {
		f, err := strconv.ParseFloat(m[1], 64)
		if err == nil {
			return &f
		}
	}
	return nil
}

func extractStopLossRegex(text string) *float64 {
	if text == "" {
		return nil
	}
	m := reStopLoss.FindStringSubmatch(text)
	if len(m) > 1 {
		f, err := strconv.ParseFloat(m[1], 64)
		if err == nil {
			return &f
		}
	}
	return nil
}

// extractVerdictDirection mirrors Python _extract_verdict → direction string for reports.direction.
func extractVerdictDirection(text string) string {
	if text == "" {
		return ""
	}
	m := reVerdict.FindStringSubmatch(text)
	if len(m) < 2 {
		return ""
	}
	raw := strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(m[1], "\n", " "), "\r", " "))
	var payload struct {
		Direction string `json:"direction"`
	}
	if json.Unmarshal([]byte(raw), &payload) != nil || strings.TrimSpace(payload.Direction) == "" {
		return ""
	}
	return strings.TrimSpace(payload.Direction)
}

func stringFromAny(v any) string {
	if v == nil {
		return ""
	}
	switch t := v.(type) {
	case string:
		return t
	default:
		return fmt.Sprint(t)
	}
}

func isEmptyPayloadSlice(v any) bool {
	if v == nil {
		return true
	}
	switch arr := v.(type) {
	case []any:
		return len(arr) == 0
	case []map[string]any:
		return len(arr) == 0
	default:
		return false
	}
}

func inferRiskLevel(text string) string {
	t := strings.ToLower(text)
	if strings.Contains(t, "高风险") || strings.Contains(t, "重大风险") || strings.Contains(t, "严重") {
		return "high"
	}
	if strings.Contains(t, "低风险") || strings.Contains(t, "可控") || strings.Contains(t, "轻微") {
		return "low"
	}
	return "medium"
}

func extractRiskItemsFromText(text string) []map[string]any {
	if strings.TrimSpace(text) == "" {
		return nil
	}
	headers := []string{"【主要风险】", "【风险提示】", "主要风险", "风险提示", "核心风险"}
	items := make([]map[string]any, 0, 4)
	seen := make(map[string]struct{})
	addItem := func(name string) {
		name = strings.TrimSpace(strings.TrimLeft(name, "-•*·"))
		if name == "" || len(name) < 3 {
			return
		}
		if _, ok := seen[name]; ok {
			return
		}
		seen[name] = struct{}{}
		items = append(items, map[string]any{
			"name":  name,
			"level": inferRiskLevel(name),
		})
	}

	for _, header := range headers {
		idx := strings.Index(text, header)
		if idx < 0 {
			continue
		}
		section := text[idx+len(header):]
		if next := strings.Index(section, "【"); next > 0 {
			section = section[:next]
		}
		for _, line := range strings.Split(section, "\n") {
			line = strings.TrimSpace(line)
			if line == "" {
				continue
			}
			if strings.HasPrefix(line, "-") || strings.HasPrefix(line, "•") || strings.HasPrefix(line, "*") {
				addItem(line)
			} else if strings.Contains(line, "风险") && len(line) <= 80 {
				addItem(line)
			}
		}
	}

	if len(items) == 0 {
		for _, line := range strings.Split(text, "\n") {
			line = strings.TrimSpace(line)
			if strings.Contains(line, "风险") && (strings.HasPrefix(line, "-") || strings.HasPrefix(line, "•") || strings.HasPrefix(line, "*")) {
				addItem(line)
			}
		}
	}

	if m := reInlineRisk.FindStringSubmatch(text); len(m) > 1 {
		addItem(m[1])
	}

	if m := reRiskNotice.FindStringSubmatch(text); len(m) > 1 {
		for _, line := range strings.Split(m[1], "\n") {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "-") || strings.HasPrefix(line, "•") || strings.HasPrefix(line, "*") {
				addItem(line)
			}
		}
	}

	if len(items) > 6 {
		items = items[:6]
	}
	return items
}

func extractRiskItems(result map[string]any) []any {
	if result == nil {
		return nil
	}
	texts := []string{
		stringFromAny(result["final_trade_decision"]),
		stringFromAny(result["investment_plan"]),
		stringFromAny(result["trader_investment_plan"]),
		stringFromAny(result["news_report"]),
		stringFromAny(result["sentiment_report"]),
	}
	merged := strings.Join(texts, "\n")
	items := extractRiskItemsFromText(merged)
	if len(items) == 0 {
		return nil
	}
	out := make([]any, 0, len(items))
	for _, item := range items {
		out = append(out, item)
	}
	return out
}

var metricPatterns = []struct {
	name string
	re   *regexp.Regexp
}{
	{"市盈率(PE)", regexp.MustCompile(`(?i)(?:市盈率|PE)[:：\s]*([0-9.,]+(?:%|倍)?)`)},
	{"市净率(PB)", regexp.MustCompile(`(?i)(?:市净率|PB)[:：\s]*([0-9.,]+(?:%|倍)?)`)},
	{"总市值", regexp.MustCompile(`总市值[:：\s]*([0-9.,]+(?:亿|万|元)?)`)},
	{"换手率", regexp.MustCompile(`换手率[:：\s]*([0-9.,]+%?)`)},
	{"ROE", regexp.MustCompile(`(?i)ROE[:：\s]*([0-9.,]+%?)`)},
	{"RSI", regexp.MustCompile(`(?i)RSI[:：\s]*([0-9.,]+)`)},
	{"置信度", regexp.MustCompile(`置信度[:：\s]*((?:高|中|低)|\d+%?)`)},
	{"建议仓位", regexp.MustCompile(`建议仓位[:：\s]*([^\n|]+)`)},
	{"涨跌幅", regexp.MustCompile(`涨跌幅[:：\s]*([+-]?[0-9.,]+%?)`)},
}

func inferMetricStatus(name, value string) string {
	v := strings.TrimSpace(value)
	if v == "" {
		return "neutral"
	}
	if strings.Contains(name, "RSI") {
		if f, err := strconv.ParseFloat(strings.TrimSuffix(v, "%"), 64); err == nil {
			if f >= 70 {
				return "bad"
			}
			if f <= 30 {
				return "good"
			}
		}
	}
	return "neutral"
}

func extractKeyMetricsFromText(text string) []map[string]any {
	if strings.TrimSpace(text) == "" {
		return nil
	}
	items := make([]map[string]any, 0, 6)
	seen := make(map[string]struct{})
	addMetric := func(name, value string) {
		name = strings.TrimSpace(name)
		value = strings.TrimSpace(value)
		if name == "" || value == "" {
			return
		}
		if _, ok := seen[name]; ok {
			return
		}
		seen[name] = struct{}{}
		items = append(items, map[string]any{
			"name":   name,
			"value":  value,
			"status": inferMetricStatus(name, value),
		})
	}

	for _, p := range metricPatterns {
		if m := p.re.FindStringSubmatch(text); len(m) > 1 {
			addMetric(p.name, m[1])
		}
	}

	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		if !strings.Contains(line, "|") {
			continue
		}
		cells := strings.Split(line, "|")
		if len(cells) < 3 {
			continue
		}
		name := strings.TrimSpace(cells[1])
		value := strings.TrimSpace(cells[2])
		if name == "" || value == "" || strings.Contains(name, "---") {
			continue
		}
		if strings.Contains(name, "指标") || strings.Contains(name, "维度") || strings.Contains(name, "名称") {
			continue
		}
		addMetric(name, value)
	}

	if len(items) > 8 {
		items = items[:8]
	}
	return items
}

func extractKeyMetrics(result map[string]any) []any {
	if result == nil {
		return nil
	}
	texts := []string{
		stringFromAny(result["fundamentals_report"]),
		stringFromAny(result["market_report"]),
		stringFromAny(result["macro_report"]),
		stringFromAny(result["smart_money_report"]),
		stringFromAny(result["final_trade_decision"]),
	}
	merged := strings.Join(texts, "\n")
	items := extractKeyMetricsFromText(merged)
	if len(items) == 0 {
		return nil
	}
	out := make([]any, 0, len(items))
	for _, item := range items {
		out = append(out, item)
	}
	return out
}

// mergePayloadExtras fills nil confidence / prices / verdict direction like Python resolve_report_fields.
func mergePayloadExtras(result map[string]any, payload map[string]any) {
	if result == nil || payload == nil {
		return
	}
	final := stringFromAny(result["final_trade_decision"])
	trader := stringFromAny(result["trader_investment_plan"])

	if vdir := extractVerdictDirection(final); vdir != "" {
		payload["direction"] = vdir
	}

	if payload["confidence"] == nil {
		if c := extractConfidenceRegex(final); c != nil {
			payload["confidence"] = float64(*c)
		}
	}

	if payload["target_price"] == nil {
		if p := extractTargetPriceRegex(final); p != nil {
			payload["target_price"] = *p
		} else if p := extractTargetPriceRegex(trader); p != nil {
			payload["target_price"] = *p
		}
	}

	if payload["stop_loss_price"] == nil {
		if p := extractStopLossRegex(final); p != nil {
			payload["stop_loss_price"] = *p
		} else if p := extractStopLossRegex(trader); p != nil {
			payload["stop_loss_price"] = *p
		}
	}

	if isEmptyPayloadSlice(payload["risk_items"]) {
		if risks := extractRiskItems(result); len(risks) > 0 {
			payload["risk_items"] = risks
		}
	}
	if isEmptyPayloadSlice(payload["key_metrics"]) {
		if metrics := extractKeyMetrics(result); len(metrics) > 0 {
			payload["key_metrics"] = metrics
		}
	}
}
