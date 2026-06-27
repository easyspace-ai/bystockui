// Command datainit 手动拉取 AIGoStock 分析所需的本地全量数据（Parquet + DuckDB 视图依赖）。
// 与 main / API 使用同一 DataDir 与数据源（默认 StockSDK）。
//
// 断点续传：daily / adj_factor / daily_basic 按自然月分块拉取，每成功一月会更新
// data/meta/checkpoints.json。中断后用相同 -data、-start、-end 再执行即可从上次的下一天继续。
// 若要把 -start 改早补历史，需自行删掉 checkpoints 里对应 dataset 或清理 lake 重复分区，避免重复落盘。
//
// 完整性：StockSDK 源下 bulk 拉取默认容忍少量单股失败；若 >50% 失败则报错。
// 设置 STOCKDB_STRICT_SYNC=1 可在任意单股失败时立即报错。SyncDailyBasicRange 在 syncer
// 内使用 24h 独立 context，不受 HTTP/API 短超时影响。
//
// 用法示例（在 aigostock 目录下）：
//
//	go run ./cmd/datainit
//	go run ./cmd/datainit -core-only
//	go run ./cmd/datainit -data ./data -start 20200101 -end 20250301
//	TUSHARE_TOKEN=xxx go run ./cmd/datainit -source tushare
package main

import (
	"context"
	"flag"
	"log"
	"os"
	"strings"
	"time"

	"github.com/easyspace-ai/bystock/pkg/tsdb"
	"github.com/joho/godotenv"
)

func main() {
	log.SetPrefix("[datainit] ")
	log.SetFlags(log.LstdFlags)

	dataDir := flag.String("data", "./data", "数据目录（与 AIGoStock 一致：lake/、meta/、duckdb/）")
	start := flag.String("start", "20180101", "日线/复权/每日指标 起始日期 YYYYMMDD")
	end := flag.String("end", "", "结束日期 YYYYMMDD，默认今天")
	coreOnly := flag.Bool("core-only", false, "仅同步 stock_basic + trade_cal（较快，可修复缺失 v_stock_basic）")
	skipDaily := flag.Bool("skip-daily", false, "跳过日线全量")
	skipAdjFactor := flag.Bool("skip-adj", false, "跳过复权因子")
	skipDailyBasic := flag.Bool("skip-daily-basic", false, "跳过 daily_basic")
	source := flag.String("source", "stocksdk", "数据源：stocksdk | tushare（tushare 需环境变量 TUSHARE_TOKEN）")
	flag.Parse()

	_ = godotenv.Load(".env")
	_ = godotenv.Load("../.env")

	endDate := strings.TrimSpace(*end)
	if endDate == "" {
		endDate = time.Now().Format("20060102")
	}

	cfg := tsdb.UnifiedConfig{
		DataDir:      *dataDir,
		CacheMode:    tsdb.CacheModeAuto,
		TushareToken: os.Getenv("TUSHARE_TOKEN"),
	}
	switch strings.ToLower(strings.TrimSpace(*source)) {
	case "stocksdk", "":
		cfg.PrimaryDataSource = tsdb.DataSourceStockSDK
	case "tushare":
		cfg.PrimaryDataSource = tsdb.DataSourceTushare
	default:
		log.Fatalf("unknown -source %q (use stocksdk or tushare)", *source)
	}

	if err := os.MkdirAll(*dataDir, 0o755); err != nil {
		log.Fatalf("mkdir data dir: %v", err)
	}

	client, err := tsdb.NewUnifiedClient(cfg)
	if err != nil {
		log.Fatalf("new client: %v", err)
	}
	defer func() { _ = client.Close() }()

	// context.Background()：datainit 为长时间 bulk 任务；daily_basic 全市场 sync 在 stockdb syncer
	// 内会再包一层 24h WithoutCancel，避免继承短超时。
	ctx := context.Background()

	log.Println("=== SyncCore: trade_cal + stock_basic（上市 L）===")
	if err := client.SyncCore(ctx); err != nil {
		log.Fatalf("SyncCore: %v", err)
	}
	if *coreOnly {
		log.Println("core-only：已结束（未拉日线/复权/daily_basic）。")
		return
	}

	if !*skipDaily {
		if d, ok := client.GetLastSyncDate("daily"); ok {
			log.Printf("checkpoint daily last=%s（将自动续拉至 %s）", d, endDate)
		}
		log.Printf("=== SyncDailyRange: %s ~ %s（全市场，按月 checkpoint，较慢）===", *start, endDate)
		if err := client.SyncDailyRange(ctx, *start, endDate); err != nil {
			log.Fatalf("SyncDailyRange: %v", err)
		}
	} else {
		log.Println("跳过 SyncDailyRange（-skip-daily）")
	}

	if !*skipAdjFactor {
		if d, ok := client.GetLastSyncDate("adj_factor"); ok {
			log.Printf("checkpoint adj_factor last=%s", d)
		}
		log.Printf("=== SyncAdjFactorRange: %s ~ %s（按月 checkpoint）===", *start, endDate)
		if err := client.SyncAdjFactorRange(ctx, *start, endDate); err != nil {
			log.Fatalf("SyncAdjFactorRange: %v", err)
		}
	} else {
		log.Println("跳过 SyncAdjFactorRange（-skip-adj）")
	}

	if !*skipDailyBasic {
		if d, ok := client.GetLastSyncDate("daily_basic"); ok {
			log.Printf("checkpoint daily_basic last=%s", d)
		}
		log.Printf("=== SyncDailyBasicRange: %s ~ %s（全市场，按月 checkpoint，较慢）===", *start, endDate)
		if err := client.SyncDailyBasicRange(ctx, *start, endDate); err != nil {
			log.Fatalf("SyncDailyBasicRange: %v", err)
		}
	} else {
		log.Println("跳过 SyncDailyBasicRange（-skip-daily-basic）")
	}

	log.Println("=== 完成。请用同一 -data 目录启动 AIGoStock。===")
	for _, ds := range []string{"daily", "adj_factor", "daily_basic"} {
		if d, ok := client.GetLastSyncDate(ds); ok {
			log.Printf("checkpoint %s last=%s", ds, d)
		}
	}
}
