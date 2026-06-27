package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/components/tool/utils"
)

// EastMoneyTools 东财数据工具集
type EastMoneyTools struct {
	client   *http.Client
	lastCall time.Time
	minInterval time.Duration
}

// NewEastMoneyTools 创建东财工具集
func NewEastMoneyTools() *EastMoneyTools {
	return &EastMoneyTools{
		client: &http.Client{
			Timeout: 15 * time.Second,
		},
		minInterval: 1 * time.Second,
	}
}

// doGet 执行GET请求
func (e *EastMoneyTools) doGet(url string, params map[string]string) ([]byte, error) {
	e.throttle()
	
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
	req.Header.Set("Referer", "https://quote.eastmoney.com/")
	
	resp, err := e.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	return io.ReadAll(resp.Body)
}

// throttle 限流控制
func (e *EastMoneyTools) throttle() {
	elapsed := time.Since(e.lastCall)
	if elapsed < e.minInterval {
		time.Sleep(e.minInterval - elapsed + time.Duration(500)*time.Millisecond)
	}
	e.lastCall = time.Now()
}

// ============ 龙虎榜 ============

// DragonTigerRecord 龙虎榜记录
type DragonTigerRecord struct {
	Date       string  `json:"date"`
	Code       string  `json:"code"`
	Name       string  `json:"name"`
	Reason     string  `json:"reason"`
	NetBuy     float64 `json:"net_buy"`     // 净买入(亿)
	TurnoverRate float64 `json:"turnover_rate"`
}

// GetDragonTigerBoard 获取龙虎榜数据
func (e *EastMoneyTools) GetDragonTigerBoard(ctx context.Context, code string, lookBackDays int) (string, error) {
	// 计算日期范围
	endDate := time.Now().Format("2006-01-02")
	startDate := time.Now().AddDate(0, 0, -lookBackDays).Format("2006-01-02")

	url := "https://datacenter-web.eastmoney.com/api/data/v1/get"
	params := map[string]string{
		"reportName":  "RPT_DAILYBILLBOARD_DETAILSNEW",
		"columns":     "ALL",
		"filter":      fmt.Sprintf("(TRADE_DATE>='%s')(TRADE_DATE<='%s')(SECURITY_CODE=\"%s\")", startDate, endDate, code),
		"pageNumber":  "1",
		"pageSize":    "50",
		"sortColumns": "TRADE_DATE",
		"sortTypes":   "-1",
		"source":      "WEB",
		"client":      "WEB",
	}

	body, err := e.doGet(url, params)
	if err != nil {
		return "", fmt.Errorf("request dragon tiger failed: %w", err)
	}

	var result struct {
		Result struct {
			Data []struct {
				TradeDate       string  `json:"TRADE_DATE"`
				SecurityCode    string  `json:"SECURITY_CODE"`
				SecurityName    string  `json:"SECURITY_NAME_ABBR"`
				Explanation     string  `json:"EXPLANATION"`
				BillboardNetAmt float64 `json:"BILLBOARD_NET_AMT"`
				TurnoverRate    float64 `json:"TURNOVERRATE"`
			} `json:"data"`
		} `json:"result"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("parse dragon tiger failed: %w", err)
	}

	if len(result.Result.Data) == 0 {
		return fmt.Sprintf("# 龙虎榜 | %s\n\n近%d日无龙虎榜记录", code, lookBackDays), nil
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("# 龙虎榜 | %s\n\n", code))
	sb.WriteString(fmt.Sprintf("近%d日上榜 %d 次\n\n", lookBackDays, len(result.Result.Data)))
	sb.WriteString("日期 | 原因 | 净买入(亿)\n")
	sb.WriteString("--- | --- | ---\n")

	for _, rec := range result.Result.Data {
		date := rec.TradeDate[:10]
		netBuy := rec.BillboardNetAmt / 1e8
		reason := rec.Explanation
		if len(reason) > 30 {
			reason = reason[:30] + "..."
		}
		sb.WriteString(fmt.Sprintf("%s | %s | %.2f\n", date, reason, netBuy))
	}

	return sb.String(), nil
}

// NewGetDragonTigerBoardTool 创建龙虎榜工具
func (e *EastMoneyTools) NewGetDragonTigerBoardTool() tool.InvokableTool {
	type Input struct {
		Code          string `json:"code" jsonschema_description:"股票代码，如 600519"`
		LookBackDays  int    `json:"look_back_days" jsonschema_description:"回看天数，默认30"`
	}

	t, err := utils.InferTool(
		"get_dragon_tiger_board",
		"获取龙虎榜数据，显示个股上榜记录、买卖席位和机构动向",
		func(ctx context.Context, input *Input) (string, error) {
			days := input.LookBackDays
			if days <= 0 {
				days = 30
			}
			return e.GetDragonTigerBoard(ctx, input.Code, days)
		},
	)
	if err != nil {
		log.Fatalf("创建 get_dragon_tiger_board 工具失败: %v", err)
	}
	return t
}

// ============ 全市场龙虎榜 ============

// GetDailyDragonTiger 获取全市场龙虎榜
func (e *EastMoneyTools) GetDailyDragonTiger(ctx context.Context, tradeDate string, minNetBuy float64) (string, error) {
	url := "https://datacenter-web.eastmoney.com/api/data/v1/get"
	params := map[string]string{
		"reportName":  "RPT_DAILYBILLBOARD_DETAILSNEW",
		"columns":     "ALL",
		"filter":      fmt.Sprintf("(TRADE_DATE='%s')", tradeDate),
		"pageNumber":  "1",
		"pageSize":    "50",
		"sortColumns": "BILLBOARD_NET_AMT",
		"sortTypes":   "-1",
		"source":      "WEB",
		"client":      "WEB",
	}

	body, err := e.doGet(url, params)
	if err != nil {
		return "", fmt.Errorf("request daily dragon tiger failed: %w", err)
	}

	var result struct {
		Result struct {
			Data []struct {
				SecurityCode    string  `json:"SECURITY_CODE"`
				SecurityName    string  `json:"SECURITY_NAME_ABBR"`
				Explanation     string  `json:"EXPLANATION"`
				BillboardNetAmt float64 `json:"BILLBOARD_NET_AMT"`
			} `json:"data"`
		} `json:"result"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("parse daily dragon tiger failed: %w", err)
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("# 全市场龙虎榜 | %s\n\n", tradeDate))

	count := 0
	sb.WriteString("排名 | 代码 | 名称 | 净买额(亿) | 上榜原因\n")
	sb.WriteString("--- | --- | --- | --- | ---\n")

	for i, rec := range result.Result.Data {
		netBuy := rec.BillboardNetAmt / 1e8
		if minNetBuy > 0 && netBuy < minNetBuy {
			continue
		}
		count++
		reason := rec.Explanation
		if len(reason) > 25 {
			reason = reason[:25] + "..."
		}
		sb.WriteString(fmt.Sprintf("%d | %s | %s | %.2f | %s\n",
			i+1, rec.SecurityCode, rec.SecurityName, netBuy, reason))
	}

	sb.WriteString(fmt.Sprintf("\n共 %d 只上榜", count))
	return sb.String(), nil
}

// NewGetDailyDragonTigerTool 创建全市场龙虎榜工具
func (e *EastMoneyTools) NewGetDailyDragonTigerTool() tool.InvokableTool {
	type Input struct {
		TradeDate  string  `json:"trade_date" jsonschema_description:"交易日期，格式 YYYY-MM-DD"`
		MinNetBuy  float64 `json:"min_net_buy" jsonschema_description:"最小净买入额(亿)，默认0"`
	}

	t, err := utils.InferTool(
		"get_daily_dragon_tiger",
		"获取全市场龙虎榜，显示当日所有上榜股票和净买入排名",
		func(ctx context.Context, input *Input) (string, error) {
			return e.GetDailyDragonTiger(ctx, input.TradeDate, input.MinNetBuy)
		},
	)
	if err != nil {
		log.Fatalf("创建 get_daily_dragon_tiger 工具失败: %v", err)
	}
	return t
}

// ============ 板块归属 ============

// ConceptBlock 板块信息
type ConceptBlock struct {
	Name       string  `json:"name"`
	Code       string  `json:"code"`
	ChangePct  float64 `json:"change_pct"`
	LeadStock  string  `json:"lead_stock"`
}

// GetConceptBlocks 获取个股所属板块
func (e *EastMoneyTools) GetConceptBlocks(ctx context.Context, code string) (string, error) {
	marketCode := 1
	if !strings.HasPrefix(code, "6") {
		marketCode = 0
	}

	url := "https://push2.eastmoney.com/api/qt/slist/get"
	params := map[string]string{
		"fltt":   "2",
		"invt":   "2",
		"secid":  fmt.Sprintf("%d.%s", marketCode, code),
		"spt":    "3",
		"pi":     "0",
		"pz":     "200",
		"po":     "1",
		"fields": "f12,f14,f3,f128",
	}

	body, err := e.doGet(url, params)
	if err != nil {
		return "", fmt.Errorf("request concept blocks failed: %w", err)
	}

	var result struct {
		Data struct {
			Diff map[string]struct {
				F12 string  `json:"f12"` // 板块代码
				F14 string  `json:"f14"` // 板块名
				F3  float64 `json:"f3"`  // 涨跌幅
				F128 string `json:"f128"` // 龙头股
			} `json:"diff"`
		} `json:"data"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("parse concept blocks failed: %w", err)
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("# 板块归属 | %s\n\n", code))

	tags := []string{}
	for _, block := range result.Data.Diff {
		tags = append(tags, block.F14)
	}

	if len(tags) == 0 {
		sb.WriteString("无板块数据\n")
	} else {
		sb.WriteString(fmt.Sprintf("共 %d 个板块:\n\n", len(tags)))
		sb.WriteString("板块名 | 涨跌幅 | 龙头股\n")
		sb.WriteString("--- | --- | ---\n")
		for _, block := range result.Data.Diff {
			sb.WriteString(fmt.Sprintf("%s | %.2f%% | %s\n", block.F14, block.F3, block.F128))
		}
	}

	return sb.String(), nil
}

// NewGetConceptBlocksTool 创建板块归属工具
func (e *EastMoneyTools) NewGetConceptBlocksTool() tool.InvokableTool {
	type Input struct {
		Code string `json:"code" jsonschema_description:"股票代码，如 600519"`
	}

	t, err := utils.InferTool(
		"get_concept_blocks",
		"获取个股所属板块/概念归属，包括行业、概念、地域分类",
		func(ctx context.Context, input *Input) (string, error) {
			return e.GetConceptBlocks(ctx, input.Code)
		},
	)
	if err != nil {
		log.Fatalf("创建 get_concept_blocks 工具失败: %v", err)
	}
	return t
}

// ============ 资金流向(分钟级) ============

// FundFlowItem 资金流向记录
type FundFlowItem struct {
	Time     string  `json:"time"`
	MainNet  float64 `json:"main_net"`  // 主力净流入
	SuperNet float64 `json:"super_net"` // 超大单净流入
	LargeNet float64 `json:"large_net"` // 大单净流入
	MidNet   float64 `json:"mid_net"`   // 中单净流入
	SmallNet float64 `json:"small_net"` // 小单净流入
}

// GetFundFlow 获取个股资金流向(分钟级)
func (e *EastMoneyTools) GetFundFlow(ctx context.Context, code string) (string, error) {
	marketCode := 1
	if !strings.HasPrefix(code, "6") {
		marketCode = 0
	}

	url := "https://push2.eastmoney.com/api/qt/stock/fflow/kline/get"
	params := map[string]string{
		"secid":    fmt.Sprintf("%d.%s", marketCode, code),
		"klt":      "1",
		"fields1":  "f1,f2,f3,f7",
		"fields2":  "f51,f52,f53,f54,f55,f56,f57",
	}

	body, err := e.doGet(url, params)
	if err != nil {
		return "", fmt.Errorf("request fund flow failed: %w", err)
	}

	var result struct {
		Data struct {
			Klines []string `json:"klines"`
		} `json:"data"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("parse fund flow failed: %w", err)
	}

	if len(result.Data.Klines) == 0 {
		return fmt.Sprintf("# 资金流向 | %s\n\n无分钟级资金流数据", code), nil
	}

	// 解析并汇总
	totalMain := 0.0
	totalSuper := 0.0
	var recentItems []string

	for _, line := range result.Data.Klines {
		parts := strings.Split(line, ",")
		if len(parts) < 6 {
			continue
		}
		mainNet, _ := strconv.ParseFloat(parts[1], 64)
		superNet, _ := strconv.ParseFloat(parts[5], 64)

		totalMain += mainNet
		totalSuper += superNet

		// 最近5条
		if len(recentItems) < 5 {
			recentItems = append(recentItems, fmt.Sprintf("  %s: 主力=%s 超大单=%s",
				parts[0], formatAmount(mainNet), formatAmount(superNet)))
		}
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("# 资金流向(分钟级) | %s\n\n", code))
	sb.WriteString("今日分钟级资金流向:\n")
	for _, item := range recentItems {
		sb.WriteString(item + "\n")
	}

	sb.WriteString(fmt.Sprintf("\n**主力累计净流入**: %s\n", formatAmount(totalMain)))
	sb.WriteString(fmt.Sprintf("**超大单累计净流入**: %s\n", formatAmount(totalSuper)))

	if totalMain > 0 {
		sb.WriteString("**判断**: 主力资金净流入，看多\n")
	} else {
		sb.WriteString("**判断**: 主力资金净流出，看空\n")
	}

	return sb.String(), nil
}

// formatAmount 格式化金额
func formatAmount(amount float64) string {
	abs := amount
	if abs < 0 {
		abs = -abs
	}
	if abs >= 1e8 {
		return fmt.Sprintf("%.2f亿", amount/1e8)
	} else if abs >= 1e4 {
		return fmt.Sprintf("%.0f万", amount/1e4)
	}
	return fmt.Sprintf("%.0f元", amount)
}

// NewGetFundFlowTool 创建资金流向工具
func (e *EastMoneyTools) NewGetFundFlowTool() tool.InvokableTool {
	type Input struct {
		Code string `json:"code" jsonschema_description:"股票代码，如 600519"`
	}

	t, err := utils.InferTool(
		"get_fund_flow",
		"获取个股资金流向(分钟级)，显示主力/超大单/大单/中单/小单净流入",
		func(ctx context.Context, input *Input) (string, error) {
			return e.GetFundFlow(ctx, input.Code)
		},
	)
	if err != nil {
		log.Fatalf("创建 get_fund_flow 工具失败: %v", err)
	}
	return t
}

// ============ 资金流向(120日) ============

// GetFundFlow120d 获取个股120日资金流向
func (e *EastMoneyTools) GetFundFlow120d(ctx context.Context, code string) (string, error) {
	marketCode := 1
	if !strings.HasPrefix(code, "6") {
		marketCode = 0
	}

	url := "https://push2his.eastmoney.com/api/qt/stock/fflow/daykline/get"
	params := map[string]string{
		"secid":   fmt.Sprintf("%d.%s", marketCode, code),
		"lmt":     "0",
		"klt":     "101",
		"fields1": "f1,f2,f3,f7",
		"fields2": "f51,f52,f53,f54,f55,f56,f57",
	}

	body, err := e.doGet(url, params)
	if err != nil {
		return "", fmt.Errorf("request fund flow 120d failed: %w", err)
	}

	var result struct {
		Data struct {
			Klines []string `json:"klines"`
		} `json:"data"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("parse fund flow 120d failed: %w", err)
	}

	if len(result.Data.Klines) == 0 {
		return fmt.Sprintf("# 资金流向(120日) | %s\n\n无数据", code), nil
	}

	// 计算近20日累计
	totalMain20 := 0.0
	totalSuper20 := 0.0
	klines := result.Data.Klines
	start := 0
	if len(klines) > 20 {
		start = len(klines) - 20
	}

	for _, line := range klines[start:] {
		parts := strings.Split(line, ",")
		if len(parts) < 6 {
			continue
		}
		mainNet, _ := strconv.ParseFloat(parts[1], 64)
		superNet, _ := strconv.ParseFloat(parts[5], 64)
		totalMain20 += mainNet
		totalSuper20 += superNet
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("# 资金流向(120日) | %s\n\n", code))
	sb.WriteString(fmt.Sprintf("共 %d 个交易日数据\n\n", len(klines)))
	sb.WriteString(fmt.Sprintf("**近20日主力累计净流入**: %s\n", formatAmount(totalMain20)))
	sb.WriteString(fmt.Sprintf("**近20日超大单累计净流入**: %s\n", formatAmount(totalSuper20)))

	if totalMain20 > 0 {
		sb.WriteString("**判断**: 主力资金净流入，看多\n")
	} else {
		sb.WriteString("**判断**: 主力资金净流出，看空\n")
	}

	return sb.String(), nil
}

// NewGetFundFlow120dTool 创建120日资金流向工具
func (e *EastMoneyTools) NewGetFundFlow120dTool() tool.InvokableTool {
	type Input struct {
		Code string `json:"code" jsonschema_description:"股票代码，如 600519"`
	}

	t, err := utils.InferTool(
		"get_fund_flow_120d",
		"获取个股120日资金流向历史，显示主力/超大单累计净流入趋势",
		func(ctx context.Context, input *Input) (string, error) {
			return e.GetFundFlow120d(ctx, input.Code)
		},
	)
	if err != nil {
		log.Fatalf("创建 get_fund_flow_120d 工具失败: %v", err)
	}
	return t
}

// ============ 行业排名 ============

// GetIndustryComparison 获取行业板块排名
func (e *EastMoneyTools) GetIndustryComparison(ctx context.Context, topN int) (string, error) {
	url := "https://push2.eastmoney.com/api/qt/clist/get"
	params := map[string]string{
		"pn":     "1",
		"pz":     "100",
		"po":     "1",
		"np":     "1",
		"fltt":   "2",
		"invt":   "2",
		"fs":     "m:90+t:2",
		"fields": "f2,f3,f4,f12,f13,f14,f104,f105,f128,f136,f140,f141,f207",
	}

	body, err := e.doGet(url, params)
	if err != nil {
		return "", fmt.Errorf("request industry comparison failed: %w", err)
	}

	var result struct {
		Data struct {
			Diff []struct {
				F14  string  `json:"f14"`  // 行业名
				F3   float64 `json:"f3"`   // 涨跌幅
				F104 int     `json:"f104"` // 上涨家数
				F105 int     `json:"f105"` // 下跌家数
				F140 string  `json:"f140"` // 领涨股
			} `json:"diff"`
		} `json:"data"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("parse industry comparison failed: %w", err)
	}

	var sb strings.Builder
	sb.WriteString("# 行业板块排名\n\n")
	sb.WriteString("排名 | 行业 | 涨跌幅 | 上涨 | 下跌 | 领涨股\n")
	sb.WriteString("--- | --- | --- | --- | --- | ---\n")

	limit := topN * 2
	if limit > len(result.Data.Diff) {
		limit = len(result.Data.Diff)
	}

	for i := 0; i < limit; i++ {
		rec := result.Data.Diff[i]
		sb.WriteString(fmt.Sprintf("%d | %s | %.2f%% | %d | %d | %s\n",
			i+1, rec.F14, rec.F3, rec.F104, rec.F105, rec.F140))
		if i >= topN-1 && i < limit-1 {
			sb.WriteString("--- | --- | --- | --- | --- | ---\n")
		}
	}

	return sb.String(), nil
}

// NewGetIndustryComparisonTool 创建行业排名工具
func (e *EastMoneyTools) NewGetIndustryComparisonTool() tool.InvokableTool {
	type Input struct {
		TopN int `json:"top_n" jsonschema_description:"显示前N个行业，默认10"`
	}

	t, err := utils.InferTool(
		"get_industry_comparison",
		"获取行业板块涨跌排名，显示哪些行业在涨/跌，资金流向",
		func(ctx context.Context, input *Input) (string, error) {
			topN := input.TopN
			if topN <= 0 {
				topN = 10
			}
			return e.GetIndustryComparison(ctx, topN)
		},
	)
	if err != nil {
		log.Fatalf("创建 get_industry_comparison 工具失败: %v", err)
	}
	return t
}

// ============ 限售解禁 ============

// GetLockupExpiry 获取限售解禁数据
func (e *EastMoneyTools) GetLockupExpiry(ctx context.Context, code string, forwardDays int) (string, error) {
	endDate := time.Now().AddDate(0, 0, forwardDays).Format("2006-01-02")

	url := "https://datacenter-web.eastmoney.com/api/data/v1/get"
	params := map[string]string{
		"reportName":  "RPT_LIFT_STAGE",
		"columns":     "ALL",
		"filter":      fmt.Sprintf("(SECURITY_CODE=\"%s\")(FREE_DATE>='%s')(FREE_DATE<='%s')", code, time.Now().Format("2006-01-02"), endDate),
		"pageNumber":  "1",
		"pageSize":    "20",
		"sortColumns": "FREE_DATE",
		"sortTypes":   "1",
		"source":      "WEB",
		"client":      "WEB",
	}

	body, err := e.doGet(url, params)
	if err != nil {
		return "", fmt.Errorf("request lockup expiry failed: %w", err)
	}

	var result struct {
		Result struct {
			Data []struct {
				FreeDate        string  `json:"FREE_DATE"`
				LimitedType     string  `json:"LIMITED_STOCK_TYPE"`
				FreeSharesNum   float64 `json:"FREE_SHARES_NUM"`
				FreeRatio       float64 `json:"FREE_RATIO"`
			} `json:"data"`
		} `json:"result"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("parse lockup expiry failed: %w", err)
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("# 限售解禁 | %s\n\n", code))

	if len(result.Result.Data) == 0 {
		sb.WriteString(fmt.Sprintf("未来%d天无限售解禁\n", forwardDays))
	} else {
		sb.WriteString(fmt.Sprintf("未来%d天有 %d 笔解禁:\n\n", forwardDays, len(result.Result.Data)))
		sb.WriteString("日期 | 类型 | 解禁数量(万股) | 占比\n")
		sb.WriteString("--- | --- | --- | ---\n")
		for _, rec := range result.Result.Data {
			date := rec.FreeDate[:10]
			shares := rec.FreeSharesNum / 10000
			sb.WriteString(fmt.Sprintf("%s | %s | %.2f | %.2f%%\n",
				date, rec.LimitedType, shares, rec.FreeRatio))
		}
	}

	return sb.String(), nil
}

// NewGetLockupExpiryTool 创建限售解禁工具
func (e *EastMoneyTools) NewGetLockupExpiryTool() tool.InvokableTool {
	type Input struct {
		Code         string `json:"code" jsonschema_description:"股票代码，如 600519"`
		ForwardDays  int    `json:"forward_days" jsonschema_description:"预测天数，默认90"`
	}

	t, err := utils.InferTool(
		"get_lockup_expiry",
		"获取限售解禁数据，显示未来解禁日期、数量和占比",
		func(ctx context.Context, input *Input) (string, error) {
			days := input.ForwardDays
			if days <= 0 {
				days = 90
			}
			return e.GetLockupExpiry(ctx, input.Code, days)
		},
	)
	if err != nil {
		log.Fatalf("创建 get_lockup_expiry 工具失败: %v", err)
	}
	return t
}

// ============ 融资融券 ============

// GetMarginTrading 获取融资融券数据
func (e *EastMoneyTools) GetMarginTrading(ctx context.Context, code string, days int) (string, error) {
	url := "https://datacenter-web.eastmoney.com/api/data/v1/get"
	params := map[string]string{
		"reportName":  "RPTA_WEB_RZRQ_GGMX",
		"columns":     "ALL",
		"filter":      fmt.Sprintf("(SCODE=\"%s\")", code),
		"pageNumber":  "1",
		"pageSize":    strconv.Itoa(days),
		"sortColumns": "DATE",
		"sortTypes":   "-1",
		"source":      "WEB",
		"client":      "WEB",
	}

	body, err := e.doGet(url, params)
	if err != nil {
		return "", fmt.Errorf("request margin trading failed: %w", err)
	}

	var result struct {
		Result struct {
			Data []struct {
				Date   string  `json:"DATE"`
				Rzye   float64 `json:"RZYE"`   // 融资余额
				Rzmre  float64 `json:"RZMRE"`  // 融资买入额
				Rqye   float64 `json:"RQYE"`   // 融券余额
			} `json:"data"`
		} `json:"result"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("parse margin trading failed: %w", err)
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("# 融资融券 | %s\n\n", code))

	if len(result.Result.Data) == 0 {
		sb.WriteString("无融资融券数据\n")
	} else {
		sb.WriteString("日期 | 融资余额(亿) | 融资买入(亿) | 融券余额(亿)\n")
		sb.WriteString("--- | --- | --- | ---\n")
		for _, rec := range result.Result.Data {
			date := rec.Date[:10]
			sb.WriteString(fmt.Sprintf("%s | %.2f | %.2f | %.2f\n",
				date, rec.Rzye/1e8, rec.Rzmre/1e8, rec.Rqye/1e8))
		}

		// 趋势
		if len(result.Result.Data) >= 2 {
			first := result.Result.Data[len(result.Result.Data)-1].Rzye
			last := result.Result.Data[0].Rzye
			change := last - first
			if change > 0 {
				sb.WriteString(fmt.Sprintf("\n**趋势**: 融资余额增加 %.2f亿\n", change/1e8))
			} else {
				sb.WriteString(fmt.Sprintf("\n**趋势**: 融资余额减少 %.2f亿\n", -change/1e8))
			}
		}
	}

	return sb.String(), nil
}

// NewGetMarginTradingTool 创建融资融券工具
func (e *EastMoneyTools) NewGetMarginTradingTool() tool.InvokableTool {
	type Input struct {
		Code  string `json:"code" jsonschema_description:"股票代码，如 600519"`
		Days  int    `json:"days" jsonschema_description:"查询天数，默认30"`
	}

	t, err := utils.InferTool(
		"get_margin_trading",
		"获取融资融券数据，显示融资余额、买入额、融券余额变化趋势",
		func(ctx context.Context, input *Input) (string, error) {
			days := input.Days
			if days <= 0 {
				days = 30
			}
			return e.GetMarginTrading(ctx, input.Code, days)
		},
	)
	if err != nil {
		log.Fatalf("创建 get_margin_trading 工具失败: %v", err)
	}
	return t
}

// ============ 大宗交易 ============

// GetBlockTrade 获取大宗交易数据
func (e *EastMoneyTools) GetBlockTrade(ctx context.Context, code string, days int) (string, error) {
	url := "https://datacenter-web.eastmoney.com/api/data/v1/get"
	params := map[string]string{
		"reportName":  "RPT_DATA_BLOCKTRADE",
		"columns":     "ALL",
		"filter":      fmt.Sprintf("(SECURITY_CODE=\"%s\")", code),
		"pageNumber":  "1",
		"pageSize":    strconv.Itoa(days),
		"sortColumns": "TRADE_DATE",
		"sortTypes":   "-1",
		"source":      "WEB",
		"client":      "WEB",
	}

	body, err := e.doGet(url, params)
	if err != nil {
		return "", fmt.Errorf("request block trade failed: %w", err)
	}

	var result struct {
		Result struct {
			Data []struct {
				TradeDate  string  `json:"TRADE_DATE"`
				DealPrice  float64 `json:"DEAL_PRICE"`
				ClosePrice float64 `json:"CLOSE_PRICE"`
				DealVolume float64 `json:"DEAL_VOLUME"`
				BuyerName  string  `json:"BUYER_NAME"`
				SellerName string  `json:"SELLER_NAME"`
			} `json:"data"`
		} `json:"result"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("parse block trade failed: %w", err)
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("# 大宗交易 | %s\n\n", code))

	if len(result.Result.Data) == 0 {
		sb.WriteString("无大宗交易记录\n")
	} else {
		sb.WriteString("日期 | 价格 | 溢价 | 量(万股) | 买方 | 卖方\n")
		sb.WriteString("--- | --- | --- | --- | --- | ---\n")
		for _, rec := range result.Result.Data {
			date := rec.TradeDate[:10]
			premium := 0.0
			if rec.ClosePrice > 0 {
				premium = (rec.DealPrice/rec.ClosePrice - 1) * 100
			}
			vol := rec.DealVolume / 10000
			buyer := rec.BuyerName
			if len(buyer) > 15 {
				buyer = buyer[:15] + "..."
			}
			seller := rec.SellerName
			if len(seller) > 15 {
				seller = seller[:15] + "..."
			}
			sb.WriteString(fmt.Sprintf("%s | %.2f | %+.1f%% | %.0f | %s | %s\n",
				date, rec.DealPrice, premium, vol, buyer, seller))
		}
	}

	return sb.String(), nil
}

// NewGetBlockTradeTool 创建大宗交易工具
func (e *EastMoneyTools) NewGetBlockTradeTool() tool.InvokableTool {
	type Input struct {
		Code string `json:"code" jsonschema_description:"股票代码，如 600519"`
		Days int    `json:"days" jsonschema_description:"查询天数，默认30"`
	}

	t, err := utils.InferTool(
		"get_block_trade",
		"获取大宗交易记录，显示成交价格、溢价率、买卖方营业部",
		func(ctx context.Context, input *Input) (string, error) {
			days := input.Days
			if days <= 0 {
				days = 30
			}
			return e.GetBlockTrade(ctx, input.Code, days)
		},
	)
	if err != nil {
		log.Fatalf("创建 get_block_trade 工具失败: %v", err)
	}
	return t
}

// ============ 股东户数 ============

// GetHolderCount 获取股东户数变化
func (e *EastMoneyTools) GetHolderCount(ctx context.Context, code string) (string, error) {
	url := "https://datacenter-web.eastmoney.com/api/data/v1/get"
	params := map[string]string{
		"reportName":  "RPT_HOLDERNUMLATEST",
		"columns":     "ALL",
		"filter":      fmt.Sprintf("(SECURITY_CODE=\"%s\")", code),
		"pageNumber":  "1",
		"pageSize":    "8",
		"sortColumns": "END_DATE",
		"sortTypes":   "-1",
		"source":      "WEB",
		"client":      "WEB",
	}

	body, err := e.doGet(url, params)
	if err != nil {
		return "", fmt.Errorf("request holder count failed: %w", err)
	}

	var result struct {
		Result struct {
			Data []struct {
				EndDate          string  `json:"END_DATE"`
				HolderNum        int     `json:"HOLDER_NUM"`
				HolderNumChange  int     `json:"HOLDER_NUM_CHANGE"`
				HolderNumRatio   float64 `json:"HOLDER_NUM_RATIO"`
				AvgFreeShares    float64 `json:"AVG_FREE_SHARES"`
			} `json:"data"`
		} `json:"result"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("parse holder count failed: %w", err)
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("# 股东户数 | %s\n\n", code))

	if len(result.Result.Data) == 0 {
		sb.WriteString("无股东户数数据\n")
	} else {
		sb.WriteString("日期 | 股东数 | 变化 | 变化率 | 户均持股\n")
		sb.WriteString("--- | --- | --- | --- | ---\n")
		for _, rec := range result.Result.Data {
			date := rec.EndDate[:10]
			trend := "减少"
			if rec.HolderNumChange > 0 {
				trend = "增加"
			}
			sb.WriteString(fmt.Sprintf("%s | %d | %s%d | %.2f%% | %.0f\n",
				date, rec.HolderNum, trend, absInt(rec.HolderNumChange),
				rec.HolderNumRatio, rec.AvgFreeShares))
		}

		// 集中度信号
		if len(result.Result.Data) >= 2 {
			first := result.Result.Data[len(result.Result.Data)-1].HolderNum
			last := result.Result.Data[0].HolderNum
			if last < first*9/10 {
				sb.WriteString("\n**信号**: 股东户数持续减少，筹码集中度提升\n")
			} else if last > first*11/10 {
				sb.WriteString("\n**信号**: 股东户数增加，筹码趋于分散\n")
			}
		}
	}

	return sb.String(), nil
}

func absInt(n int) int {
	if n < 0 {
		return -n
	}
	return n
}

// NewGetHolderCountTool 创建股东户数工具
func (e *EastMoneyTools) NewGetHolderCountTool() tool.InvokableTool {
	type Input struct {
		Code string `json:"code" jsonschema_description:"股票代码，如 600519"`
	}

	t, err := utils.InferTool(
		"get_holder_count",
		"获取股东户数变化，分析筹码集中度趋势",
		func(ctx context.Context, input *Input) (string, error) {
			return e.GetHolderCount(ctx, input.Code)
		},
	)
	if err != nil {
		log.Fatalf("创建 get_holder_count 工具失败: %v", err)
	}
	return t
}

// ============ 机构持仓汇总 ============

// GetOrgHoldSummary 获取机构持仓汇总（含公募基金家数、持股占比等）。
func (e *EastMoneyTools) GetOrgHoldSummary(ctx context.Context, code string) (string, error) {
	url := "https://datacenter-web.eastmoney.com/api/data/v1/get"
	params := map[string]string{
		"reportName":  "RPT_F10_MAIN_ORGHOLD",
		"columns":     "SECURITY_CODE,REPORT_DATE,TOTAL_ORG_NUM,TOTAL_FREE_SHARES,TOTAL_MARKET_CAP,TOTAL_SHARES_RATIO,CHANGE_RATIO,NOTICE_DATE",
		"filter":      fmt.Sprintf("(SECURITY_CODE=\"%s\")", code),
		"pageNumber":  "1",
		"pageSize":    "4",
		"sortColumns": "REPORT_DATE",
		"sortTypes":   "-1",
		"source":      "WEB",
		"client":      "WEB",
	}

	body, err := e.doGet(url, params)
	if err != nil {
		return "", fmt.Errorf("request org hold summary failed: %w", err)
	}

	var result struct {
		Result struct {
			Data []struct {
				ReportDate       string  `json:"REPORT_DATE"`
				TotalOrgNum      int     `json:"TOTAL_ORG_NUM"`
				TotalFreeShares  float64 `json:"TOTAL_FREE_SHARES"`
				TotalMarketCap   float64 `json:"TOTAL_MARKET_CAP"`
				TotalSharesRatio float64 `json:"TOTAL_SHARES_RATIO"`
				ChangeRatio      float64 `json:"CHANGE_RATIO"`
				NoticeDate       string  `json:"NOTICE_DATE"`
			} `json:"data"`
		} `json:"result"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("parse org hold summary failed: %w", err)
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("# 机构持仓汇总 | %s\n\n", code))

	if len(result.Result.Data) == 0 {
		sb.WriteString("无数据\n")
		return sb.String(), nil
	}

	latest := result.Result.Data[0]
	reportDate := latest.ReportDate
	if len(reportDate) >= 10 {
		reportDate = reportDate[:10]
	}
	sb.WriteString(fmt.Sprintf("报告期: %s\n", reportDate))
	sb.WriteString(fmt.Sprintf("持仓机构家数: %d\n", latest.TotalOrgNum))
	sb.WriteString(fmt.Sprintf("机构持股占流通比: %.2f%%\n", latest.TotalSharesRatio))
	sb.WriteString(fmt.Sprintf("机构持股市值: %.2f 亿\n", latest.TotalMarketCap/1e8))
	sb.WriteString(fmt.Sprintf("较上期变动: %.2f%%\n", latest.ChangeRatio))

	if len(result.Result.Data) > 1 {
		sb.WriteString("\n## 历史报告期\n\n")
		sb.WriteString("报告期 | 机构家数 | 占流通比 | 变动\n")
		sb.WriteString("--- | --- | --- | ---\n")
		for _, rec := range result.Result.Data {
			d := rec.ReportDate
			if len(d) >= 10 {
				d = d[:10]
			}
			sb.WriteString(fmt.Sprintf("%s | %d | %.2f%% | %.2f%%\n",
				d, rec.TotalOrgNum, rec.TotalSharesRatio, rec.ChangeRatio))
		}
	}

	return sb.String(), nil
}

// ============ 分红送转 ============

// GetDividend 获取分红送转历史
func (e *EastMoneyTools) GetDividend(ctx context.Context, code string) (string, error) {
	url := "https://datacenter-web.eastmoney.com/api/data/v1/get"
	params := map[string]string{
		"reportName":  "RPT_SHAREBONUS_DET",
		"columns":     "ALL",
		"filter":      fmt.Sprintf("(SECURITY_CODE=\"%s\")", code),
		"pageNumber":  "1",
		"pageSize":    "10",
		"sortColumns": "EX_DIVIDEND_DATE",
		"sortTypes":   "-1",
		"source":      "WEB",
		"client":      "WEB",
	}

	body, err := e.doGet(url, params)
	if err != nil {
		return "", fmt.Errorf("request dividend failed: %w", err)
	}

	var result struct {
		Result struct {
			Data []struct {
				ExDividendDate string  `json:"EX_DIVIDEND_DATE"`
				BonusRmb       float64 `json:"PRETAX_BONUS_RMB"`
				TransferRatio  float64 `json:"TRANSFER_RATIO"`
				BonusRatio     float64 `json:"BONUS_RATIO"`
				Progress       string  `json:"ASSIGN_PROGRESS"`
			} `json:"data"`
		} `json:"result"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("parse dividend failed: %w", err)
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("# 分红送转 | %s\n\n", code))

	if len(result.Result.Data) == 0 {
		sb.WriteString("无分红记录\n")
	} else {
		sb.WriteString("日期 | 派息(元/股) | 送股 | 转增 | 进度\n")
		sb.WriteString("--- | --- | --- | --- | ---\n")
		for _, rec := range result.Result.Data {
			date := rec.ExDividendDate[:10]
			sb.WriteString(fmt.Sprintf("%s | %.2f | %.0f | %.0f | %s\n",
				date, rec.BonusRmb, rec.BonusRatio, rec.TransferRatio, rec.Progress))
		}
	}

	return sb.String(), nil
}

// NewGetDividendTool 创建分红送转工具
func (e *EastMoneyTools) NewGetDividendTool() tool.InvokableTool {
	type Input struct {
		Code string `json:"code" jsonschema_description:"股票代码，如 600519"`
	}

	t, err := utils.InferTool(
		"get_dividend",
		"获取分红送转历史，显示每股派息、送股、转增记录",
		func(ctx context.Context, input *Input) (string, error) {
			return e.GetDividend(ctx, input.Code)
		},
	)
	if err != nil {
		log.Fatalf("创建 get_dividend 工具失败: %v", err)
	}
	return t
}

// GetAllTools 获取所有东财工具
func (e *EastMoneyTools) GetAllTools() []tool.BaseTool {
	return []tool.BaseTool{
		e.NewGetDragonTigerBoardTool(),
		e.NewGetDailyDragonTigerTool(),
		e.NewGetConceptBlocksTool(),
		e.NewGetFundFlowTool(),
		e.NewGetFundFlow120dTool(),
		e.NewGetIndustryComparisonTool(),
		e.NewGetLockupExpiryTool(),
		e.NewGetMarginTradingTool(),
		e.NewGetBlockTradeTool(),
		e.NewGetHolderCountTool(),
		e.NewGetDividendTool(),
	}
}
