package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/components/tool/utils"
)

// THSTools 同花顺数据工具集
type THSTools struct {
	client   *http.Client
	lastCall time.Time
	minInterval time.Duration
}

// NewTHSTools 创建同花顺工具集
func NewTHSTools() *THSTools {
	return &THSTools{
		client: &http.Client{
			Timeout: 15 * time.Second,
		},
		minInterval: 1 * time.Second,
	}
}

// doGet 执行GET请求
func (t *THSTools) doGet(url string, params map[string]string) ([]byte, error) {
	t.throttle()
	
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	
	q := req.URL.Query()
	for k, v := range params {
		q.Add(k, v)
	}
	req.URL.RawQuery = q.Encode()
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
	req.Header.Set("Referer", "https://www.iwencai.com/")
	
	resp, err := t.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	return io.ReadAll(resp.Body)
}

// throttle 限流控制
func (t *THSTools) throttle() {
	elapsed := time.Since(t.lastCall)
	if elapsed < t.minInterval {
		time.Sleep(t.minInterval - elapsed + time.Duration(500)*time.Millisecond)
	}
	t.lastCall = time.Now()
}

// ============ 热点强势股 ============

// HotStock 热点强势股
type HotStock struct {
	Code       string  `json:"code"`
	Name       string  `json:"name"`
	Price      float64 `json:"price"`
	ChangePct  float64 `json:"change_pct"`
	Reason     string  `json:"reason"`
}

// GetHotStocks 获取热点强势股
func (t *THSTools) GetHotStocks(ctx context.Context, topN int) (string, error) {
	url := "https://dq.10jqka.com.cn/fuyao/hot_list_data/out/hot_list/v1/stock?stock_type=a&type=hour&list_type=normal"
	
	body, err := t.doGet(url, nil)
	if err != nil {
		return "", fmt.Errorf("request hot stocks failed: %w", err)
	}
	
	var result struct {
		Data struct {
			StockList []struct {
				Code      string  `json:"code"`
				Name      string  `json:"name"`
				Current   float64 `json:"current"`
				ChangePct float64 `json:"change_pct"`
				Reason    string  `json:"reason"`
			} `json:"stock_list"`
		} `json:"data"`
	}
	
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("parse hot stocks failed: %w", err)
	}
	
	var sb strings.Builder
	sb.WriteString("# 热点强势股\n\n")
	sb.WriteString("排名 | 代码 | 名称 | 现价 | 涨跌幅 | 热点原因\n")
	sb.WriteString("--- | --- | --- | --- | --- | ---\n")
	
	limit := topN
	if limit > len(result.Data.StockList) {
		limit = len(result.Data.StockList)
	}
	
	for i := 0; i < limit; i++ {
		stock := result.Data.StockList[i]
		sb.WriteString(fmt.Sprintf("%d | %s | %s | %.2f | %.2f%% | %s\n",
			i+1, stock.Code, stock.Name, stock.Current, stock.ChangePct, stock.Reason))
	}
	
	return sb.String(), nil
}

// NewGetHotStocksTool 创建热点强势股工具
func (t *THSTools) NewGetHotStocksTool() tool.InvokableTool {
	type Input struct {
		TopN int `json:"top_n" jsonschema_description:"显示前N只股票，默认10"`
	}
	
	tl, err := utils.InferTool(
		"get_hot_stocks",
		"获取同花顺热点强势股，显示当前市场热门股票和上涨原因",
		func(ctx context.Context, input *Input) (string, error) {
			topN := input.TopN
			if topN <= 0 {
				topN = 10
			}
			return t.GetHotStocks(ctx, topN)
		},
	)
	if err != nil {
		log.Fatalf("创建 get_hot_stocks 工具失败: %v", err)
	}
	return tl
}

// ============ 北向资金 ============

// NorthboundFlow 北向资金流向
type NorthboundFlow struct {
	Date         string  `json:"date"`
	ShConnect    float64 `json:"sh_connect"`    // 沪股通净流入
	SzConnect    float64 `json:"sz_connect"`    // 深股通净流入
	Total        float64 `json:"total"`         // 北向资金净流入
}

// GetNorthboundFlow 获取北向资金流向
func (t *THSTools) GetNorthboundFlow(ctx context.Context, days int) (string, error) {
	url := "https://datacenter-web.eastmoney.com/api/data/v1/get"
	params := map[string]string{
		"reportName":  "RPT_MUTUAL_DEAL_HISTORY",
		"columns":     "ALL",
		"filter":      "",
		"pageNumber":  "1",
		"pageSize":    fmt.Sprintf("%d", days),
		"sortColumns": "TRADE_DATE",
		"sortTypes":   "-1",
		"source":      "WEB",
		"client":      "WEB",
	}
	
	body, err := t.doGet(url, params)
	if err != nil {
		return "", fmt.Errorf("request northbound flow failed: %w", err)
	}
	
	var result struct {
		Result struct {
			Data []struct {
				TradeDate       string  `json:"TRADE_DATE"`
				MUTUAL_TYPE     string  `json:"MUTUAL_TYPE"`
				NET_DEAL_AMT    float64 `json:"NET_DEAL_AMT"`
			} `json:"data"`
		} `json:"result"`
	}
	
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("parse northbound flow failed: %w", err)
	}
	
	// 按日期汇总
	flowMap := make(map[string]float64)
	for _, rec := range result.Result.Data {
		date := rec.TradeDate[:10]
		flowMap[date] += rec.NET_DEAL_AMT / 1e8
	}
	
	var sb strings.Builder
	sb.WriteString("# 北向资金流向\n\n")
	sb.WriteString("日期 | 净流入(亿)\n")
	sb.WriteString("--- | ---\n")
	
	for date, flow := range flowMap {
		sb.WriteString(fmt.Sprintf("%s | %.2f\n", date, flow))
	}
	
	return sb.String(), nil
}

// NewGetNorthboundFlowTool 创建北向资金工具
func (t *THSTools) NewGetNorthboundFlowTool() tool.InvokableTool {
	type Input struct {
		Days int `json:"days" jsonschema_description:"查询天数，默认10"`
	}
	
	tl, err := utils.InferTool(
		"get_northbound_flow",
		"获取北向资金流向(沪股通+深股通)，分析外资动向",
		func(ctx context.Context, input *Input) (string, error) {
			days := input.Days
			if days <= 0 {
				days = 10
			}
			return t.GetNorthboundFlow(ctx, days)
		},
	)
	if err != nil {
		log.Fatalf("创建 get_northbound_flow 工具失败: %v", err)
	}
	return tl
}

// ============ 一致预期 ============

// ProfitForecast 一致预期
type ProfitForecast struct {
	Code          string  `json:"code"`
	Name          string  `json:"name"`
	CurrentYearEps float64 `json:"current_year_eps"`
	NextYearEps   float64 `json:"next_year_eps"`
	CurrentYearPe  float64 `json:"current_year_pe"`
	NextYearPe    float64 `json:"next_year_pe"`
	TargetPrice   float64 `json:"target_price"`
	RatingCount   int     `json:"rating_count"`
	BuyCount      int     `json:"buy_count"`
}

// GetProfitForecast 获取个股一致预期
func (t *THSTools) GetProfitForecast(ctx context.Context, code string) (string, error) {
	url := fmt.Sprintf("https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_WEB_RESPREDICT&columns=ALL&filter=(SECURITY_CODE%%3D%%22%s%%22)&pageNumber=1&pageSize=1&sortColumns=REPORT_DATE&sortTypes=-1&source=WEB&client=WEB", code)
	
	body, err := t.doGet(url, nil)
	if err != nil {
		return "", fmt.Errorf("request profit forecast failed: %w", err)
	}
	
	var result struct {
		Result struct {
			Data []struct {
				SecurityCode    string  `json:"SECURITY_CODE"`
				SecurityName    string  `json:"SECURITY_NAME_ABBR"`
				EpsLastYear     float64 `json:"EPSLASTYEAR"`
				EpsThisYear     float64 `json:"EPSTHISYEAR"`
				EpsNextYear     float64 `json:"EPSNEXTYEAR"`
				PeLastYear      float64 `json:"PELASTYEAR"`
				PeThisYear      float64 `json:"PETHISYEAR"`
				PeNextYear      float64 `json:"PENEXTYEAR"`
				 PredictedPrice string  `json:"PREDICTED_PRICE"`
				TotalRating     int     `json:"TOTAL_RATING"`
				BuyRating       int     `json:"BUY_RATING"`
			} `json:"data"`
		} `json:"result"`
	}
	
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("parse profit forecast failed: %w", err)
	}
	
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("# 一致预期 | %s\n\n", code))
	
	if len(result.Result.Data) == 0 {
		sb.WriteString("无一致预期数据\n")
	} else {
		data := result.Result.Data[0]
		sb.WriteString(fmt.Sprintf("**公司**: %s\n\n", data.SecurityName))
		sb.WriteString("指标 | 今年预测 | 明年预测\n")
		sb.WriteString("--- | --- | ---\n")
		sb.WriteString(fmt.Sprintf("EPS(元) | %.2f | %.2f\n", data.EpsThisYear, data.EpsNextYear))
		sb.WriteString(fmt.Sprintf("PE(倍) | %.2f | %.2f\n", data.PeThisYear, data.PeNextYear))
		sb.WriteString(fmt.Sprintf("\n**目标价**: %s\n", data.PredictedPrice))
		sb.WriteString(fmt.Sprintf("**评级**: 买入%d家，共%d家\n", data.BuyRating, data.TotalRating))
	}
	
	return sb.String(), nil
}

// NewGetProfitForecastTool 创建一致预期工具
func (t *THSTools) NewGetProfitForecastTool() tool.InvokableTool {
	type Input struct {
		Code string `json:"code" jsonschema_description:"股票代码，如 600519"`
	}
	
	tl, err := utils.InferTool(
		"get_profit_forecast",
		"获取个股一致预期，显示机构对EPS、PE的预测和目标价",
		func(ctx context.Context, input *Input) (string, error) {
			return t.GetProfitForecast(ctx, input.Code)
		},
	)
	if err != nil {
		log.Fatalf("创建 get_profit_forecast 工具失败: %v", err)
	}
	return tl
}

// GetAllTools 获取所有同花顺工具
func (t *THSTools) GetAllTools() []tool.BaseTool {
	return []tool.BaseTool{
		t.NewGetHotStocksTool(),
		t.NewGetNorthboundFlowTool(),
		t.NewGetProfitForecastTool(),
	}
}
