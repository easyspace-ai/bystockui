import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AreaSeries,
  BusinessDay,
  CandlestickData,
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  IChartApi,
  ISeriesApi,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
} from 'lightweight-charts'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getStockCommonKline, type StockCommonKlineItem } from '@/lib/marketApi'

interface MajorIndexChartProps {
  code: string
  name: string
  defaultVisibleBars?: number
}

type ChartPoint = StockCommonKlineItem & {
  businessDay: BusinessDay
}

function toBusinessDay(value: string): BusinessDay | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.slice(0, 10))
  if (!match) return null
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  }
}

function formatNumber(value?: number | null, digits = 2) {
  if (value == null || !Number.isFinite(value)) return '--'
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

function formatPercent(value?: number | null, digits = 2) {
  if (value == null || !Number.isFinite(value)) return '--'
  return `${value >= 0 ? '' : '-'}${Math.abs(value).toFixed(digits)}%`
}

function calculateMA(data: ChartPoint[], period: number) {
  let rolling = 0
  return data.map((item, index) => {
    rolling += item.close
    if (index >= period) {
      rolling -= data[index - period].close
    }
    return {
      time: item.businessDay,
      value: index < period - 1 ? null : Number((rolling / period).toFixed(2)),
    }
  })
}

export function MajorIndexChart({
  code,
  name,
  defaultVisibleBars = 20,
}: MajorIndexChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [points, setPoints] = useState<ChartPoint[]>([])

  const latest = points.length ? points[points.length - 1] : null
  const previous = points.length > 1 ? points[points.length - 2] : null
  const latestChange = latest && previous ? latest.close - previous.close : null
  const latestChangePct = latest && previous && previous.close
    ? ((latest.close - previous.close) / previous.close) * 100
    : null
  const titleTone = (latestChangePct || 0) >= 0 ? 'text-rose-600' : 'text-emerald-600'

  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      autoSize: true,
      height: containerRef.current.clientHeight || 400,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#6b7280',
        fontSize: 11,
        attributionLogo: false,
      },
      localization: {
        locale: 'zh-CN',
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: 'rgba(226,232,240,0.9)' },
      },
      crosshair: {
        vertLine: { color: 'rgba(59,130,246,0.18)', width: 1, style: LineStyle.Dashed },
        horzLine: { color: 'rgba(59,130,246,0.18)', width: 1, style: LineStyle.Dashed },
      },
      rightPriceScale: {
        borderColor: 'rgba(226,232,240,0.9)',
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      timeScale: {
        borderColor: 'rgba(226,232,240,0.9)',
        rightOffset: 6,
        minBarSpacing: 0.5,
        barSpacing: 8,
        fixLeftEdge: true,
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    })

    chart.addPane(true)
    chart.addPane(true)

    const panes = chart.panes()
    panes[0]?.setStretchFactor(7)
    panes[1]?.setStretchFactor(2)
    panes[2]?.setStretchFactor(1)

    const candleSeries = chart.addSeries(
      CandlestickSeries,
      {
        upColor: '#e11d48',
        downColor: '#22c55e',
        wickUpColor: '#ef4444',
        wickDownColor: '#22c55e',
        borderVisible: false,
        priceLineVisible: false,
        lastValueVisible: false,
      },
      0,
    )

    chart.addSeries(LineSeries, { color: '#5272d6', lineWidth: 2, priceLineVisible: false, lastValueVisible: false }, 0)
    chart.addSeries(LineSeries, { color: '#8ac86c', lineWidth: 2, priceLineVisible: false, lastValueVisible: false }, 0)
    chart.addSeries(LineSeries, { color: '#f4c35b', lineWidth: 2, priceLineVisible: false, lastValueVisible: false }, 0)
    chart.addSeries(LineSeries, { color: '#f18a8a', lineWidth: 2, priceLineVisible: false, lastValueVisible: false }, 0)

    chart.addSeries(
      HistogramSeries,
      {
        priceFormat: { type: 'volume' },
        priceLineVisible: false,
        lastValueVisible: false,
        base: 0,
      },
      1,
    )

    chart.addSeries(
      AreaSeries,
      {
        lineColor: 'rgba(96,165,250,0.48)',
        topColor: 'rgba(96,165,250,0.16)',
        bottomColor: 'rgba(96,165,250,0.04)',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      },
      2,
    )

    chartRef.current = chart
    candleSeriesRef.current = candleSeries

    const resizeObserver = new ResizeObserver(() => {
      if (!containerRef.current || !chartRef.current) return
      const { clientWidth, clientHeight } = containerRef.current
      chartRef.current.applyOptions({
        width: clientWidth,
        height: Math.max(clientHeight, 240),
      })
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await getStockCommonKline(code, 365, 'day')
        const mapped = response.list
          .map((item) => {
            const businessDay = toBusinessDay(item.date)
            if (!businessDay) return null
            return {
              ...item,
              businessDay,
            }
          })
          .filter((item): item is ChartPoint => Boolean(item))

        if (cancelled) return
        setPoints(mapped)

        if (!chartRef.current) return
        const panes = chartRef.current.panes()
        const candleSeries = candleSeriesRef.current
        const ma5Series = panes[0]?.getSeries()[1] as ISeriesApi<'Line'> | undefined
        const ma10Series = panes[0]?.getSeries()[2] as ISeriesApi<'Line'> | undefined
        const ma20Series = panes[0]?.getSeries()[3] as ISeriesApi<'Line'> | undefined
        const ma30Series = panes[0]?.getSeries()[4] as ISeriesApi<'Line'> | undefined
        const volumeSeries = panes[1]?.getSeries()[0] as ISeriesApi<'Histogram'> | undefined
        const overviewSeries = panes[2]?.getSeries()[0] as ISeriesApi<'Area'> | undefined

        const candles: CandlestickData[] = mapped.map((item) => ({
          time: item.businessDay,
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
        }))

        candleSeries?.setData(candles)
        ma5Series?.setData(calculateMA(mapped, 5).filter((item) => item.value !== null))
        ma10Series?.setData(calculateMA(mapped, 10).filter((item) => item.value !== null))
        ma20Series?.setData(calculateMA(mapped, 20).filter((item) => item.value !== null))
        ma30Series?.setData(calculateMA(mapped, 30).filter((item) => item.value !== null))
        volumeSeries?.setData(
          mapped.map((item, index) => ({
            time: item.businessDay,
            value: Math.round((item.volume || 0) / 10000),
            color:
              index > 0 && item.close < mapped[index - 1].close
                ? '#16a34a'
                : '#ef4444',
          })),
        )
        overviewSeries?.setData(mapped.map((item) => ({ time: item.businessDay, value: item.close })))

        const highest = [...mapped].sort((a, b) => b.high - a.high)[0]
        const lowest = [...mapped].sort((a, b) => a.low - b.low)[0]
        if (candleSeries) {
          candleSeries.createPriceLine({
            price: highest.high,
            color: '#ef4444',
            lineStyle: LineStyle.Dashed,
            lineWidth: 1,
            axisLabelVisible: true,
            title: '',
          })
          candleSeries.createPriceLine({
            price: lowest.low,
            color: '#ef4444',
            lineStyle: LineStyle.Dashed,
            lineWidth: 1,
            axisLabelVisible: true,
            title: '',
          })
          createSeriesMarkers(candleSeries, [
            {
              time: highest.businessDay,
              position: 'aboveBar',
              color: '#ef4444',
              shape: 'circle',
              text: formatNumber(highest.high),
            },
            {
              time: lowest.businessDay,
              position: 'belowBar',
              color: '#ef4444',
              shape: 'circle',
              text: formatNumber(lowest.low),
            },
          ])
        }

        chartRef.current.timeScale().fitContent()
        chartRef.current.timeScale().setVisibleLogicalRange({
          from: Math.max(mapped.length - defaultVisibleBars, 0),
          to: Math.max(mapped.length + 1, defaultVisibleBars),
        })
      } catch (loadError) {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : '加载重大指数失败')
        setPoints([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [code, defaultVisibleBars])

  const legend = useMemo(
    () => [
      { label: '日K', color: '#ef4444', solid: true },
      { label: 'MA5', color: '#5272d6' },
      { label: 'MA10', color: '#8ac86c' },
      { label: 'MA20', color: '#f4c35b' },
      { label: 'MA30', color: '#f18a8a' },
    ],
    [],
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{name}</span>
          <span className="text-[11px] tabular-nums text-slate-500">{latest?.date || '--'}</span>
          <span className={cn('text-sm font-semibold tabular-nums', titleTone)}>
            {formatNumber(latest?.close)}{' '}
            <span className="font-medium">{latestChangePct == null ? '--' : formatPercent(latestChangePct)}</span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          {legend.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span
                className={item.solid ? 'h-3 w-7 shrink-0 rounded-sm' : 'h-2.5 w-2.5 shrink-0 rounded-full border-[3px] bg-white'}
                style={{
                  backgroundColor: item.solid ? item.color : 'white',
                  borderColor: item.solid ? item.color : item.color,
                }}
              />
              <span className="whitespace-nowrap">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white px-2 py-3 sm:px-3 dark:border-slate-800 dark:bg-slate-950/30">
        <div ref={containerRef} className="h-[min(42vh,400px)] w-full min-h-[260px] md:h-[min(44vh,440px)] md:min-h-[300px]" />
        {loading ? (
          <div className="absolute inset-3 flex items-center justify-center gap-2 rounded-lg bg-white/88 text-xs text-slate-500 backdrop-blur-sm dark:bg-slate-950/80 dark:text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            正在加载{name}K线…
          </div>
        ) : null}
        {!loading && error ? (
          <div className="absolute inset-3 flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-4 text-center text-xs text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        ) : null}
        {!loading && !error && !points.length ? (
          <div className="absolute inset-3 flex items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white/92 px-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-400">
            暂无{name}K线数据
          </div>
        ) : null}
      </div>

      {latest ? (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">开盘 / 收盘</div>
            <div className="mt-1 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {formatNumber(latest.open)} / {formatNumber(latest.close)}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">最高 / 最低</div>
            <div className="mt-1 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {formatNumber(latest.high)} / {formatNumber(latest.low)}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">成交量(万)</div>
            <div className="mt-1 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{formatNumber((latest.volume || 0) / 10000, 2)}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">涨跌</div>
            <div className={cn('mt-1 text-sm font-semibold tabular-nums', titleTone)}>
              {formatNumber(latestChange)} / {latestChangePct == null ? '--' : formatPercent(latestChangePct)}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
