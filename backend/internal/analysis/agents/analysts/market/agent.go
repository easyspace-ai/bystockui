package market

import (
	"aistock/backend/internal/analysis/agents/common"
	"aistock/backend/internal/analysis/tools"
	"context"

	"github.com/cloudwego/eino/adk"
)

// NewAgent 创建市场分析师 Agent
func NewAgent(ctx context.Context) (adk.Agent, error) {
	return common.NewAgentBuilder("市场分析师", "专业的技术面分析专家，擅长 K 线、技术指标和趋势判断。").
		WithInstruction(marketAnalystInstruction).
		WithTools(tools.GetGlobalTools()...).
		WithModel(common.NewQuickThinkModel()).
		Build(ctx)
}
