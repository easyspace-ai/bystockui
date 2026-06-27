package hotmoney

// Pipeline orchestrates UZI-style hot-money analysis:
//   resolve ticker → parallel data collect (AI_DATA_DIR lake/duckdb + East Money + THS)
//   → LLM synthesis → streaming HTML report.
//
// a-stock-data evaluation (workspace has no a-stock-data/ folder; data lives under AI_DATA_DIR):
//   - lake/*.parquet + duckdb/tusharedb.duckdb: daily OHLCV, daily_basic, stock_basic (Tushare via tusharedb-go)
//   - stockapi-cache/: live quotes/history via stockapi SDK
//   - Gaps vs UZI-Skill: no akshare/xueqiu/snowball scrapers, no 22 fetcher parity, no persona JSON assets
//   - Recommendation: keep AI_DATA_DIR as primary; East Money/THS tools cover LHB/fund-flow gaps; optional
//     HOTMONEY_UZI_DIR subprocess for full 66-persona pipeline when Python deps available.

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// ProgressEvent is emitted during pipeline stages (SSE: {"stage","message"}).
type ProgressEvent struct {
	Stage   string `json:"stage"`
	Message string `json:"message"`
}

// PipelineConfig holds runtime settings.
type PipelineConfig struct {
	DataDir   string
	Searcher  StockSearcher
	QuoteProv QuoteProvider
	UZIDir    string
}

// Pipeline runs data-backed hot-money analysis.
type Pipeline struct {
	collector *Collector
	searcher  StockSearcher
	quoteProv QuoteProvider
	uziDir    string
}

func NewPipeline(cfg PipelineConfig) (*Pipeline, error) {
	c, err := NewCollector(cfg.DataDir)
	if err != nil {
		return nil, err
	}
	uziDir := strings.TrimSpace(cfg.UZIDir)
	if uziDir == "" {
		uziDir = ResolveUZIDir()
	}
	return &Pipeline{
		collector: c,
		searcher:  cfg.Searcher,
		quoteProv: cfg.QuoteProv,
		uziDir:    uziDir,
	}, nil
}

// UZIDir returns configured UZI-Skill root directory (may be empty).
func (p *Pipeline) UZIDir() string {
	if p == nil {
		return ""
	}
	return p.uziDir
}

func (p *Pipeline) Close() error {
	if p.collector != nil {
		return p.collector.Close()
	}
	return nil
}

// ResolveUserText extracts ts_code from user message using the pipeline searcher.
func (p *Pipeline) ResolveUserText(userText string) string {
	if p == nil {
		return ResolveTSCode(userText)
	}
	return ResolveTSCodeWithSearch(userText, p.searcher)
}

// PrepareContext resolves ticker and collects market data.
// Returns tsCode, LLM context block, structured hero meta, error.
func (p *Pipeline) PrepareContext(ctx context.Context, userText string, onProgress func(ProgressEvent)) (string, string, ReportMeta, error) {
	emptyMeta := ReportMeta{}
	tsCode := ResolveTSCodeWithSearch(userText, p.searcher)
	if tsCode == "" {
		return "", "", emptyMeta, nil
	}

	emit := func(stage, msg string) {
		if onProgress != nil {
			onProgress(ProgressEvent{Stage: stage, Message: msg})
		}
	}

	emit("resolve", fmt.Sprintf("识别标的 %s", tsCode))

	if p.uziDir != "" {
		emit("collect", "尝试 UZI-Skill Python 管道…")
		if uziCtx, err := TryUZICollect(ctx, p.uziDir, tsCode); err == nil && strings.TrimSpace(uziCtx) != "" {
			emit("collect", "UZI-Skill 数据就绪")
			meta := ReportMeta{TSCode: tsCode, DataTime: time.Now().Format("2006-01-02 15:04")}
			p.enrichMetaFromLive(&meta, tsCode)
			return tsCode, uziCtx, meta, nil
		}
		emit("collect", "UZI-Skill 不可用，回退 Go 采集器")
	}

	emit("collect", "开始并行抓取 15 个数据维度…")

	collectCtx, cancel := context.WithTimeout(ctx, 90*time.Second)
	defer cancel()

	dims := p.collector.Collect(collectCtx, tsCode, func(label string) {
		emit("collect", fmt.Sprintf("抓取%s…", label))
	})
	if collectCtx.Err() != nil {
		return tsCode, "", emptyMeta, fmt.Errorf("数据抓取超时或已取消: %w", collectCtx.Err())
	}

	ok, fail := 0, 0
	var failedLabels []string
	for _, d := range dims {
		if d.Err == nil && strings.TrimSpace(d.Content) != "" && d.Content != "无数据" {
			ok++
		} else {
			fail++
			label := d.Label
			if label == "" {
				label = d.Name
			}
			if d.Err != nil {
				failedLabels = append(failedLabels, fmt.Sprintf("%s(%v)", label, d.Err))
			} else {
				failedLabels = append(failedLabels, label+"(空)")
			}
		}
	}
	total := ok + fail
	msg := fmt.Sprintf("数据抓取完成（成功 %d / 共 %d 维度）", ok, total)
	if len(failedLabels) > 0 {
		msg += "；失败: " + strings.Join(failedLabels, "、")
	}
	emit("collect", msg)

	meta := ExtractReportMeta(tsCode, dims)
	p.enrichMetaFromLive(&meta, tsCode)

	emit("collect", fmt.Sprintf("Hero 数据: 现价=%s 涨跌=%s 换手=%s",
		orDash(meta.Price), orDash(meta.ChangePct), orDash(meta.Turnover)))

	ctxBlock := FormatReportMetaBlock(meta) + FormatContext(tsCode, dims)
	return tsCode, ctxBlock, meta, nil
}

func orDash(s string) string {
	if strings.TrimSpace(s) == "" {
		return "—"
	}
	return s
}

func (p *Pipeline) enrichMetaFromLive(meta *ReportMeta, tsCode string) {
	if p.quoteProv == nil || meta == nil {
		return
	}
	code := EMCode(tsCode)
	if info, err := p.quoteProv.GetByCode(code); err == nil {
		EnrichMetaFromStockInfo(meta, info)
	}
	if q, err := p.quoteProv.GetQuote(code); err == nil {
		EnrichMetaFromQuote(meta, q)
	}
}
