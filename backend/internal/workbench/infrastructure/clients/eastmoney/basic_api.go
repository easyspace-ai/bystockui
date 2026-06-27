package eastmoney

import (
	"encoding/json"
	"fmt"
	"strings"
)

const conceptListURL = "https://push2.eastmoney.com/api/qt/slist/get"

// GetConceptBlocks 获取个股所属板块/概念（东财 slist spt=3，对齐 a-stock-data eastmoney_concept_blocks）
func (c *Client) GetConceptBlocks(code string) ([]string, error) {
	secid := c.convertStockCode(code)
	if secid == "" {
		return nil, fmt.Errorf("invalid stock code: %s", code)
	}

	params := []string{
		"fltt=2",
		"invt=2",
		"secid=" + secid,
		"spt=3",
		"pi=0",
		"pz=200",
		"po=1",
		"fields=f12,f14,f3,f128",
	}

	body, err := c.fetchEastMoneyJSON(conceptListURL, params)
	if err != nil {
		return nil, err
	}

	var resp struct {
		Rc   int `json:"rc"`
		Data struct {
			Diff json.RawMessage `json:"diff"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("parse eastmoney slist: %w", err)
	}
	if resp.Rc != 0 {
		return nil, fmt.Errorf("eastmoney slist rc=%d", resp.Rc)
	}

	names := parseConceptDiff(resp.Data.Diff)
	return names, nil
}

func parseConceptDiff(raw json.RawMessage) []string {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}

	type item struct {
		Name string `json:"f14"`
	}

	var asMap map[string]item
	if err := json.Unmarshal(raw, &asMap); err == nil && len(asMap) > 0 {
		out := make([]string, 0, len(asMap))
		for _, it := range asMap {
			if name := strings.TrimSpace(it.Name); name != "" && !skipConceptTag(name) {
				out = append(out, name)
			}
		}
		return out
	}

	var asList []item
	if err := json.Unmarshal(raw, &asList); err == nil {
		out := make([]string, 0, len(asList))
		for _, it := range asList {
			if name := strings.TrimSpace(it.Name); name != "" && !skipConceptTag(name) {
				out = append(out, name)
			}
		}
		return out
	}
	return nil
}

func skipConceptTag(name string) bool {
	skip := []string{
		"HS300_", "MSCI", "标准普尔", "富时罗素", "证金持股", "机构重仓",
		"深股通", "沪股通", "融资融券", "转融券标的", "标普道琼斯",
	}
	for _, s := range skip {
		if strings.Contains(name, s) {
			return true
		}
	}
	return false
}

// FormatConceptTags 从板块列表中提取适合展示的概念/地域标签
func FormatConceptTags(boards []string, industry string) string {
	if len(boards) == 0 {
		return ""
	}
	industry = strings.TrimSpace(industry)
	seen := map[string]struct{}{}
	var tags []string
	for _, name := range boards {
		name = strings.TrimSpace(name)
		if name == "" || name == industry {
			continue
		}
		if _, ok := seen[name]; ok {
			continue
		}
		// 优先保留含「概念」或「板块」的标签，其余行业分级（如白酒Ⅱ）已在 industry 字段
		if strings.Contains(name, "概念") || strings.HasSuffix(name, "板块") {
			seen[name] = struct{}{}
			tags = append(tags, name)
		}
	}
	if len(tags) == 0 {
		for _, name := range boards {
			name = strings.TrimSpace(name)
			if name == "" || name == industry {
				continue
			}
			if strings.HasSuffix(name, "Ⅱ") || strings.HasSuffix(name, "Ⅲ") {
				continue
			}
			if _, ok := seen[name]; ok {
				continue
			}
			seen[name] = struct{}{}
			tags = append(tags, name)
			if len(tags) >= 6 {
				break
			}
		}
	}
	return strings.Join(tags, "、")
}

// FormatListDate 将东财 f189 (YYYYMMDD) 格式化为 YYYY-MM-DD
func FormatListDate(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" || raw == "0" {
		return ""
	}
	// JSON 可能解析为 float
	if strings.Contains(raw, ".") {
		raw = strings.Split(raw, ".")[0]
	}
	if len(raw) == 8 {
		return raw[:4] + "-" + raw[4:6] + "-" + raw[6:8]
	}
	return raw
}
