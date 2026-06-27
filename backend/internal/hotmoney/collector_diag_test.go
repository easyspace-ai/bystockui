package hotmoney

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"
)

func TestCollector603345Meta(t *testing.T) {
	if os.Getenv("RUN_HOTMONEY_INTEGRATION") == "" {
		t.Skip("set RUN_HOTMONEY_INTEGRATION=1 to run live collector diagnostic")
	}
	dataDir := os.Getenv("AI_DATA_DIR")
	if dataDir == "" {
		dataDir = "../../data"
	}
	c, err := NewCollector(dataDir)
	if err != nil {
		t.Fatalf("NewCollector: %v", err)
	}
	defer c.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()

	tsCode := "603345.SH"
	dims := c.Collect(ctx, tsCode, nil)

	for name, d := range dims {
		status := "OK"
		if d.Err != nil {
			status = "ERR"
		} else if strings.TrimSpace(d.Content) == "" || d.Content == "无数据" {
			status = "EMPTY"
		}
		t.Logf("dim %s: %s len=%d err=%v", name, status, len(d.Content), d.Err)
	}

	meta := ExtractReportMeta(tsCode, dims)
	t.Logf("meta from dims: name=%q price=%q change=%q turnover=%q concepts=%v",
		meta.Name, meta.Price, meta.ChangePct, meta.Turnover, meta.Concepts)
}
