import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import { marked } from 'marked'
import {
  dailyApi,
  type DailyMarketState,
  type DailyStockRow,
  type StockMetrics,
} from '@/lib/dailyApi'
import {
  ANALYSIS_REPORT_BODY_CLASSNAME,
  refineOpportunityReportMarkdown,
} from '@/features/daily/analysisReportDisplay'
import { StockScoreCard } from '@/features/daily/components/StockScoreCard'
import { DailyKlinePanel } from '@/features/daily/components/DailyKlinePanel'
import { WorkbenchLayout } from '@/components/layout/WorkbenchLayout'
import { useWorkbenchChrome } from '@/components/layout/WorkbenchChromeContext'
import { cnActiveListItem, DAILY_WORKBENCH_COLUMN_HEADER, toneByChangePct } from '@/features/daily/dailyLayoutShared'
import { normalizeCnSymbol } from '@/lib/symbols'
import { listFollowedStocksSafe, type FollowedStockRow } from '@/lib/watchlistApi'
import { searchTradingStocks } from '@/lib/tradingApi'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'

function todayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function scoreClass(score?: number): string {
  if (score == null) return 'text-slate-500'
  if (score >= 80) return 'text-amber-600 dark:text-amber-400'
  if (score >= 65) return 'text-violet-600 dark:text-violet-400'
  if (score >= 50) return 'text-blue-600 dark:text-blue-400'
  return 'text-slate-500'
}

function toDisplayHtml(content: string): string {
  const t = content.trim()
  if (t.startsWith('<')) return t
  return marked.parse(refineOpportunityReportMarkdown(t)) as string
}

type AnalyzerTab = 'single_expert' | 'multi_agent' | 'intraday'

/** DailyAPI 在监控未开启时用 DB 持仓填充列表，price/change_pct 占位为 0，需拉一次实时接口。 */
function isQuotationPlaceholder(stocks: DailyStockRow[] | undefined): boolean {
  if (!stocks?.length) return false
  return stocks.every((s) => s.price == null || Number(s.price) === 0)
}

/** 已有一部分行情但仍有 0 价（例如新加自选尚未合并实时。） */
function hasStaleZeroRows(stocks: DailyStockRow[] | undefined): boolean {
  if (!stocks?.length) return false
  const hasZero = stocks.some((s) => s.price == null || Number(s.price) === 0)
  const hasPrice = stocks.some((s) => s.price != null && Number(s.price) !== 0)
  return hasZero && hasPrice
}

/** dailyapi 与主库路径不一致时，用 Go 自选列表兜底，避免左侧「暂无自选股」 */
function mergeDailyStateWithFollowed(
  daily: DailyMarketState,
  followed: FollowedStockRow[],
): DailyMarketState {
  if (!followed.length) return daily
  const quoteBy = new Map<string, DailyStockRow>()
  for (const s of daily.stocks ?? []) {
    const k = normalizeCnSymbol(s.symbol) || s.symbol
    quoteBy.set(k, s)
  }
  const out: DailyStockRow[] = []
  const seen = new Set<string>()
  for (const r of followed) {
    const sym = normalizeCnSymbol(r.stockCode) || r.stockCode.trim().toUpperCase()
    if (!sym || seen.has(sym)) continue
    seen.add(sym)
    const q = quoteBy.get(sym)
    if (q) {
      out.push(q)
    } else {
      const qty = r.quantity
      const positionSize =
        qty != null && !Number.isNaN(Number(qty)) ? Math.round(Number(qty)) : 0
      out.push({
        symbol: sym,
        name: (r.stockName && r.stockName.trim()) || sym,
        price: 0,
        change_pct: 0,
        type: 'holding',
        asset_type: 'stock',
        cost_price: r.costPrice,
        position_size: positionSize,
        volume_ratio: 0,
        is_starred: r.isStarred,
        status: '等待监控开启',
      })
    }
  }
  for (const s of daily.stocks ?? []) {
    const k = normalizeCnSymbol(s.symbol) || s.symbol
    if (!seen.has(k)) out.push(s)
  }
  return { ...daily, stocks: out }
}

export function ExpertAnalysisPage() {
  const { leftCollapsed } = useWorkbenchChrome()
  const { confirm } = useConfirm()
  const { toast } = useToast()
  const autoRealtimeTriedRef = useRef(false)
  const holdingsKeyRef = useRef('')
  const [market, setMarket] = useState<DailyMarketState | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null)
  const [showKline, setShowKline] = useState(false)
  const [score, setScore] = useState<StockMetrics | null>(null)
  const [calculatingScore, setCalculatingScore] = useState(false)
  const [activeTab, setActiveTab] = useState<AnalyzerTab>('single_expert')
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [selectedAnalysisDate, setSelectedAnalysisDate] = useState<string>(todayStr)
  const [analysisHtml, setAnalysisHtml] = useState('')
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState('')
  const [agents, setAgents] = useState<{ slug: string; name: string }[]>([])
  const [selectedAgents, setSelectedAgents] = useState<string[]>([])
  const [starring, setStarring] = useState<string | null>(null)

  const [showAdd, setShowAdd] = useState(false)
  const [addSymbol, setAddSymbol] = useState('')
  const [addName, setAddName] = useState('')

  const [editRow, setEditRow] = useState<DailyStockRow | null>(null)
  const [editCost, setEditCost] = useState('')
  const [editSize, setEditSize] = useState('')
  const [followedFetchError, setFollowedFetchError] = useState<string | null>(null)

  const stocks = market?.stocks ?? []
  const selected = stocks.find((s) => s.symbol === selectedSymbol)

  const fetchStatus = useCallback(async () => {
    try {
      const followedPromise = listFollowedStocksSafe()
      let data: DailyMarketState
      try {
        data = await dailyApi.getStatus()
      } catch {
        data = {
          index: { name: '上证指数', price: 0, change_pct: 0 },
          stocks: [],
        }
      }
      const { rows: followed, error: folErr } = await followedPromise
      setFollowedFetchError(folErr)
      const merged = mergeDailyStateWithFollowed(data, followed)
      const key = (merged.stocks ?? [])
        .map((s) => s.symbol)
        .sort()
        .join(',')
      if (key !== holdingsKeyRef.current) {
        holdingsKeyRef.current = key
        autoRealtimeTriedRef.current = false
      }
      setMarket(merged)

      const shouldSeedRealtime =
        !autoRealtimeTriedRef.current &&
        (isQuotationPlaceholder(merged.stocks) || hasStaleZeroRows(merged.stocks))
      if (shouldSeedRealtime) {
        autoRealtimeTriedRef.current = true
        try {
          const r = await dailyApi.refreshRealtime()
          if (r.status === 'success') {
            setMarket((prev) =>
              prev
                ? {
                    ...prev,
                    stocks: r.stocks ?? prev.stocks,
                    index: r.index ?? prev.index,
                    last_update: r.last_update ?? prev.last_update,
                  }
                : prev,
            )
            if (isQuotationPlaceholder(r.stocks)) {
              autoRealtimeTriedRef.current = false
            }
          } else {
            autoRealtimeTriedRef.current = false
          }
        } catch {
          autoRealtimeTriedRef.current = false
        }
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    void fetchStatus()
    void (async () => {
      try {
        const res = await dailyApi.getAgents()
        if (res.status === 'success' && res.agents?.length) {
          setAgents(res.agents)
          setSelectedAgents(res.agents.map((a) => a.slug))
        }
      } catch {
        /* ignore */
      }
    })()
  }, [fetchStatus])

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void fetchStatus()
    }, 15000)
    return () => window.clearInterval(id)
  }, [fetchStatus])

  const handleRefreshRealtime = async () => {
    setRefreshing(true)
    try {
      const data = await dailyApi.refreshRealtime()
      if (data.status === 'success') {
        setMarket((m) =>
          m
            ? {
                ...m,
                stocks: data.stocks ?? m.stocks,
                index: data.index ?? m.index,
                last_update: data.last_update ?? m.last_update,
              }
            : m,
        )
      }
    } catch (e) {
      console.error(e)
    } finally {
      setRefreshing(false)
    }
  }

  const loadAnalysisDates = useCallback(
    async (symbol: string, tab: AnalyzerTab) => {
      try {
        const res = await dailyApi.getAnalysisDates(symbol, tab)
        if (res.status === 'success' && res.dates) {
          setAvailableDates(res.dates.filter((d) => d !== todayStr()))
        } else setAvailableDates([])
      } catch {
        setAvailableDates([])
      }
    },
    [],
  )

  const loadStockMetrics = useCallback(async (symbol: string, date: string) => {
    try {
      const res = await dailyApi.getStockMetrics(symbol, date)
      if (res.status === 'success' && res.data) setScore(res.data)
      else setScore(null)
    } catch {
      setScore(null)
    }
  }, [])

  const loadLatestAnalysis = useCallback(async (symbol: string, tab: AnalyzerTab) => {
    setLoadingAnalysis(true)
    setAnalysisHtml('')
    try {
      const res = await dailyApi.getLatestAnalysis(symbol, tab)
      if (res.status === 'success' && res.data) {
        const raw = res.data.ai_analysis ?? ''
        if (raw) setAnalysisHtml(toDisplayHtml(raw))
        else if (res.data.html) setAnalysisHtml(res.data.html)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingAnalysis(false)
    }
  }, [])

  const loadHistoryAnalysis = useCallback(async (symbol: string, date: string, tab: AnalyzerTab) => {
    setLoadingAnalysis(true)
    setAnalysisHtml('')
    try {
      const res = await dailyApi.getAnalysisHistory(symbol, date, tab)
      if (res.status === 'success' && res.data) {
        const raw = res.data.ai_analysis ?? ''
        if (raw) setAnalysisHtml(toDisplayHtml(raw))
        else if (res.data.html) setAnalysisHtml(res.data.html)
      } else {
        setAnalysisHtml(`<p class="text-center text-slate-500">暂无 ${date} 的报告</p>`)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingAnalysis(false)
    }
  }, [])

  const selectStock = (row: DailyStockRow) => {
    const t = todayStr()
    setSelectedSymbol(row.symbol)
    setSelectedAnalysisDate(t)
    setScore(null)
    setAnalysisHtml('')
    void loadAnalysisDates(row.symbol, activeTab)
    void loadStockMetrics(row.symbol, t)
    void loadLatestAnalysis(row.symbol, activeTab)
  }

  const switchTab = (tab: AnalyzerTab) => {
    if (tab === activeTab) return
    setActiveTab(tab)
    if (!selectedSymbol) return
    void loadAnalysisDates(selectedSymbol, tab)
    if (selectedAnalysisDate === todayStr()) void loadLatestAnalysis(selectedSymbol, tab)
    else void loadHistoryAnalysis(selectedSymbol, selectedAnalysisDate, tab)
  }

  const onAnalysisDateChange = (date: string) => {
    setSelectedAnalysisDate(date)
    if (!selectedSymbol) return
    void loadStockMetrics(selectedSymbol, date)
    if (date === todayStr()) void loadLatestAnalysis(selectedSymbol, activeTab)
    else void loadHistoryAnalysis(selectedSymbol, date, activeTab)
  }

  const runScoreCalculation = async () => {
    if (!selectedSymbol) return
    setCalculatingScore(true)
    try {
      const res = await dailyApi.calculateStockScore(selectedSymbol)
      if (res.status === 'success' && res.data) setScore(res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setCalculatingScore(false)
      void loadStockMetrics(selectedSymbol, todayStr())
    }
  }

  const runAIAnalysis = async () => {
    if (!selectedSymbol || analyzing) return
    setAnalyzing(true)
    setAnalysisProgress('')
    setAnalysisHtml('')
    let accumulated = ''

    const onProgress = (ev: { type: string; message?: string; content?: string }) => {
      if (ev.type === 'progress' || ev.type === 'step') {
        setAnalysisProgress((ev.message ?? ev.content) || '')
      } else if (ev.type === 'token' && ev.content) {
        accumulated += ev.content
        setAnalysisHtml(toDisplayHtml(accumulated))
      }
    }

    const onComplete = (ev: { type: string; content?: string }) => {
      if (ev.type === 'final_html' && ev.content) {
        const c = ev.content.trim()
        setAnalysisHtml(
          c.startsWith('<') ? c : (marked.parse(refineOpportunityReportMarkdown(c)) as string),
        )
      } else if (ev.type === 'result' && ev.content) {
        setAnalysisHtml(toDisplayHtml(ev.content))
      }
      if (ev.type === 'complete') {
        setAnalyzing(false)
        if (selectedSymbol && activeTab !== 'intraday') {
          window.setTimeout(() => {
            void loadAnalysisDates(selectedSymbol, activeTab)
            void loadLatestAnalysis(selectedSymbol, activeTab)
          }, 400)
        }
      }
    }

    const onError = () => {
      setAnalyzing(false)
    }

    try {
      if (activeTab === 'intraday') {
        await dailyApi.analyzeIntraday(selectedSymbol, onProgress, onComplete, onError)
      } else {
        await dailyApi.analyzeStockStream(
          selectedSymbol,
          activeTab,
          activeTab === 'multi_agent' ? selectedAgents : [],
          onProgress,
          onComplete,
          onError,
        )
      }
    } finally {
      setAnalyzing(false)
    }
  }

  const toggleStar = async (row: DailyStockRow) => {
    if (starring === row.symbol) return
    setStarring(row.symbol)
    try {
      const res = await dailyApi.toggleStarHolding(row.symbol)
      if (res.status === 'success' && typeof res.is_starred === 'boolean') {
        setMarket((m) =>
          m
            ? {
                ...m,
                stocks: m.stocks.map((s) =>
                  s.symbol === row.symbol ? { ...s, is_starred: res.is_starred } : s,
                ),
              }
            : m,
        )
      }
    } catch (e) {
      console.error(e)
    } finally {
      setStarring(null)
    }
  }

  const confirmRemove = async (row: DailyStockRow) => {
    const confirmed = await confirm({
      title: '确认移除',
      description: `确定移除 ${row.name}（${row.symbol}）？`,
      confirmText: '移除',
      cancelText: '取消',
      variant: 'destructive',
    })
    if (!confirmed) return
    try {
      await dailyApi.deleteHolding(row.symbol)
      if (selectedSymbol === row.symbol) {
        setSelectedSymbol(null)
        setAnalysisHtml('')
      }
      await fetchStatus()
      toast({
        type: 'success',
        title: '移除成功',
        description: `已移除 ${row.name}`,
      })
    } catch (e) {
      toast({
        type: 'error',
        title: '移除失败',
        description: e instanceof Error ? e.message : '移除失败',
      })
    }
  }

  const submitAdd = async () => {
    const sym = addSymbol.trim()
    if (!sym) return
    const normalized = normalizeCnSymbol(sym) || sym.trim().toUpperCase()
    try {
      let name = addName.trim()
      const core = normalized.replace(/\.(SH|SZ|BJ)$/i, '')
      if (!name || name === normalized || name === core) {
        try {
          const { results } = await searchTradingStocks(core)
          const exact = results.find((r) => (normalizeCnSymbol(r.symbol) || r.symbol) === normalized)
          if (exact?.name?.trim()) {
            name = exact.name.trim()
          } else if (results[0]?.name?.trim()) {
            const fc = (normalizeCnSymbol(results[0].symbol) || results[0].symbol).replace(
              /\.(SH|SZ|BJ)$/i,
              '',
            )
            if (fc === core) name = results[0].name.trim()
          }
        } catch {
          /* 略过，交由 dailyapi 再解析 */
        }
      }
      await dailyApi.addHolding({
        symbol: normalized,
        name: name || normalized,
        asset_type: 'stock',
      })
      setShowAdd(false)
      setAddSymbol('')
      setAddName('')
      await fetchStatus()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '添加失败')
    }
  }

  const submitEdit = async () => {
    if (!editRow) return
    try {
      await dailyApi.updateHolding(editRow.symbol, {
        cost_price: editCost ? Number(editCost) : undefined,
        position_size: editSize ? Number.parseInt(editSize, 10) : undefined,
      })
      setEditRow(null)
      await fetchStatus()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '更新失败')
    }
  }

  const openEdit = (row: DailyStockRow) => {
    setEditRow(row)
    setEditCost(row.cost_price != null ? String(row.cost_price) : '')
    setEditSize(row.position_size != null ? String(row.position_size) : '')
  }

  const tabTitle =
    activeTab === 'multi_agent'
      ? 'AI 多空辩论分析报告'
      : activeTab === 'intraday'
        ? 'AI 盘中实时分析'
        : 'AI 专家诊断报告'

  const leftPanel = (
    <div className="flex h-full min-h-0 flex-col bg-[#fbfcfd] dark:bg-slate-950">
      <div className={DAILY_WORKBENCH_COLUMN_HEADER}>
        <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">专家分析</div>
        <button
          type="button"
          className="ml-auto rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          title="添加自选"
          onClick={() => setShowAdd(true)}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="shrink-0 border-b border-slate-200 p-3 dark:border-slate-800">
        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex items-center justify-between">
            <div>
              <div className="mb-1 text-[10px] text-slate-500">{market?.index?.name ?? '上证指数'}</div>
              <div className="font-mono text-lg tabular-nums text-slate-900 dark:text-slate-100">
                {market?.index?.price?.toFixed(2) ?? '----.--'}
              </div>
            </div>
            <span className={cn('text-sm font-mono font-semibold', toneByChangePct(market?.index?.change_pct ?? 0))}>
              {(market?.index?.change_pct ?? 0) >= 0 ? '+' : ''}
              {(market?.index?.change_pct ?? 0).toFixed(2)}%
            </span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all"
              style={{ width: `${Math.min(Math.abs(market?.index?.change_pct ?? 0) * 5, 100)}%` }}
            />
          </div>
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {stocks.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            {followedFetchError ? (
              <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100">
                无法从主后端加载自选列表（请确认 Go 服务已启动且端口与前端代理一致）：{followedFetchError}
              </p>
            ) : null}
            <p className="mb-2">暂无自选股</p>
            <p className="mb-3 text-xs text-slate-400 dark:text-slate-500">
              自选保存在 AI_DATA_DIR/stock.db（backend/.env 中配置统一数据根；Go 与 dailyapi 须一致）。
            </p>
            <button type="button" className="text-blue-600 hover:underline dark:text-cyan-500" onClick={() => setShowAdd(true)}>
              添加股票
            </button>
          </div>
        ) : (
          <div className="flex flex-col py-1">
            {stocks.map((stock) => (
              <div key={stock.symbol} className="group relative">
                <div
                  className={cn(cnActiveListItem(selectedSymbol === stock.symbol), 'cursor-pointer pr-10')}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectStock(stock)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      selectStock(stock)
                    }
                  }}
                >
                  <div className="w-full text-left">
                    <div className="mb-1 flex items-center justify-between">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <button
                          type="button"
                          className="shrink-0 rounded p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title={stock.is_starred ? '取消收藏' : '收藏'}
                          disabled={starring === stock.symbol}
                          onClick={(e) => {
                            e.stopPropagation()
                            void toggleStar(stock)
                          }}
                        >
                          <Star
                            className={cn(
                              'h-3.5 w-3.5',
                              stock.is_starred ? 'fill-amber-400 text-amber-500' : 'text-slate-400',
                            )}
                          />
                        </button>
                        <span className="shrink-0 font-mono text-sm font-bold text-slate-900 dark:text-slate-100">{stock.symbol}</span>
                        <span
                          className={cn(
                            'shrink-0 rounded border px-1 py-[1px] text-[10px]',
                            stock.asset_type === 'etf'
                              ? 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300'
                              : 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300',
                          )}
                        >
                          {stock.asset_type === 'etf' ? 'ETF' : '个股'}
                        </span>
                        {(stock.position_size ?? 0) > 0 ? (
                          <span className="shrink-0 rounded border border-blue-200 px-1 text-[10px] text-blue-700 dark:border-blue-500/40 dark:text-blue-300">
                            持
                          </span>
                        ) : null}
                      </div>
                      <span className={cn('font-mono tabular-nums', toneByChangePct(stock.change_pct ?? 0))}>
                        {stock.price != null ? stock.price.toFixed(2) : '----'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="max-w-[120px] truncate text-xs text-slate-600 dark:text-slate-400">{stock.name}</span>
                      <span className={cn('font-mono text-xs font-semibold', toneByChangePct(stock.change_pct ?? 0))}>
                        {(stock.change_pct ?? 0) >= 0 ? '+' : ''}
                        {(stock.change_pct ?? 0).toFixed(2)}%
                      </span>
                    </div>
                    <div className="mt-1 flex justify-between text-[11px] text-slate-500">
                      <span className={cn('font-mono font-bold', scoreClass(stock.composite_score))}>
                        {stock.composite_score != null ? `${stock.composite_score}分` : '—'}
                      </span>
                      {stock.cost_price != null && stock.cost_price > 0 && stock.price != null ? (
                        <span
                          className={cn(
                            'font-mono',
                            toneByChangePct(((stock.price - stock.cost_price) / stock.cost_price) * 100),
                          )}
                        >
                          盈亏 {(((stock.price - stock.cost_price) / stock.cost_price) * 100).toFixed(2)}%
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="absolute right-1.5 top-2 z-10 flex gap-0.5 rounded-md border border-slate-200 bg-white/95 p-0.5 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 dark:border-slate-700 dark:bg-slate-900/95">
                  <button
                    type="button"
                    className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="编辑"
                    onClick={(e) => {
                      e.stopPropagation()
                      openEdit(stock)
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                    title="移除"
                    onClick={(e) => {
                      e.stopPropagation()
                      void confirmRemove(stock)
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )

  const mainPanel = (
    <div className="flex h-full min-h-0 flex-col bg-[#fbfcfd] dark:bg-slate-950">
      <div className={DAILY_WORKBENCH_COLUMN_HEADER}>
        <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-1.5">
          <div className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            <span>专家路由</span>
            <ChevronRight className="h-2.5 w-2.5 shrink-0" />
            <span>DailyAPI</span>
          </div>
          <h1 className="min-w-0 shrink truncate text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {selected ? `${selected.name} ${selectedSymbol}` : '专家分析'}
          </h1>
        </div>
      </div>
      {!selectedSymbol ? (
        <div className="flex flex-1 flex-col items-center justify-center bg-[#f3f5f7] text-sm text-slate-500 dark:bg-slate-950">
          从左侧自选列表选择标的以查看诊断
          <p className="mt-1 text-xs text-slate-400">顶部左侧按钮可展开/收起列表</p>
        </div>
      ) : (
        <>
          <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{selected?.name}</span>
              <span className="shrink-0 rounded border border-slate-200 bg-slate-50 px-2 py-px font-mono text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                {selectedSymbol}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  'h-8 border-slate-200 text-xs dark:border-slate-700',
                  showKline && 'border-blue-300 bg-blue-50 text-blue-800 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-300',
                )}
                onClick={() => setShowKline((v) => !v)}
              >
                K线图
              </Button>
              <button
                type="button"
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"
                disabled={refreshing}
                title="刷新行情"
                onClick={() => void handleRefreshRealtime()}
              >
                <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
              </button>
            </div>
          </div>
          {showKline && selectedSymbol ? (
            <div className="min-h-0 flex-1 bg-[#f3f5f7] p-3 dark:bg-slate-950">
              <DailyKlinePanel symbol={selectedSymbol} className="h-full min-h-[360px]" />
            </div>
          ) : (
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-4 bg-[#f3f5f7] p-3 sm:p-4 dark:bg-slate-950">
                <div className="mx-auto max-w-5xl space-y-4">
                  {score ? (
                    <StockScoreCard metrics={score} loading={calculatingScore} onRefresh={() => void runScoreCalculation()} />
                  ) : (
                    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white p-6 dark:border-slate-700 dark:bg-slate-950">
                      <span className="text-sm text-slate-500">暂无评分数据</span>
                      <Button
                        type="button"
                        size="sm"
                        className="border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100 dark:border-cyan-500/40 dark:bg-cyan-950/40 dark:text-cyan-200"
                        disabled={calculatingScore}
                        onClick={() => void runScoreCalculation()}
                      >
                        {calculatingScore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        开始技术评分
                      </Button>
                    </div>
                  )}
                  <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900/60">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
                      <div className="flex flex-wrap gap-4">
                        {(
                          [
                            ['single_expert', '专家诊断'],
                            ['multi_agent', '多空辩论'],
                            ['intraday', '盘中分析'],
                          ] as const
                        ).map(([id, label]) => (
                          <button
                            key={id}
                            type="button"
                            className={cn(
                              'border-b-2 pb-2 text-sm font-medium transition-colors',
                              activeTab === id
                                ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
                            )}
                            onClick={() => switchTab(id)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <select
                        value={selectedAnalysisDate}
                        onChange={(e) => onAnalysisDateChange(e.target.value)}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                      >
                        <option value={todayStr()}>今日 ({todayStr()})</option>
                        {availableDates.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {activeTab === 'multi_agent' && agents.length > 0 ? (
                    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/60">
                      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">参与辩论的专家</div>
                      <div className="flex flex-wrap gap-2">
                        {agents.map((a) => (
                          <label
                            key={a.slug}
                            className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-700 hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-blue-700 dark:hover:bg-blue-900/20 transition-colors"
                          >
                            <input
                              type="checkbox"
                              className="accent-blue-600 h-3.5 w-3.5"
                              checked={selectedAgents.includes(a.slug)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedAgents((s) => [...s, a.slug])
                                else setSelectedAgents((s) => s.filter((x) => x !== a.slug))
                              }}
                            />
                            {a.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900/60">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                        <span className="h-4 w-1 rounded-full bg-blue-600" />
                        {tabTitle}
                      </h3>
                      <Button
                        type="button"
                        size="sm"
                        disabled={analyzing || loadingAnalysis}
                        className="h-8 bg-blue-600 text-xs text-white hover:bg-blue-700"
                        onClick={() => void runAIAnalysis()}
                      >
                        {analyzing || loadingAnalysis ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        {analyzing ? '正在生成…' : loadingAnalysis ? '加载中…' : '生成最新分析'}
                      </Button>
                    </div>
                    {analysisProgress && analyzing ? (
                      <div className="mx-5 my-4 truncate rounded-lg border border-blue-200 bg-blue-50 p-3 font-mono text-xs text-blue-700 dark:border-blue-800/50 dark:bg-blue-900/20 dark:text-blue-300">
                        ▶ {analysisProgress}
                      </div>
                    ) : null}
                    <div className="px-5 py-5">
                      {loadingAnalysis && !analysisHtml ? (
                        <div className="flex flex-col items-center gap-2 py-12 text-sm text-gray-500 dark:text-gray-400">
                          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                          正在加载历史报告…
                        </div>
                      ) : analysisHtml ? (
                        <div
                          className={ANALYSIS_REPORT_BODY_CLASSNAME}
                          dangerouslySetInnerHTML={{ __html: analysisHtml }}
                        />
                      ) : (
                        <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                          <Sparkles className="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
                          <p className="text-gray-500 dark:text-gray-400">暂无分析内容</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </>
      )}
    </div>
  )

  return (
    <>
      <WorkbenchLayout
        className="bg-[#f3f5f7] dark:bg-slate-950"
        innerClassName="border border-slate-200/90 bg-[#f7f8fa] dark:border-slate-800 dark:bg-slate-950"
        leftPanelId="expert-analysis-left"
        mainPanelId="expert-analysis-main"
        leftMinPx={248}
        leftMaxPx={360}
        leftSidebarVisible={!leftCollapsed}
        rightSidebarVisible={false}
        left={leftPanel}
        main={mainPanel}
        right={null}
      />
      {showAdd ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 dark:bg-black/60">
          <div className="w-full max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">添加自选</h3>
              <button type="button" className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" onClick={() => setShowAdd(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-500 dark:text-slate-400">代码</label>
              <Input
                value={addSymbol}
                onChange={(e) => setAddSymbol(e.target.value)}
                placeholder="如 600519 或 600519.SH"
                className="border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-500 dark:text-slate-400">名称（可选）</label>
              <Input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="股票名称"
                className="border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" className="border-slate-200 dark:border-slate-700" onClick={() => setShowAdd(false)}>
                取消
              </Button>
              <Button type="button" className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => void submitAdd()}>
                保存
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {editRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 dark:bg-black/60">
          <div className="w-full max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                编辑 {editRow.name}（{editRow.symbol}）
              </h3>
              <button type="button" className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" onClick={() => setEditRow(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-500 dark:text-slate-400">成本价</label>
              <Input
                value={editCost}
                onChange={(e) => setEditCost(e.target.value)}
                className="border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950"
                type="number"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-500 dark:text-slate-400">持仓数量</label>
              <Input
                value={editSize}
                onChange={(e) => setEditSize(e.target.value)}
                className="border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950"
                type="number"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" className="border-slate-200 dark:border-slate-700" onClick={() => setEditRow(null)}>
                取消
              </Button>
              <Button type="button" className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => void submitEdit()}>
                保存
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
