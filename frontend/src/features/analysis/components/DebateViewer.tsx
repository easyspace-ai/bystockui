import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'
import { sanitizeReportMarkdown } from '@/features/analysis/tradingAgents/reportText'

type DebateTab = { id: string; label: string; content: string }

type DebateViewerProps = {
  title: string
  tabs: DebateTab[]
  className?: string
}

function DebateTabs({ title, tabs, className }: DebateViewerProps) {
  const validTabs = tabs.filter((t) => t.content.trim().length > 0)
  const [active, setActive] = useState(validTabs[0]?.id ?? '')

  if (!validTabs.length) return null

  const current = validTabs.find((t) => t.id === active) ?? validTabs[0]

  return (
    <div className={cn('rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/60', className)}>
      <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3 py-2 dark:border-slate-800">
        {validTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={cn(
              'shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              current.id === tab.id
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="prose prose-sm max-w-none p-4 dark:prose-invert">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {sanitizeReportMarkdown(current.content)}
        </ReactMarkdown>
      </div>
    </div>
  )
}

/** 兼容 astock (bull_history) 与 Go backend (bull_arguments[]) 两种辩论数据形态 */
export function InvestmentDebateViewer({ report }: { report: Record<string, unknown> | null | undefined }) {
  if (!report) return null

  const debate = report.investment_debate_state as Record<string, unknown> | undefined
  if (!debate) return null

  const bullHistory = String(debate.bull_history ?? '')
  const bearHistory = String(debate.bear_history ?? '')
  const judgeDecision = String(debate.judge_decision ?? '')

  const bullArgs = Array.isArray(debate.bull_arguments) ? debate.bull_arguments.join('\n\n') : ''
  const bearArgs = Array.isArray(debate.bear_arguments) ? debate.bear_arguments.join('\n\n') : ''
  const commonGround = Array.isArray(debate.common_ground) ? debate.common_ground.join('\n\n') : ''

  const tabs: DebateTab[] = [
    { id: 'bull', label: '多方', content: bullHistory || bullArgs },
    { id: 'bear', label: '空方', content: bearHistory || bearArgs },
    { id: 'judge', label: '研究经理', content: judgeDecision || commonGround },
  ]

  return <DebateTabs title="多空辩论" tabs={tabs} />
}

export function RiskDebateViewer({ report }: { report: Record<string, unknown> | null | undefined }) {
  if (!report) return null

  const risk = report.risk_debate_state as Record<string, unknown> | undefined
  if (!risk) return null

  const tabs: DebateTab[] = [
    { id: 'agg', label: '激进', content: String(risk.aggressive_history ?? risk.aggressive_view ?? '') },
    { id: 'con', label: '保守', content: String(risk.conservative_history ?? risk.conservative_view ?? '') },
    { id: 'neu', label: '中性', content: String(risk.neutral_history ?? risk.neutral_view ?? '') },
    { id: 'judge', label: '风控决策', content: String(risk.judge_decision ?? risk.revision_feedback ?? '') },
  ]

  return <DebateTabs title="风控评估" tabs={tabs} />
}

export function DataQualityPanel({ report }: { report: Record<string, unknown> | null | undefined }) {
  const content = String(report?.data_quality_summary ?? '').trim()
  if (!content) return null

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/60">
      <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">数据质量</h3>
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{sanitizeReportMarkdown(content)}</ReactMarkdown>
      </div>
    </div>
  )
}
