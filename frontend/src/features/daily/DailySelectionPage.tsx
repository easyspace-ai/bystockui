import { useCallback, useEffect, useState } from 'react'
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react'
import { marked } from 'marked'
import { dailyApi, type DailySelection, type StockMetrics } from '@/lib/dailyApi'
import {
  ANALYSIS_REPORT_BODY_CLASSNAME,
  refineOpportunityReportMarkdown,
} from '@/features/daily/analysisReportDisplay'
import { StockScoreCard } from '@/features/daily/components/StockScoreCard'
import { DailyKlinePanel } from '@/features/daily/components/DailyKlinePanel'
import { WorkbenchLayout } from '@/components/layout/WorkbenchLayout'
import { useWorkbenchChrome } from '@/components/layout/WorkbenchChromeContext'
import { cnActiveListItem, DAILY_WORKBENCH_COLUMN_HEADER } from '@/features/daily/dailyLayoutShared'
import { normalizeCnSymbol } from '@/lib/symbols'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useConfirm } from '@/components/ui/confirm-dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

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

export function DailySelectionPage() {
  const { leftCollapsed } = useWorkbenchChrome()
  const { confirm } = useConfirm()
  const [selections, setSelections] = useState<DailySelection[]>([])
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState('')
  const [loadingList, setLoadingList] = useState(false)
  const [runningSelection, setRunningSelection] = useState(false)
  const [selectionSeconds, setSelectionSeconds] = useState(0)
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null)
  const [score, setScore] = useState<StockMetrics | null>(null)
  const [calculatingScore, setCalculatingScore] = useState(false)
  const [analysisHtml, setAnalysisHtml] = useState('')
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState('')
  const [showKline, setShowKline] = useState(false)
  const analyzerMode = 'single_expert'

  // Alert dialog state
  const [alertOpen, setAlertOpen] = useState(false)
  const [alertTitle, setAlertTitle] = useState('')
  const [alertDescription, setAlertDescription] = useState('')

  const selectedStock = selections.find((s) => s.symbol === selectedSymbol) ?? null

  const loadSelections = useCallback(async () => {
    setLoadingList(true)
    try {
      const data = await dailyApi.getDailySelections(selectedDate || undefined)
      setSelections(data.selections ?? [])
      if (data.available_dates?.length) setAvailableDates(data.available_dates)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingList(false)
    }
  }, [selectedDate])

  useEffect(() => {
    void loadSelections()
  }, [loadSelections])

  const loadStockMetrics = useCallback(
    async (symbol: string) => {
      setCalculatingScore(true)
      try {
        const date = selectedDate || null
        const res = await dailyApi.getStockMetrics(symbol, date)
        if (res.status === 'success' && res.data) setScore(res.data)
        else setScore(null)
      } catch {
        setScore(null)
      } finally {
        setCalculatingScore(false)
      }
    },
    [selectedDate],
  )

  const loadLatestAnalysis = useCallback(async (symbol: string) => {
    setLoadingAnalysis(true)
    setAnalysisHtml('')
    try {
      const res = await dailyApi.getLatestAnalysis(symbol, analyzerMode)
      if (res.status !== 'success' || !res.data) return
      const raw = res.data.ai_analysis ?? ''
      if (raw) setAnalysisHtml(toDisplayHtml(raw))
      else if (res.data.html) setAnalysisHtml(res.data.html)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingAnalysis(false)
    }
  }, [])

  const loadHistoryAnalysis = useCallback(
    async (symbol: string, date: string) => {
      setLoadingAnalysis(true)
      setAnalysisHtml('')
      try {
        const res = await dailyApi.getAnalysisHistory(symbol, date, analyzerMode)
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
    },
    [],
  )

  const loadDetail = useCallback(
    (symbol: string) => {
      void loadStockMetrics(symbol)
      const t = todayStr()
      if (!selectedDate || selectedDate === t) void loadLatestAnalysis(symbol)
      else void loadHistoryAnalysis(symbol, selectedDate)
    },
    [loadHistoryAnalysis, loadLatestAnalysis, loadStockMetrics, selectedDate],
  )

  const selectStock = (s: DailySelection) => {
    if (selectedSymbol === s.symbol) return
    setSelectedSymbol(s.symbol)
    setScore(null)
    setAnalysisHtml('')
    loadDetail(s.symbol)
  }

  const showAlert = useCallback((title: string, description: string) => {
    setAlertTitle(title)
    setAlertDescription(description)
    setAlertOpen(true)
  }, [])

  const pollReportStatus = () =>
    new Promise<void>((resolve, reject) => {
      const tick = async () => {
        try {
          const st = await dailyApi.getReportStatus()
          if (st.status === 'idle' || st.status === 'success') resolve()
          else if (st.status === 'error') reject(new Error(st.message ?? '选股任务失败'))
          else setTimeout(tick, 2000)
        } catch (e) {
          resolve()
        }
      }
      void tick()
    })

  const runSelectionTask = async () => {
    if (runningSelection) return
    const confirmed = await confirm({
      title: '确定要开始选股扫描吗？',
      description: '这可能需要 1–2 分钟。',
      confirmText: '确定',
      cancelText: '取消',
    })
    if (!confirmed) return
    setRunningSelection(true)
    setSelectionSeconds(0)
    const timer = window.setInterval(() => setSelectionSeconds((x) => x + 1), 1000)
    try {
      const res = await dailyApi.generateReport('candidates')
      if (res.status === 'started' || res.status === 'success') {
        await pollReportStatus()
        showAlert('选股任务完成', '选股任务已成功完成。')
        setSelectedDate('')
        await loadSelections()
      }
    } catch (e) {
      showAlert('执行失败', e instanceof Error ? e.message : '执行失败')
    } finally {
      window.clearInterval(timer)
      setRunningSelection(false)
    }
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
    }
  }

  const runAIAnalysis = async () => {
    if (!selectedSymbol || analyzing) return
    setAnalyzing(true)
    setAnalysisProgress('')
    setAnalysisHtml('')
    let accumulated = ''
    await dailyApi.analyzeStockStream(
      selectedSymbol,
      analyzerMode,
      [],
      (ev) => {
        if (ev.type === 'progress' || ev.type === 'step') {
          setAnalysisProgress((ev.message ?? ev.content) || '')
        } else if (ev.type === 'token' && ev.content) {
          accumulated += ev.content
          setAnalysisHtml(toDisplayHtml(accumulated))
        }
      },
      (ev) => {
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
          if (selectedSymbol) void loadLatestAnalysis(selectedSymbol)
        }
      },
      () => {
        setAnalyzing(false)
      },
    )
    setAnalyzing(false)
  }

  const addToHoldings = async (stock: DailySelection | null) => {
    if (!stock) return
    const confirmed = await confirm({
      title: '加入自选/持仓',
      description: `确定将 ${stock.name}（${stock.symbol}）加入自选/持仓？`,
      confirmText: '确定',
      cancelText: '取消',
    })
    if (!confirmed) return
    const sym = normalizeCnSymbol(stock.symbol) || stock.symbol.trim().toUpperCase()
    try {
      await dailyApi.addHolding({
        symbol: sym,
        name: stock.name,
        asset_type: stock.asset_type ?? 'stock',
      })
      showAlert('已添加', '已成功添加到自选/持仓。')
    } catch (e) {
      showAlert('添加失败', e instanceof Error ? e.message : '添加失败')
    }
  }

  const leftPanel = (
    <div className="flex h-full min-h-0 flex-col bg-[#fbfcfd] dark:bg-slate-950">
      <div className={DAILY_WORKBENCH_COLUMN_HEADER}>
        <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">每日选股</div>
      </div>
      <div className="shrink-0 border-b border-slate-200 px-3 py-2.5 dark:border-slate-800">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">精选列表</span>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              title={runningSelection ? '选股执行中…' : '立即运行选股'}
              disabled={runningSelection}
              className="rounded-md p-1.5 text-blue-600 hover:bg-blue-50 disabled:opacity-50 dark:text-cyan-400 dark:hover:bg-cyan-500/10"
              onClick={() => void runSelectionTask()}
            >
              {runningSelection ? (
                <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600 dark:border-cyan-500/30 dark:border-t-cyan-400" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              title="刷新列表"
              disabled={loadingList}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"
              onClick={() => void loadSelections()}
            >
              <RefreshCw className={cn('h-4 w-4', loadingList && 'animate-spin')} />
            </button>
          </div>
        </div>
        <div className="relative">
          <select
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value)
              setSelectedSymbol(null)
              setScore(null)
              setAnalysisHtml('')
            }}
            className="w-full cursor-pointer appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-xs text-slate-800 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <option value="">最新 ({availableDates[0] ?? 'Today'})</option>
            {availableDates.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        </div>
        {runningSelection ? (
          <div className="mt-2 flex justify-between rounded-md border border-blue-100 bg-blue-50/80 px-2 py-1.5 text-[10px] text-blue-800 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-200">
            <span className="animate-pulse">正在全市场扫描选股中…</span>
            <span className="font-mono">{selectionSeconds}s</span>
          </div>
        ) : null}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {loadingList ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-xs text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin" />
            加载中…
          </div>
        ) : selections.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">该日期暂无选股</div>
        ) : (
          <div className="flex flex-col py-1">
            {selections.map((stock) => (
              <button
                key={stock.symbol}
                type="button"
                onClick={() => selectStock(stock)}
                className={cnActiveListItem(selectedSymbol === stock.symbol)}
              >
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex min-w-0 items-center gap-2">
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
                    {stock.created_at ? (
                      <span className="ml-auto font-mono text-[10px] text-slate-400">{stock.created_at.slice(0, 5)}</span>
                    ) : null}
                  </div>
                  <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {stock.close_price != null ? stock.close_price.toFixed(2) : '----'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="max-w-[140px] truncate text-xs text-slate-600 dark:text-slate-400">{stock.name}</span>
                  {stock.composite_score != null ? (
                    <span className={cn('font-mono text-xs font-bold', scoreClass(stock.composite_score))}>
                      {stock.composite_score}分
                    </span>
                  ) : null}
                </div>
              </button>
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
            <span>选股路由</span>
            <ChevronRight className="h-2.5 w-2.5 shrink-0" />
            <span>DailyAPI</span>
          </div>
          <h1 className="min-w-0 shrink truncate text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {selectedStock ? `${selectedStock.name} ${selectedSymbol}` : '每日选股详情'}
          </h1>
        </div>
      </div>
      {!selectedSymbol ? (
        <div className="flex flex-1 flex-col items-center justify-center bg-[#f3f5f7] text-slate-500 dark:bg-slate-950">
          <ArrowRight className="mb-3 h-10 w-10 opacity-30" />
          <p className="text-sm font-medium">请从左侧选择一只股票查看详情</p>
          <p className="mt-1 text-xs text-slate-400">也可点击顶部左侧按钮展开/收起列表</p>
        </div>
      ) : (
        <>
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{selectedStock?.name}</span>
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
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1 bg-blue-600 text-xs text-white hover:bg-blue-700"
                onClick={() => void addToHoldings(selectedStock)}
              >
                <Plus className="h-3.5 w-3.5" />
                加入自选
              </Button>
              <button
                type="button"
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                title="刷新详情"
                onClick={() => selectedSymbol && loadDetail(selectedSymbol)}
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="rounded-md p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                title="清空选择"
                onClick={() => setSelectedSymbol(null)}
              >
                <X className="h-5 w-5" />
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
                  {calculatingScore && !score ? (
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      正在加载评分数据…
                    </div>
                  ) : score ? (
                    <StockScoreCard
                      metrics={score}
                      loading={calculatingScore}
                      defaultExpanded
                      onRefresh={() => void runScoreCalculation()}
                    />
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950">
                      暂无详细评分数据
                      <button
                        type="button"
                        className="ml-2 text-blue-600 hover:underline dark:text-cyan-400"
                        onClick={() => void runScoreCalculation()}
                      >
                        重新计算
                      </button>
                    </div>
                  )}
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                        <span className="h-4 w-1 rounded-full bg-blue-600" />
                        AI 机会诊断报告
                      </h3>
                      <Button
                        type="button"
                        size="sm"
                        disabled={analyzing || loadingAnalysis}
                        className="h-8 gap-1.5 bg-violet-600 text-xs text-white hover:bg-violet-700"
                        onClick={() => void runAIAnalysis()}
                      >
                        {analyzing || loadingAnalysis ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        {analyzing ? '正在生成…' : loadingAnalysis ? '加载中…' : '生成最新分析'}
                      </Button>
                    </div>
                    {analysisProgress && analyzing ? (
                      <div className="mb-4 truncate rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-blue-700 dark:border-slate-800 dark:bg-slate-900 dark:text-cyan-300">
                        ▶ {analysisProgress}
                      </div>
                    ) : null}
                    {loadingAnalysis && !analysisHtml ? (
                      <div className="flex flex-col items-center gap-2 py-12 text-sm text-slate-500">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        正在加载分析报告…
                      </div>
                    ) : analysisHtml ? (
                      <div
                        className={ANALYSIS_REPORT_BODY_CLASSNAME}
                        dangerouslySetInnerHTML={{ __html: analysisHtml }}
                      />
                    ) : (
                      <div className="py-12 text-center text-sm text-slate-500">
                        <Sparkles className="mx-auto mb-2 h-10 w-10 opacity-40" />
                        暂无详细分析内容
                        {selectedStock?.ai_analysis ? (
                          <p className="mx-auto mt-4 max-w-lg rounded-lg border border-slate-200 bg-slate-50 p-4 text-left text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                            摘要：{selectedStock.ai_analysis.replace(/<[^>]+>/g, '').slice(0, 500)}
                          </p>
                        ) : null}
                      </div>
                    )}
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
        leftPanelId="daily-selection-left"
        mainPanelId="daily-selection-main"
        leftMinPx={248}
        leftMaxPx={360}
        leftSidebarVisible={!leftCollapsed}
        rightSidebarVisible={false}
        left={leftPanel}
        main={mainPanel}
        right={null}
      />

      {/* Alert Dialog */}
      <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{alertTitle}</AlertDialogTitle>
            <AlertDialogDescription>{alertDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>确定</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
