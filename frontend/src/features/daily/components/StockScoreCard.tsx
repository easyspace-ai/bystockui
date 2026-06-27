import { useState, type CSSProperties } from 'react'
import { ChevronDown, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StockMetrics } from '@/lib/dailyApi'

function scoreColor(score?: number): string {
  if (score == null || !Number.isFinite(score)) return 'text-gray-600 dark:text-gray-400'
  if (score >= 80) return 'text-amber-600 dark:text-amber-400'
  if (score >= 65) return 'text-blue-600 dark:text-blue-400'
  if (score >= 50) return 'text-gray-600 dark:text-gray-400'
  return 'text-gray-600 dark:text-gray-400'
}

function barStyle(current: number, max: number): CSSProperties {
  const pct = max > 0 ? current / max : 0
  const opacity = 0.25 + pct * 0.75
  return {
    width: `${pct * 100}%`,
    backgroundColor: `rgb(37 99 235 / ${opacity})`,
  }
}

function rsiColor(rsi?: number): string {
  if (rsi == null) return ''
  if (rsi > 70) return 'text-amber-600 dark:text-amber-400'
  if (rsi < 30) return 'text-emerald-600 dark:text-emerald-400'
  return 'text-gray-900 dark:text-gray-100'
}

type Props = {
  metrics: StockMetrics | null
  loading?: boolean
  defaultExpanded?: boolean
  onRefresh?: () => void
}

export function StockScoreCard({
  metrics,
  loading = false,
  defaultExpanded = false,
  onRefresh,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  if (!metrics) return null

  const parts = (metrics.rating ?? '').split(' ')
  const ratingHead = parts[0] ?? ''
  const ratingTail = parts.slice(1).join(' ') || '🟢🟢🟢'

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden dark:border-gray-800 dark:bg-gray-900/60">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between cursor-pointer hover:bg-gray-100/70 dark:border-gray-800 dark:bg-gray-800/50 dark:hover:bg-gray-800 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <ChevronDown
            className={cn(
              'w-4 h-4 text-gray-500 transition-transform',
              expanded && 'rotate-180',
            )}
          />
          <div className={cn('text-2xl font-bold font-mono tabular-nums', scoreColor(metrics.composite_score))}>
            {metrics.composite_score ?? '—'}
            <span className="text-sm font-normal text-gray-500 ml-1 dark:text-gray-400">分</span>
          </div>
          <div className="flex flex-col items-start">
            <span className={cn('font-semibold text-sm', scoreColor(metrics.composite_score))}>{ratingHead}</span>
            <span className="text-[10px] tracking-widest text-gray-500 opacity-90">{ratingTail}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {metrics.date ? (
            <span className="text-[11px] text-gray-600 bg-white border border-gray-200 px-2.5 py-1 rounded-lg dark:bg-gray-900 dark:border-gray-700 dark:text-gray-300">
              {metrics.date}
            </span>
          ) : null}
          {onRefresh ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                onRefresh()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  e.stopPropagation()
                  onRefresh()
                }
              }}
              className="p-2 rounded-lg hover:bg-gray-200/80 text-gray-500 hover:text-blue-600 dark:hover:bg-gray-700 dark:hover:text-blue-400 transition-colors"
              title="重新计算评分"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </span>
          ) : null}
        </div>
      </button>

      {expanded ? (
        <>
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-8 bg-white dark:bg-gray-900/40">
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">评分明细</h4>
              <div className="space-y-3">
                {(metrics.score_breakdown ?? []).map((item, index) => (
                  <div key={`${item[0]}-${index}`} className="flex flex-col gap-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-700 font-medium dark:text-gray-300">{item[0]}</span>
                      <span className="font-mono text-gray-500">
                        {item[1]}/{item[2]}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden dark:bg-gray-800">
                      <div className="h-full rounded-full transition-all duration-700 ease-out" style={barStyle(item[1], item[2])} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">核心技术信号</h4>
              <div className="grid grid-cols-1 gap-y-3 text-sm">
                <div className="flex gap-3 items-center">
                  <span className="text-gray-500 w-10 shrink-0">趋势:</span>
                  <span className="text-gray-800 dark:text-gray-200">
                    <span
                      className={cn(
                        'font-medium px-1.5 py-0.5 rounded',
                        metrics.ma_arrangement === '多头排列' && 'text-rose-600 bg-rose-50 dark:bg-rose-950/50 dark:text-rose-400',
                        metrics.ma_arrangement === '空头排列' && 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400',
                      )}
                    >
                      {metrics.ma_arrangement || '震荡'}
                    </span>
                    <span className="ml-2 text-gray-500 text-xs">
                      ({metrics.trend_signal === '看涨' ? '>MA20' : '<MA20'})
                    </span>
                  </span>
                </div>
                <div className="flex gap-3 items-center">
                  <span className="text-gray-500 w-10 shrink-0">形态:</span>
                  <span className="text-gray-800 dark:text-gray-200">
                    {metrics.pattern_details?.length ? (
                      <span className="text-amber-700 dark:text-amber-400 font-medium">
                        {metrics.pattern_details.join(', ').replace(/\(\+\d+\)|\(-\d+\)/g, '')}
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">无显著形态</span>
                    )}
                  </span>
                </div>
                <div className="flex gap-3 items-center flex-wrap">
                  <span className="text-gray-500 w-10 shrink-0">动量:</span>
                  <div className="flex gap-3 text-gray-800 font-mono text-sm dark:text-gray-200">
                    <span className="px-2 py-1 bg-gray-50 rounded-lg border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                      RSI:{' '}
                      <span className={cn('font-semibold ml-1', rsiColor(metrics.rsi))}>{metrics.rsi ?? '—'}</span>
                    </span>
                    <span className="px-2 py-1 bg-gray-50 rounded-lg border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                      量比: <span className="font-semibold ml-1">{metrics.volume_ratio ?? '—'}</span>
                    </span>
                  </div>
                </div>
                <div className="flex gap-3 items-center">
                  <span className="text-gray-500 w-10 shrink-0">止损:</span>
                  <span className="text-gray-900 dark:text-gray-100 font-mono font-semibold">{metrics.stop_loss_suggest ?? 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>
          {metrics.operation_suggestion ? (
            <div className="px-5 py-3.5 bg-blue-50 border-t border-blue-100 text-xs text-blue-900 flex items-start gap-2.5 dark:bg-blue-950/30 dark:border-blue-900/30 dark:text-blue-100">
              <span className="mt-0.5 text-base">💡</span>
              <span className="leading-relaxed font-medium">{metrics.operation_suggestion}</span>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
