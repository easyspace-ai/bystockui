import { cn } from '@/lib/utils'

type SignalHeroProps = {
  symbol: string
  stockName?: string
  signal?: string
  tradeDate?: string
  confidence?: number
  /** Shown while analysis is running and no decision exists yet */
  pending?: boolean
}

function parseSignalStyle(signal: string): { color: string; label: string; raw: string } {
  const raw = signal.toUpperCase()
  if (raw.includes('BUY') || raw.includes('买入') || raw.includes('增持')) {
    return { color: 'text-emerald-400', label: '买入', raw }
  }
  if (raw.includes('SELL') || raw.includes('卖出') || raw.includes('减持')) {
    return { color: 'text-rose-400', label: '卖出', raw }
  }
  return { color: 'text-amber-400', label: '持有', raw }
}

export function SignalHero({ symbol, stockName, signal, tradeDate, confidence, pending }: SignalHeroProps) {
  const displayLabel = stockName ? `${stockName} · ${symbol}` : symbol

  if (pending) {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 p-6 text-center shadow-lg">
        <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">Trading Signal</div>
        <div className="my-2 text-4xl font-bold tracking-tight text-slate-400 sm:text-5xl">分析中...</div>
        <div className="text-base text-slate-300">{displayLabel}</div>
        <p className="mt-4 text-[11px] text-slate-500">
          本报告由 AI 自动生成，仅供学习研究，不构成投资建议
        </p>
      </div>
    )
  }

  if (!signal?.trim()) return null

  const { color, label } = parseSignalStyle(signal)
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 p-6 text-center shadow-lg">
      <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">Trading Signal</div>
      <div className={cn('my-2 text-5xl font-black tracking-tight sm:text-6xl', color)}>{label}</div>
      <div className="text-base text-slate-300">
        {displayLabel}
        {tradeDate ? ` · ${tradeDate.slice(0, 10)}` : ''}
      </div>
      {confidence != null ? (
        <div className="mt-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs text-slate-300">
          置信度 {Math.round(confidence)}%
        </div>
      ) : null}
      <p className="mt-4 text-[11px] text-slate-500">
        本报告由 AI 自动生成，仅供学习研究，不构成投资建议
      </p>
    </div>
  )
}
