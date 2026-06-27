package tencent

import (
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/transform"
)

const quoteURL = "https://qt.gtimg.cn/q="

// Quote 腾讯财经实时行情（字段索引以 2026-06 实测为准，见 a-stock-data SKILL §1.2）
type Quote struct {
	Code           string
	Name           string
	Price          float64
	LastClose      float64
	Open           float64
	High           float64
	Low            float64
	ChangeAmt      float64
	ChangePct      float64
	Volume         int64  // 成交量（手）
	AmountWan      float64 // 成交额（万元）
	TurnoverPct    float64
	VolumeRatio    float64
	PeTTM          float64
	PeStatic       float64
	Pb             float64
	MarketCapYi    float64 // 总市值（亿元）
	FloatMarketYi  float64 // 流通市值（亿元）
	UpdateTime     string
}

// Client 腾讯财经 HTTP 客户端（不封 IP，优先用于 PE/PB/市值）
type Client struct {
	httpClient *http.Client
}

// NewClient 创建腾讯财经客户端
func NewClient() *Client {
	return &Client{
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

// GetQuotes 批量获取实时行情
func (c *Client) GetQuotes(codes []string) ([]*Quote, error) {
	if len(codes) == 0 {
		return nil, fmt.Errorf("codes required")
	}

	prefixed := make([]string, 0, len(codes))
	for _, code := range codes {
		if p := tencentSymbol(code); p != "" {
			prefixed = append(prefixed, p)
		}
	}
	if len(prefixed) == 0 {
		return nil, fmt.Errorf("no valid codes")
	}

	url := quoteURL + strings.Join(prefixed, ",")
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	decoded, _, err := transform.Bytes(simplifiedchinese.GBK.NewDecoder(), body)
	if err != nil {
		return nil, err
	}

	var result []*Quote
	for _, line := range strings.Split(string(decoded), ";") {
		line = strings.TrimSpace(line)
		if line == "" || !strings.Contains(line, "=") {
			continue
		}
		if q := parseQuoteLine(line); q != nil {
			result = append(result, q)
		}
	}
	if len(result) == 0 {
		return nil, fmt.Errorf("tencent quote empty")
	}
	return result, nil
}

// GetQuote 获取单只股票行情
func (c *Client) GetQuote(code string) (*Quote, error) {
	quotes, err := c.GetQuotes([]string{code})
	if err != nil {
		return nil, err
	}
	return quotes[0], nil
}

func tencentSymbol(code string) string {
	code = strings.TrimSpace(code)
	if idx := strings.Index(code, "."); idx > 0 {
		code = code[:idx]
	}
	if len(code) != 6 {
		return ""
	}
	switch {
	case strings.HasPrefix(code, "6"), strings.HasPrefix(code, "9"):
		return "sh" + code
	case strings.HasPrefix(code, "8"), strings.HasPrefix(code, "4"):
		return "bj" + code
	default:
		return "sz" + code
	}
}

func parseQuoteLine(line string) *Quote {
	eq := strings.Index(line, "=")
	if eq < 0 {
		return nil
	}
	varPart := line[:eq]
	valuePart := strings.TrimSpace(line[eq+1:])
	if !strings.HasPrefix(valuePart, `"`) {
		return nil
	}
	end := strings.LastIndex(valuePart, `"`)
	if end <= 0 {
		return nil
	}
	vals := strings.Split(valuePart[1:end], "~")
	if len(vals) < 47 {
		return nil
	}

	key := varPart
	if idx := strings.LastIndex(varPart, "_"); idx >= 0 {
		key = varPart[idx+1:]
	}
	code := strings.TrimPrefix(strings.TrimPrefix(key, "sh"), "sz")
	code = strings.TrimPrefix(code, "bj")
	if len(code) != 6 {
		return nil
	}

	price := parseFloat(vals, 3)
	if price <= 0 {
		return nil
	}

	q := &Quote{
		Code:          code,
		Name:          strings.TrimSpace(vals[1]),
		Price:         price,
		LastClose:     parseFloat(vals, 4),
		Open:          parseFloat(vals, 5),
		ChangeAmt:     parseFloat(vals, 31),
		ChangePct:     parseFloat(vals, 32),
		High:          parseFloat(vals, 33),
		Low:           parseFloat(vals, 34),
		Volume:        parseInt64(vals, 36),
		AmountWan:     parseFloat(vals, 37),
		TurnoverPct:   parseFloat(vals, 38),
		MarketCapYi:   parseFloat(vals, 44),
		FloatMarketYi: parseFloat(vals, 45),
		Pb:            parseFloat(vals, 46),
		VolumeRatio:   parseFloat(vals, 49),
	}
	if len(vals) > 52 {
		q.PeTTM = parseFloat(vals, 52)
	}
	if len(vals) > 53 {
		q.PeStatic = parseFloat(vals, 53)
	}
	if len(vals) > 30 && vals[30] != "" {
		raw := vals[30]
		if len(raw) >= 14 {
			q.UpdateTime = raw[:4] + "-" + raw[4:6] + "-" + raw[6:8] + " " + raw[8:10] + ":" + raw[10:12] + ":" + raw[12:14]
		}
	}
	return q
}

func parseFloat(vals []string, idx int) float64 {
	if idx >= len(vals) || vals[idx] == "" {
		return 0
	}
	f, _ := strconv.ParseFloat(vals[idx], 64)
	return f
}

func parseInt64(vals []string, idx int) int64 {
	if idx >= len(vals) || vals[idx] == "" {
		return 0
	}
	i, _ := strconv.ParseInt(vals[idx], 10, 64)
	return i
}
