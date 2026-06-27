package aggressive

import (
	"aistock/backend/internal/analysis/agents/common"
	"context"

	"github.com/cloudwego/eino/adk"
)

// NewAgent 创建激进风控辩论师 Agent
func NewAgent(ctx context.Context) (adk.Agent, error) {
	return common.NewAgentBuilder("激进风控", "从积极角度评估风险收益比，支持适当的风险承担。").
		WithInstruction(aggressiveInstruction).
		WithModel(common.NewDeepThinkModel()).
		Build(ctx)
}
