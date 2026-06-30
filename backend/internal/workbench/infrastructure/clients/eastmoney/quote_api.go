package eastmoney

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"
)

const (
	// push2 在部分网络环境下会返回空响应；push2delay 为东方财富行情延迟节点，兼容性更好
	quoteListURL       = "https://push2delay.eastmoney.com/api/qt/clist/get"
	quoteListURLLegacy = "https://push2.eastmoney.com/api/qt/clist/get"
)

// MarketQuote 市场行情数据（包含选股所需的完整字段）
type MarketQuote struct {
	Code                 string  `json:"code"`                 // 股票代码（6位数字）
	Name                 string  `json:"name"`                 // 股票名称
	Price                float64 `json:"price"`                // 最新价
	ChangePercent        float64 `json:"changePercent"`        // 涨跌幅（%）
	Change               float64 `json:"change"`               // 涨跌额
	Open                 float64 `json:"open"`                 // 开盘价
	High                 float64 `json:"high"`                 // 最高价
	Low                  float64 `json:"low"`                  // 最低价
	PrevClose            float64 `json:"prevClose"`            // 昨收价
	Volume               int64   `json:"volume"`               // 成交量（手）
	Amount               float64 `json:"amount"`               // 成交额（元）
	TurnoverRate         float64 `json:"turnoverRate"`         // 换手率（%）
	VolumeRatio          float64 `json:"volumeRatio"`          // 量比
	CirculatingMarketCap float64 `json:"circulatingMarketCap"` // 流通市值（亿元）
	TotalMarketCap       float64 `json:"totalMarketCap"`       // 总市值（亿元）
	Pe                   float64 `json:"pe"`                   // 市盈率（动）
	Pb                   float64 `json:"pb"`                   // 市净率
	Market               string  `json:"market"`               // 市场：SH/SZ/BJ
	Industry             string  `json:"industry,omitempty"`   // 所属行业（stock/get f127）
	Concept              string  `json:"concept,omitempty"`    // 板块/概念（stock/get f128）
	ListDate             string  `json:"listDate,omitempty"`   // 上市日期 YYYY-MM-DD（stock/get f189）
}

const (
	quoteStockURL       = "https://push2delay.eastmoney.com/api/qt/stock/get"
	quoteStockURLLegacy = "https://push2.eastmoney.com/api/qt/stock/get"
)

// GetQuoteByCode 获取单只股票实时行情（东财 push2 stock/get，stock.db 无记录时的兜底）
func (c *Client) GetQuoteByCode(code string) (*MarketQuote, error) {
	secid := c.convertStockCode(code)
	if secid == "" {
		return nil, fmt.Errorf("invalid stock code: %s", code)
	}

	fields := "f57,f58,f43,f44,f45,f46,f47,f48,f169,f170,f60,f116,f117,f162,f167,f168,f127,f128,f189"
	params := []string{
		"secid=" + secid,
		"fields=" + fields,
		"ut=fa5fd1943c7b386f172d6893db079186",
	}

	body, err := c.fetchEastMoneyJSON(quoteStockURL, params)
	if err != nil {
		return nil, err
	}

	var resp struct {
		Rc   int            `json:"rc"`
		Data map[string]any `json:"data"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("parse eastmoney stock/get: %w", err)
	}
	if resp.Rc != 0 || len(resp.Data) == 0 {
		return nil, fmt.Errorf("eastmoney stock/get empty for %s", code)
	}

	getFloat := func(key string) float64 {
		v, ok := resp.Data[key]
		if !ok || v == nil {
			return 0
		}
		switch vv := v.(type) {
		case float64:
			return vv
		case string:
			f, _ := strconv.ParseFloat(vv, 64)
			return f
		}
		return 0
	}
	getInt64 := func(key string) int64 {
		return int64(getFloat(key))
	}
	getString := func(key string) string {
		v, ok := resp.Data[key]
		if !ok || v == nil {
			return ""
		}
		switch vv := v.(type) {
		case string:
			return vv
		case float64:
			return fmt.Sprintf("%.0f", vv)
		}
		return ""
	}

	scalePrice := func(v float64) float64 {
		if v == 0 {
			return 0
		}
		// stock/get 价格字段为 ×100
		return v / 100
	}

	f57 := getString("f57")
	f58 := getString("f58")
	prevClose := scalePrice(getFloat("f60"))
	price := scalePrice(getFloat("f43"))
	// 休市/盘后 f43 常为 0，用昨收兜底以便仍能返回行业/概念/估值等元数据
	if price <= 0 && prevClose > 0 {
		price = prevClose
	}
	// stock/get: f170=涨跌幅×100，f169=涨跌额×100
	changePct := getFloat("f170") / 100
	changeAmt := scalePrice(getFloat("f169"))

	market := "SZ"
	if strings.HasPrefix(secid, "1.") {
		market = "SH"
	} else if strings.HasPrefix(f57, "8") || strings.HasPrefix(f57, "4") {
		market = "BJ"
	}

	pe := getFloat("f162")
	if pe != 0 {
		pe /= 100
	}
	pb := getFloat("f167")
	if pb != 0 {
		pb /= 100
	}
	turnover := getFloat("f168")
	if turnover != 0 {
		turnover /= 100
	}

	quote := &MarketQuote{
		Code:                 f57,
		Name:                 f58,
		Price:                price,
		ChangePercent:        changePct,
		Change:               changeAmt,
		Open:                 scalePrice(getFloat("f46")),
		High:                 scalePrice(getFloat("f44")),
		Low:                  scalePrice(getFloat("f45")),
		PrevClose:            prevClose,
		Volume:               getInt64("f47"),
		Amount:               getFloat("f48"),
		TurnoverRate:         turnover,
		TotalMarketCap:       getFloat("f116") / 100000000,
		CirculatingMarketCap: getFloat("f117") / 100000000,
		Pe:                   pe,
		Pb:                   pb,
		Market:               market,
		Industry:             getString("f127"),
		Concept:              getString("f128"),
		ListDate:             FormatListDate(getString("f189")),
	}

	if quote.Code == "" || quote.Name == "" || quote.Name == "-" {
		return nil, fmt.Errorf("invalid eastmoney quote for %s", code)
	}
	if quote.Price <= 0 && quote.Industry == "" && quote.ListDate == "" && quote.Pe == 0 && quote.Pb == 0 {
		return nil, fmt.Errorf("invalid eastmoney quote for %s", code)
	}
	if quote.Change == 0 && quote.ChangePercent != 0 && prevClose > 0 {
		quote.Change = prevClose * quote.ChangePercent / 100
	}

	return quote, nil
}

// EastMoneyQuoteListResponse 东方财富行情列表响应（兼容新旧两种 JSON 结构）
type EastMoneyQuoteListResponse struct {
	Rc     int `json:"rc"`
	Result struct {
		Data struct {
			Total int               `json:"total"`
			Diff  []json.RawMessage `json:"diff"`
		} `json:"data"`
	} `json:"result"`
	Data struct {
		Total int               `json:"total"`
		Diff  []json.RawMessage `json:"diff"`
	} `json:"data"`
	Success bool   `json:"success"`
	Message string `json:"message"`
	Code    int    `json:"code"`
}

func (r EastMoneyQuoteListResponse) quoteDiff() []json.RawMessage {
	if len(r.Data.Diff) > 0 {
		return r.Data.Diff
	}
	return r.Result.Data.Diff
}

const quotePageSize = 100

// GetAllAShareQuotes 获取全部A股行情
func (c *Client) GetAllAShareQuotes() ([]*MarketQuote, error) {
	var result []*MarketQuote

	// 数据字段：f2最新价,f3涨跌幅,f4涨跌额,f5成交量,f6成交额,f8换手率,f10量比,f9市盈率,f12代码,f14名称,f15最高价,f16最低价,f17开盘价,f18昨收,f20总市值,f21流通市值,f23市净率
	dataFields := "f2,f3,f4,f5,f6,f8,f9,f10,f12,f14,f15,f16,f17,f18,f20,f21,f23"

	// 获取沪A (主板 + 科创板)
	shQuotes, err := c.getMarketQuotes("m:1+t:2,m:1+t:23", dataFields, 1, quotePageSize)
	if err != nil {
		return nil, fmt.Errorf("get sh quotes failed: %w", err)
	}
	result = append(result, shQuotes...)

	// 获取深A
	szQuotes, err := c.getMarketQuotes("m:0+t:6,m:0+t:80", dataFields, 0, quotePageSize)
	if err != nil {
		return nil, fmt.Errorf("get sz quotes failed: %w", err)
	}
	result = append(result, szQuotes...)

	// 获取北交所
	bjQuotes, err := c.getMarketQuotes("m:0+t:81", dataFields, 2, quotePageSize)
	if err == nil {
		result = append(result, bjQuotes...)
	}

	return result, nil
}

func (c *Client) fetchQuoteListPage(params []string) ([]byte, error) {
	return c.fetchEastMoneyJSON(quoteListURL, params)
}

func (c *Client) fetchEastMoneyJSON(baseURL string, params []string) ([]byte, error) {
	query := strings.Join(params, "&")
	timeout := time.Duration(c.config.CrawlTimeOut) * time.Second
	if timeout <= 0 {
		timeout = 30 * time.Second
	}

	urls := []string{baseURL}
	switch baseURL {
	case quoteListURL:
		urls = append(urls, quoteListURLLegacy)
	case quoteStockURL:
		urls = append(urls, quoteStockURLLegacy)
	}

	for _, requestURL := range urls {
		host := strings.TrimPrefix(strings.TrimPrefix(requestURL, "https://"), "http://")
		if idx := strings.Index(host, "/"); idx >= 0 {
			host = host[:idx]
		}

		resp, err := c.httpClient.SetTimeout(timeout).R().
			SetHeader("Host", host).
			SetHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36").
			SetHeader("Referer", "https://quote.eastmoney.com/").
			SetHeader("Accept", "application/json").
			Get(requestURL + "?" + query)

		if err != nil {
			continue
		}
		if resp.StatusCode() != 200 || len(resp.Body()) == 0 {
			continue
		}
		return resp.Body(), nil
	}

	return nil, fmt.Errorf("eastmoney quote list request failed")
}

// getMarketQuotes 获取指定市场的行情
func (c *Client) getMarketQuotes(fs string, fields string, marketType int, pageSize int) ([]*MarketQuote, error) {
	var result []*MarketQuote

	pn := 1
	for {
		// 按正确顺序手动构造URL参数
		params := []string{
			"pn=" + fmt.Sprintf("%d", pn),
			"pz=" + fmt.Sprintf("%d", pageSize),
			"po=1",
			"np=1",
			"fltt=2",
			"invt=2",
			"fid=f3",
			"fs=" + fs,
			"fields=" + fields,
			"_=" + fmt.Sprintf("%d", time.Now().UnixMilli()),
		}
		body, err := c.fetchQuoteListPage(params)
		if err != nil {
			return nil, err
		}

		var emResp EastMoneyQuoteListResponse
		if err := json.Unmarshal(body, &emResp); err != nil {
			return nil, err
		}

		if len(emResp.quoteDiff()) == 0 {
			break
		}

		for _, raw := range emResp.quoteDiff() {
			quote, err := c.parseQuoteItem(raw, marketType)
			if err != nil {
				continue
			}
			if quote != nil {
				result = append(result, quote)
			}
		}

		if len(emResp.quoteDiff()) < pageSize {
			break
		}

		pn++
		if pn > 100 {
			break
		}
	}

	return result, nil
}

// parseQuoteItem 解析单个行情数据
// fields顺序: f2,f3,f4,f5,f6,f8,f9,f10,f12,f14,f15,f16,f17,f18,f20,f21,f23
func (c *Client) parseQuoteItem(raw json.RawMessage, marketType int) (*MarketQuote, error) {
	// EastMoney diff 通常是对象（f2/f3/...），历史上也可能出现数组形式，这里做双格式兼容。
	var obj map[string]any
	if err := json.Unmarshal(raw, &obj); err == nil && len(obj) > 0 {
		getFloatByKey := func(key string) float64 {
			v, ok := obj[key]
			if !ok || v == nil {
				return 0
			}
			switch vv := v.(type) {
			case float64:
				return vv
			case string:
				if f, err := strconv.ParseFloat(vv, 64); err == nil {
					return f
				}
			}
			return 0
		}
		getInt64ByKey := func(key string) int64 {
			v, ok := obj[key]
			if !ok || v == nil {
				return 0
			}
			switch vv := v.(type) {
			case float64:
				return int64(vv)
			case string:
				if i, err := strconv.ParseInt(vv, 10, 64); err == nil {
					return i
				}
			}
			return 0
		}
		getStringByKey := func(key string) string {
			v, ok := obj[key]
			if !ok || v == nil {
				return ""
			}
			switch vv := v.(type) {
			case string:
				return vv
			case float64:
				return fmt.Sprintf("%.0f", vv)
			}
			return ""
		}

		f2 := getFloatByKey("f2")
		f3 := getFloatByKey("f3")
		f4 := getFloatByKey("f4")
		f5 := getInt64ByKey("f5")
		f6 := getFloatByKey("f6")
		f8 := getFloatByKey("f8")
		f9 := getFloatByKey("f9")
		f10 := getFloatByKey("f10")
		f12 := getStringByKey("f12")
		f14 := getStringByKey("f14")
		f15 := getFloatByKey("f15")
		f16 := getFloatByKey("f16")
		f17 := getFloatByKey("f17")
		f18 := getFloatByKey("f18")
		f20 := getFloatByKey("f20")
		f21 := getFloatByKey("f21")
		f23 := getFloatByKey("f23")

		quote := &MarketQuote{
			Code:                 f12,
			Name:                 f14,
			Price:                f2,
			ChangePercent:        f3,
			Change:               f4,
			Open:                 f17,
			High:                 f15,
			Low:                  f16,
			PrevClose:            f18,
			Volume:               f5,
			Amount:               f6,
			TurnoverRate:         f8,
			VolumeRatio:          f10,
			CirculatingMarketCap: f21 / 100000000,
			TotalMarketCap:       f20 / 100000000,
			Pe:                   f9,
			Pb:                   f23,
		}

		if marketType == 1 {
			quote.Market = "SH"
		} else if marketType == 0 {
			quote.Market = "SZ"
		} else {
			quote.Market = "BJ"
		}
		if quote.Price <= 0 || quote.Code == "" || quote.Name == "" || quote.Name == "-" {
			return nil, fmt.Errorf("invalid quote")
		}
		return quote, nil
	}

	// 回退：兼容数组格式
	var data []any
	if err := json.Unmarshal(raw, &data); err != nil {
		return nil, err
	}
	if len(data) < 17 {
		return nil, fmt.Errorf("insufficient data")
	}
	getFloat := func(idx int) float64 {
		if idx >= len(data) {
			return 0
		}
		switch v := data[idx].(type) {
		case float64:
			return v
		case string:
			if f, err := strconv.ParseFloat(v, 64); err == nil {
				return f
			}
		}
		return 0
	}
	getInt64 := func(idx int) int64 {
		if idx >= len(data) {
			return 0
		}
		switch v := data[idx].(type) {
		case float64:
			return int64(v)
		case int64:
			return v
		case string:
			if i, err := strconv.ParseInt(v, 10, 64); err == nil {
				return i
			}
		}
		return 0
	}
	getString := func(idx int) string {
		if idx >= len(data) {
			return ""
		}
		switch v := data[idx].(type) {
		case string:
			return v
		case float64:
			return fmt.Sprintf("%.0f", v)
		}
		return ""
	}

	f2 := getFloat(0)
	f3 := getFloat(1)
	f4 := getFloat(2)
	f5 := getInt64(3)
	f6 := getFloat(4)
	f8 := getFloat(5)
	f9 := getFloat(6)
	f10 := getFloat(7)
	f12 := getString(8)
	f14 := getString(9)
	f15 := getFloat(10)
	f16 := getFloat(11)
	f17 := getFloat(12)
	f18 := getFloat(13)
	f20 := getFloat(14)
	f21 := getFloat(15)
	f23 := getFloat(16)

	quote := &MarketQuote{
		Code:                 f12,
		Name:                 f14,
		Price:                f2,
		ChangePercent:        f3,
		Change:               f4,
		Open:                 f17,
		High:                 f15,
		Low:                  f16,
		PrevClose:            f18,
		Volume:               f5,
		Amount:               f6,
		TurnoverRate:         f8,
		VolumeRatio:          f10,
		CirculatingMarketCap: f21 / 100000000,
		TotalMarketCap:       f20 / 100000000,
		Pe:                   f9,
		Pb:                   f23,
	}

	if marketType == 1 {
		quote.Market = "SH"
	} else if marketType == 0 {
		quote.Market = "SZ"
	} else {
		quote.Market = "BJ"
	}

	if quote.Price <= 0 || quote.Code == "" || quote.Name == "" || quote.Name == "-" {
		return nil, fmt.Errorf("invalid quote")
	}

	return quote, nil
}
