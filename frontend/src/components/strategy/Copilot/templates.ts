import type { TemplateOption } from "./types";

export const BUILTIN_TEMPLATES: TemplateOption[] = [
  {
    id: "双均线策略",
    name: "双均线策略",
    description: "趋势跟踪，快慢均线交叉产生信号",
    type: "trend_following",
  },
  {
    id: "市场情绪策略",
    name: "市场情绪策略",
    description: "基于价格偏离、动量和成交量的情绪代理策略",
    type: "sentiment",
  },
  {
    id: "ETF轮动策略",
    name: "ETF轮动策略",
    description: "动量轮动，短期和长期动量差产生信号",
    type: "momentum",
  },
  {
    id: "双均线对冲策略",
    name: "双均线对冲策略",
    description: "双均线基础策略加对冲接口骨架",
    type: "hedging",
  },
];
