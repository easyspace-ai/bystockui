/** 分析报告章节配置 — 对齐 TradingAgents-astock report_viewer + Go backend section keys */

export type ReportSectionDef = {
  key: string
  title: string
  team: string
  group: 'analyst' | 'debate' | 'trading' | 'risk' | 'final' | 'meta'
}

export const REPORT_SECTIONS: ReportSectionDef[] = [
  { key: 'market_report', title: '市场分析报告', team: '分析团队', group: 'analyst' },
  { key: 'sentiment_report', title: '舆情分析报告', team: '分析团队', group: 'analyst' },
  { key: 'news_report', title: '新闻分析报告', team: '分析团队', group: 'analyst' },
  { key: 'fundamentals_report', title: '基本面分析报告', team: '分析团队', group: 'analyst' },
  { key: 'macro_report', title: '宏观板块报告', team: '分析团队', group: 'analyst' },
  { key: 'smart_money_report', title: '主力资金报告', team: '分析团队', group: 'analyst' },
  { key: 'game_theory_report', title: '博弈判断报告', team: '博弈团队', group: 'analyst' },
  { key: 'investment_plan', title: '研究团队决策', team: '研究团队', group: 'debate' },
  { key: 'trader_investment_plan', title: '交易团队计划', team: '交易团队', group: 'trading' },
  { key: 'final_trade_decision', title: '最终交易决策', team: '组合管理', group: 'final' },
]

export const REPORT_DISCLAIMER =
  '> 免责声明：以上内容由模型基于公开数据、历史信息与预设规则自动生成，仅供研究参考，不构成任何投资建议、收益承诺或实际交易指令。'

export function pickFirstSectionWithContent(getContent: (key: string) => string): string | undefined {
  for (const s of REPORT_SECTIONS) {
    if (getContent(s.key).trim().length > 0) return s.key
  }
  return undefined
}
