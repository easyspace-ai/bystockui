package neutral

import (
	"aistock/backend/internal/analysis/agents/common"
	"context"

	"github.com/cloudwego/eino/adk"
)

// NewAgent 创建中性风控辩论师 Agent
func NewAgent(ctx context.Context) (adk.Agent, error) {
	return common.NewAgentBuilder("中性风控", "从中立平衡角度评估风险收益，提出稳健的折中建议。").
		WithInstruction(neutralInstruction).
		WithModel(common.NewDeepThinkModel()).
		Build(ctx)
}
