package hotmoney

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"aistock/backend/internal/analysis/tools"
)

// Dimension holds one fetched data slice keyed by UZI-style dimension name.
type Dimension struct {
	Name    string
	Label   string
	Content string
	Err     error
}

// Collector gathers market data via existing Go analysis tools (tusharedb + East Money + THS).
type Collector struct {
	stock     *tools.StockTools
	eastmoney *tools.EastMoneyTools
	ths       *tools.THSTools
}

func NewCollector(dataDir string) (*Collector, error) {
	stockTools, err := tools.NewStockTools(dataDir)
	if err != nil {
		return nil, fmt.Errorf("stock tools: %w", err)
	}
	return &Collector{
		stock:     stockTools,
		eastmoney: tools.NewEastMoneyTools(),
		ths:       tools.NewTHSTools(),
	}, nil
}

func (c *Collector) Close() error {
	if c.stock != nil {
		return c.stock.Close()
	}
	return nil
}

type fetchTask struct {
	name  string
	label string
	fn    func(context.Context) (string, error)
}

// Collect runs parallel fetches for the target stock. onProgress is optional.
func (c *Collector) Collect(ctx context.Context, tsCode string, onProgress func(label string)) map[string]Dimension {
	emCode := EMCode(tsCode)
	end := time.Now().Format("20060102")
	start60 := time.Now().AddDate(0, 0, -90).Format("20060102")
	start30 := time.Now().AddDate(0, 0, -45).Format("20060102")

	tasks := []fetchTask{
		{"basic", "基础信息", func(ctx context.Context) (string, error) {
			return c.stock.GetStockBasic(ctx, tsCode)
		}},
		{"kline", "K线走势", func(ctx context.Context) (string, error) {
			return c.stock.GetStockData(ctx, tsCode, start60, end)
		}},
		{"daily_basic", "估值指标", func(ctx context.Context) (string, error) {
			return c.stock.GetDailyBasic(ctx, tsCode, start30, end)
		}},
		{"dragon_tiger", "龙虎榜", func(ctx context.Context) (string, error) {
			return c.eastmoney.GetDragonTigerBoard(ctx, emCode, 30)
		}},
		{"fund_flow", "资金流向", func(ctx context.Context) (string, error) {
			return c.eastmoney.GetFundFlow(ctx, emCode)
		}},
		{"fund_flow_120d", "120日资金", func(ctx context.Context) (string, error) {
			return c.eastmoney.GetFundFlow120d(ctx, emCode)
		}},
		{"concept", "概念板块", func(ctx context.Context) (string, error) {
			return c.eastmoney.GetConceptBlocks(ctx, emCode)
		}},
		{"margin", "融资融券", func(ctx context.Context) (string, error) {
			return c.eastmoney.GetMarginTrading(ctx, emCode, 20)
		}},
		{"holder", "股东户数", func(ctx context.Context) (string, error) {
			return c.eastmoney.GetHolderCount(ctx, emCode)
		}},
		{"block_trade", "大宗交易", func(ctx context.Context) (string, error) {
			return c.eastmoney.GetBlockTrade(ctx, emCode, 30)
		}},
		{"northbound", "北向资金", func(ctx context.Context) (string, error) {
			return c.ths.GetNorthboundFlow(ctx, 10)
		}},
		{"hot_stocks", "市场热股", func(ctx context.Context) (string, error) {
			return c.ths.GetHotStocks(ctx, 20)
		}},
		{"profit_forecast", "盈利预测", func(ctx context.Context) (string, error) {
			return c.ths.GetProfitForecast(ctx, emCode)
		}},
		{"org_hold", "机构持仓", func(ctx context.Context) (string, error) {
			return c.eastmoney.GetOrgHoldSummary(ctx, emCode)
		}},
		{"dividend", "分红送转", func(ctx context.Context) (string, error) {
			return c.eastmoney.GetDividend(ctx, emCode)
		}},
	}

	out := make(map[string]Dimension, len(tasks))
	var mu sync.Mutex
	var wg sync.WaitGroup

	for _, t := range tasks {
		wg.Add(1)
		go func(task fetchTask) {
			defer wg.Done()
			if onProgress != nil {
				onProgress(task.label)
			}
			content, err := task.fn(ctx)
			mu.Lock()
			out[task.name] = Dimension{Name: task.name, Label: task.label, Content: content, Err: err}
			mu.Unlock()
		}(t)
	}
	wg.Wait()
	return out
}

// FormatContext builds the LLM context block from collected dimensions.
func FormatContext(tsCode string, dims map[string]Dimension) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("## 标的: %s\n\n", tsCode))
	order := []string{
		"basic", "kline", "daily_basic", "dragon_tiger", "fund_flow", "fund_flow_120d",
		"concept", "margin", "holder", "org_hold", "block_trade", "northbound", "hot_stocks",
		"profit_forecast", "dividend",
	}
	for _, name := range order {
		d, ok := dims[name]
		if !ok {
			continue
		}
		sb.WriteString(fmt.Sprintf("### %s\n", d.Label))
		if d.Err != nil {
			sb.WriteString(fmt.Sprintf("（获取失败: %v）\n\n", d.Err))
			continue
		}
		content := strings.TrimSpace(d.Content)
		if len(content) > 4000 {
			content = content[:4000] + "\n…（截断）"
		}
		sb.WriteString(content)
		sb.WriteString("\n\n")
	}
	return sb.String()
}
