import { useEffect, useRef, useState } from 'react'
import {
  BusinessDay,
  CandlestickData,
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
} from 'lightweight-charts'
import { Loader2 } from 'lucide-react'
import { dailyApi } from '@/lib/dailyApi'
import { cn } from '@/lib/utils'

function toBusinessDay(value: string): BusinessDay | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) }
}

type Period = 'daily' | 'weekly' | 'monthly'

const PERIODS: { id: Period; label: string }[] = [
  { id: 'daily', label: '日' },
  { id: 'weekly', label: '周' },
  { id: 'monthly', label: '月' },
]

type Props = {
  symbol: string
  className?: string
}

export function DailyKlinePanel({ symbol, className }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const [period, setPeriod] = useState<Period>('daily')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#64748b',
      },
      grid: {
        vertLines: { color: 'rgba(15, 23, 42, 0.06)' },
        horzLines: { color: 'rgba(15, 23, 42, 0.06)' },
      },
      rightPriceScale: { borderColor: 'rgba(148, 163, 184, 0.35)' },
      timeScale: { borderColor: 'rgba(148, 163, 184, 0.35)' },
    })
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#ef4444',
      downColor: '#22c55e',
      borderVisible: false,
      wickUpColor: '#ef4444',
      wickDownColor: '#22c55e',
    })
    chartRef.current = chart
    seriesRef.current = series

    const onResize = () => {
      if (!containerRef.current || !chartRef.current) return
      chartRef.current.applyOptions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      })
    }
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    const series = seriesRef.current
    if (!chart || !series || !symbol) return

    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await dailyApi.getKline(symbol, period)
        if (cancelled) return
        if (res.status !== 'success' || !res.dates?.length) {
          setError(res.message ?? '暂无K线数据')
          series.setData([])
          return
        }
        const candles: CandlestickData[] = []
        for (let i = 0; i < res.dates.length; i++) {
          const t = toBusinessDay(res.dates[i])
          const v = res.values[i]
          if (!t || !v) continue
          const [open, close, low, high] = v
          candles.push({ time: t, open, high, low, close })
        }
        series.setData(candles)
        chart.timeScale().fitContent()
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [symbol, period])

  return (
    <div
      className={cn(
        'relative flex flex-col min-h-[320px] rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40',
        className,
      )}
    >
      <div className="absolute top-3 left-3 z-10 flex gap-1">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriod(p.id)}
            className={cn(
              'px-2 py-1 text-xs font-medium rounded transition-colors border',
              period === p.id
                ? 'bg-slate-900 text-white border-slate-900 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40'
                : 'text-slate-600 border-transparent hover:bg-slate-100 hover:text-slate-900 dark:text-slate-500 dark:hover:bg-white/5 dark:hover:text-slate-300',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 dark:bg-slate-950/50">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-cyan-400" />
        </div>
      ) : null}
      {error ? (
        <div className="absolute bottom-3 left-3 right-3 z-20 text-center text-xs text-amber-800 bg-amber-50 py-2 rounded-lg border border-amber-200 dark:text-amber-400 dark:bg-slate-950/80 dark:border-amber-500/30">
          {error}
        </div>
      ) : null}
      <div ref={containerRef} className="flex-1 min-h-[280px] w-full" />
    </div>
  )
}
