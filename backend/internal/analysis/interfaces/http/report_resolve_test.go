package httpapi

import "testing"

func TestExtractRiskItemsFromText(t *testing.T) {
	text := `【决策逻辑】
1. 核心逻辑：业绩稳健
2. 催化剂：新品发布
3. 主要风险：估值偏高，宏观下行

【风险提示】
- 行业竞争加剧
- 政策不确定性
`
	items := extractRiskItemsFromText(text)
	if len(items) < 2 {
		t.Fatalf("expected at least 2 risk items, got %d", len(items))
	}
}

func TestExtractKeyMetricsFromText(t *testing.T) {
	text := `基本面概览
PE：28.5
PB：4.2
| 指标 | 值 |
| 换手率 | 1.2% |
置信度：75%
`
	items := extractKeyMetricsFromText(text)
	if len(items) < 3 {
		t.Fatalf("expected at least 3 metrics, got %d", len(items))
	}
}

func TestMergePayloadExtrasFillsRisksAndMetrics(t *testing.T) {
	result := map[string]any{
		"final_trade_decision": `3. 主要风险：流动性不足
【风险提示】
- 业绩不及预期`,
		"fundamentals_report": "PE：15.3\nPB：2.1",
	}
	payload := completionPayload(result)
	mergePayloadExtras(result, payload)

	risks, ok := payload["risk_items"].([]any)
	if !ok || len(risks) == 0 {
		t.Fatal("expected risk_items to be populated")
	}
	metrics, ok := payload["key_metrics"].([]any)
	if !ok || len(metrics) == 0 {
		t.Fatal("expected key_metrics to be populated")
	}
}
