import { useCallback, useEffect, useState } from 'react'
import { Building2, Calendar, Loader2, RefreshCw, Tag, TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getStockBasicInfo, getStockFinancialInfo, getStockRealtime, searchStocks } from '@/lib/marketApi'
import { symbolToBareCode } from './symbolSearchUtils'

type StockBasicDataPanelProps = {
  symbol: string
  stockName?: string
}

function formatNum(value: number | null | undefined, digits = 2): string {
  if (value == null || Number.isNaN(value)) return '--'
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

function formatOptionalNum(value: number | null | undefined, digits = 2): string {
  if (value == null || Number.isNaN(value) || value === 0) return '--'
  return formatNum(value, digits)
}

function formatLargeNum(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value) || value === 0) return '--'
  const abs = Math.abs(value)
  if (abs >= 1e8) return `${(value / 1e8).toFixed(2)} 亿`
  if (abs >= 1e4) return `${(value / 1e4).toFixed(2)} 万`
  return formatNum(value)
}

function formatMarketCapYi(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value) || value === 0) return '--'
  return `${formatNum(value, 2)} 亿`
}

export function StockBasicDataPanel({ symbol, stockName }: StockBasicDataPanelProps) {
  const code = symbolToBareCode(symbol)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [basic, setBasic] = useState<Awaited<ReturnType<typeof getStockBasicInfo>> | null>(null)
  const [quote, setQuote] = useState<Awaited<ReturnType<typeof getStockRealtime>>[0] | null>(null)
  const [financial, setFinancial] = useState<Awaited<ReturnType<typeof getStockFinancialInfo>> | null>(null)

  const load = useCallback(async () => {
    if (!code) return
    setLoading(true)
    setError(null)
    try {
      const [basicRes, quoteRes, finRes, searchRes] = await Promise.allSettled([
        getStockBasicInfo(code),
        getStockRealtime(code),
        getStockFinancialInfo(code),
        searchStocks(code),
      ])

      if (basicRes.status === 'fulfilled') {
        setBasic(basicRes.value)
      } else if (searchRes.status === 'fulfilled' && searchRes.value[0]) {
        const hit = searchRes.value[0]
        setBasic({
          code: hit.code,
          name: hit.name,
          market: hit.market || '',
          industry: hit.industry || '',
          concept: hit.concept || '',
          listDate: '',
        })
      } else {
        setBasic(null)
      }

      if (quoteRes.status === 'fulfilled') setQuote(quoteRes.value[0] ?? null)
      else setQuote(null)

      if (finRes.status === 'fulfilled') setFinancial(finRes.value)
      else setFinancial(null)

      const hasAny =
        (basicRes.status === 'fulfilled' || (searchRes.status === 'fulfilled' && searchRes.value.length > 0)) &&
        (quoteRes.status === 'fulfilled' || finRes.status === 'fulfilled')

      if (!hasAny && basicRes.status === 'rejected' && quoteRes.status === 'rejected') {
        throw basicRes.reason
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载基础数据失败')
    } finally {
      setLoading(false)
    }
  }, [code])

  useEffect(() => {
    void load()
  }, [load])

  const displayName = stockName || basic?.name || quote?.name || symbol
  const changePct = quote?.changePct ?? 0
  const isUp = changePct >= 0

  const pe = financial?.pe || quote?.pe
  const pb = financial?.pb || quote?.pb
  const marketLabel = basic?.market || quote?.market || (symbol.endsWith('.SH') ? '沪' : symbol.endsWith('.SZ') ? '深' : symbol.endsWith('.BJ') ? '京' : '--')

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 dark:border-slate-800 dark:bg-slate-950/60">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-slate-400" />
        <span className="text-sm text-slate-500">加载基础数据中…</span>
      </div>
    )
  }

  const hasQuote = Boolean(quote && quote.price > 0)
  const hasBasicMeta = Boolean(basic?.industry || basic?.concept || basic?.listDate || marketLabel !== '--')
  const hasFinancial = Boolean(pe || pb || quote?.totalMarketCap)

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
          {error}
        </div>
      ) : null}

      {!hasQuote && !hasBasicMeta && !hasFinancial ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40">
          暂无基础数据。请确认后端已启动且可访问东财行情接口。
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{displayName}</h2>
            <p className="mt-1 font-mono text-sm text-slate-500">{symbol}</p>
          </div>
          {hasQuote ? (
            <div className="text-right">
              <div className="text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {formatNum(quote!.price)}
              </div>
              <div
                className={cn(
                  'mt-1 flex items-center justify-end gap-1 text-sm font-semibold',
                  isUp ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400',
                )}
              >
                {isUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {isUp ? '+' : ''}
                {formatNum(quote!.change)} ({isUp ? '+' : ''}
                {formatNum(changePct)}%)
              </div>
              {quote!.updateTime ? (
                <p className="mt-1 text-[11px] text-slate-400">更新 {quote!.updateTime}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        {hasQuote ? (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: '今开', value: formatNum(quote!.open) },
              { label: '最高', value: formatNum(quote!.high) },
              { label: '最低', value: formatNum(quote!.low) },
              { label: '昨收', value: formatNum(quote!.prevClose) },
              { label: '成交量', value: formatLargeNum(quote!.volume) },
              { label: '成交额', value: formatLargeNum(quote!.amount) },
              { label: '换手率', value: quote!.turnoverRate != null ? `${formatOptionalNum(quote!.turnoverRate)}%` : '--' },
              { label: '量比', value: formatOptionalNum(quote!.volumeRatio) },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-900/60">
                <div className="text-[11px] text-slate-500">{label}</div>
                <div className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{value}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950/60">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Building2 className="h-4 w-4 text-blue-500" />
            基本信息
          </h3>
          <dl className="space-y-3 text-sm">
            {[
              { icon: Tag, label: '所属行业', value: basic?.industry },
              { icon: Tag, label: '概念板块', value: basic?.concept },
              { icon: Building2, label: '上市市场', value: marketLabel },
              { icon: Calendar, label: '上市日期', value: basic?.listDate },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex gap-3">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="mt-0.5 text-slate-800 dark:text-slate-200">{value?.trim() || '--'}</dd>
                </div>
              </div>
            ))}
          </dl>
          {!basic?.industry && !basic?.concept ? (
            <p className="mt-3 text-[11px] text-slate-400">
              行业/概念/估值来自腾讯财经 + 东财实时接口；无需 Tushare 同步即可展示。
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950/60">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <BarChartIcon />
              估值指标
            </h3>
            {financial?.reportDate ? (
              <span className="text-[11px] text-slate-400">报告期 {financial.reportDate}</span>
            ) : (
              <span className="text-[11px] text-slate-400">来源：东财实时</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: '市盈率 PE', value: formatOptionalNum(pe) },
              { label: '市净率 PB', value: formatOptionalNum(pb) },
              { label: '总市值', value: formatMarketCapYi(quote?.totalMarketCap) },
              { label: '流通市值', value: formatMarketCapYi(quote?.circulatingMarketCap) },
              { label: '市销率 PS', value: formatOptionalNum(financial?.ps) },
              { label: 'ROE', value: financial?.roe ? `${formatOptionalNum(financial.roe)}%` : '--' },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-900/60">
                <div className="text-[11px] text-slate-500">{label}</div>
                <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void load()}
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        刷新数据
      </button>
    </div>
  )
}

function BarChartIcon() {
  return (
    <svg className="h-4 w-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3v18h18" />
      <path d="M7 16v-5M12 16V8M17 16v-9" />
    </svg>
  )
}
