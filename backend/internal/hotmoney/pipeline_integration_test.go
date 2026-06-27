package hotmoney

import (
	"context"
	"os"
	"testing"
	"time"

	"aistock/backend/internal/analysis/tools"
)

func TestPrepareContextWithGlobalToolsLoaded(t *testing.T) {
	dataDir := os.Getenv("AI_DATA_DIR")
	if dataDir == "" {
		t.Skip("AI_DATA_DIR not set")
	}
	if err := tools.InitGlobalTools(dataDir); err != nil {
		t.Fatalf("InitGlobalTools: %v", err)
	}

	p, err := NewPipeline(PipelineConfig{DataDir: dataDir})
	if err != nil {
		t.Fatalf("NewPipeline: %v", err)
	}
	defer p.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	var stages []string
	tsCode, dataCtx, meta, err := p.PrepareContext(ctx, "分析 600519", func(ev ProgressEvent) {
		stages = append(stages, ev.Stage+":"+ev.Message)
	})
	if err != nil {
		t.Fatalf("PrepareContext: %v (stages=%v)", err, stages)
	}
	if tsCode == "" {
		t.Fatalf("empty tsCode, stages=%v", stages)
	}
	if dataCtx == "" {
		t.Fatalf("empty dataContext, stages=%v", stages)
	}
	t.Logf("ok tsCode=%s ctxLen=%d meta=%+v stages=%d", tsCode, len(dataCtx), meta, len(stages))
}
