import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowRight, BookmarkCheck, ChevronRight, History, Loader2, MessageSquare } from 'lucide-react'
import { WorkbenchLayout } from '@/components/layout/WorkbenchLayout'
import { useWorkbenchChrome } from '@/components/layout/WorkbenchChromeContext'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  getTradingReport,
  getTradingReports,
  type TradingApiReportDetail,
  type TradingApiReportSummary,
} from '@/lib/tradingApi'
import { extractCnSymbol, normalizeCnSymbol } from '@/lib/symbols'
import {
  listFollowedStocks,
  migrateLocalPickerWatchlistOnce,
} from '@/lib/watchlistApi'
import { useAnalysisStore } from '@/features/analysis/tradingAgents/analysisStore'
import type { AnalysisReport, KeyMetric, RiskItem } from '@/features/analysis/tradingAgents/types'
import type { ChatCopilotPanelHandle } from '@/features/analysis/tradingAgents/components/ChatCopilotPanel'
import { TradingAgentsAnalysisCenter } from '@/features/analysis/tradingAgents/TradingAgentsAnalysisCenter'
import { TradingAgentsChatSidebar } from '@/features/analysis/tradingAgents/TradingAgentsChatSidebar'
import { AnalysisToolbar, type AnalysisViewMode } from '@/features/analysis/components/AnalysisToolbar'

function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '--'
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

/** 与 ReportViewer / AgentCollaboration 使用的章节键一致；合并详情时避免顶层 null/"" 盖掉 result_data 里的正文 */
const REPORT_SECTION_KEYS = [
  'market_report',
  'sentiment_report',
  'news_report',
  'fundamentals_report',
  'macro_report',
  'smart_money_report',
  'game_theory_report',
  'investment_plan',
  'trader_investment_plan',
  'final_trade_decision',
] as const

function isEmptyReportField(value: unknown): boolean {
  if (value == null) return true
  if (typeof value === 'string') return value.trim().length === 0
  return false
}

function mergeTradingReportDetailToResult(detail: TradingApiReportDetail): Record<string, unknown> {
  const rawNested =
    detail.result_data && typeof detail.result_data === 'object' && !Array.isArray(detail.result_data)
      ? ({ ...detail.result_data } as Record<string, unknown>)
      : {}
  /** 少数存储形态里 section 嵌在 result_data.result_data */
  const innerBlob = rawNested.result_data
  const innerExtra =
    innerBlob && typeof innerBlob === 'object' && !Array.isArray(innerBlob)
      ? (innerBlob as Record<string, unknown>)
      : {}
  const nested = { ...innerExtra, ...rawNested }
  const detailRecord = { ...(detail as unknown as Record<string, unknown>) }
  const merged: Record<string, unknown> = { ...nested, ...detailRecord }
  for (const key of REPORT_SECTION_KEYS) {
    if (!isEmptyReportField(merged[key])) continue
    const fromNested = nested[key]
    if (typeof fromNested === 'string' && fromNested.trim()) merged[key] = fromNested
  }
  return merged
}

function reportHistoryStatusTone(status?: string | null) {
  const s = (status || '').toLowerCase()
  if (s === 'completed' || s === 'success') {
    return 'border-emerald-200 text-emerald-700 bg-emerald-50 dark:border-emerald-500/20 dark:text-emerald-300 dark:bg-emerald-500/10'
  }
  if (s === 'failed' || s === 'error') {
    return 'border-rose-200 text-rose-700 bg-rose-50 dark:border-rose-500/20 dark:text-rose-300 dark:bg-rose-500/10'
  }
  if (s === 'running' || s === 'pending') {
    return 'border-amber-200 text-amber-700 bg-amber-50 dark:border-amber-500/20 dark:text-amber-300 dark:bg-amber-500/10'
  }
  return 'border-slate-200 text-slate-600 bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:bg-slate-800/60'
}

function mapRiskItems(raw: Array<Record<string, unknown>> | null | undefined): RiskItem[] {
  if (!raw?.length) return []
  return raw
    .map((r) => {
      const level = String(r.level ?? 'medium')
      const lv = level === 'high' || level === 'low' ? level : 'medium'
      return {
        name: String(r.name ?? '').trim(),
        level: lv as RiskItem['level'],
        description: r.description != null ? String(r.description) : undefined,
      }
    })
    .filter((x) => x.name)
}

function mapKeyMetrics(raw: Array<Record<string, unknown>> | null | undefined): KeyMetric[] {
  if (!raw?.length) return []
  return raw
    .map((r) => {
      const st = String(r.status ?? 'neutral')
      const status = st === 'good' || st === 'bad' ? st : 'neutral'
      return {
        name: String(r.name ?? '').trim(),
        value: String(r.value ?? ''),
        status: status as KeyMetric['status'],
      }
    })
    .filter((x) => x.name)
}

function hydrateTradingAnalysisFromHistory(detail: TradingApiReportDetail, merged: Record<string, unknown>) {
  const sym = normalizeCnSymbol(detail.symbol)
  const { result_data: _ignoredBlob, ...reportForUi } = merged
  /** 单次合并写入，避免 prepareForNewJob 先清空 report 再写入时中间栏误判为「无任务」 */
  useAnalysisStore.setState({
    currentJobId: null,
    isAnalyzing: false,
    isConnected: false,
    jobStatus: null,
    currentHorizon: null,
    streamingSections: {},
    milestones: [],
    currentSymbol: sym,
    report: reportForUi as unknown as AnalysisReport,
    riskItems: mapRiskItems(detail.risk_items ?? (merged.risk_items as Array<Record<string, unknown>> | undefined)),
    keyMetrics: mapKeyMetrics(detail.key_metrics ?? (merged.key_metrics as Array<Record<string, unknown>> | undefined)),
    jobConfidence: detail.confidence ?? (typeof merged.confidence === 'number' ? merged.confidence : null),
    jobTargetPrice: detail.target_price ?? (typeof merged.target_price === 'number' ? merged.target_price : null),
    jobStopLoss: detail.stop_loss_price ?? (typeof merged.stop_loss_price === 'number' ? merged.stop_loss_price : null),
  })
  useAnalysisStore.getState().addChatMessage({
    id: `history-opened-${detail.id}-${Date.now()}`,
    role: 'assistant',
    content: `已打开历史分析（只读）${detail.symbol} · ${detail.trade_date}\n\n方向：${detail.direction || '未知'}\n决策：${detail.decision || '未知'}\n置信度：${detail.confidence ?? '--'}%`,
    timestamp: new Date().toISOString(),
  })
}

export function AnalysisRouteLayout() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { rightCollapsed } = useWorkbenchChrome()
  const querySymbol = normalizeCnSymbol(searchParams.get('symbol') || '')
  const [selectedSymbol, setSelectedSymbol] = useState(querySymbol || '600519.SH')
  const [stockName, setStockName] = useState<string | undefined>()
  const [viewMode, setViewMode] = useState<AnalysisViewMode>('basic')
  const [rightSidebarTab, setRightSidebarTab] = useState<'chat' | 'watchlist' | 'history'>('chat')
  const [activeSection, setActiveSectionState] = useState<string | undefined>()
  const copilotRef = useRef<ChatCopilotPanelHandle>(null)
  /** 自选股/历史 tab 下聊天面板未挂载，ref 为空；切到「聊天」后再提交。 */
  const pendingShellPromptRef = useRef<string | null>(null)

  const [historyReports, setHistoryReports] = useState<TradingApiReportSummary[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyLoadedRemote, setHistoryLoadedRemote] = useState(false)
  const [openingHistoryReportId, setOpeningHistoryReportId] = useState<string | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const isAnalyzing = useAnalysisStore((s) => s.isAnalyzing)
  const wasAnalyzingRef = useRef(false)

  useEffect(() => {
    if (isAnalyzing && !wasAnalyzingRef.current) {
      setViewMode('ai')
    }
    wasAnalyzingRef.current = isAnalyzing
  }, [isAnalyzing])

  const setActiveSection = useCallback((section?: string) => {
    setActiveSectionState(section)
  }, [])

  useEffect(() => {
    if (querySymbol) {
      setSelectedSymbol(querySymbol)
    }
  }, [querySymbol])

  useEffect(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('symbol', selectedSymbol)
        return next
      },
      { replace: true },
    )
  }, [selectedSymbol, setSearchParams])

  useEffect(() => {
    if (rightSidebarTab !== 'history') return
    if (historyLoadedRemote) return
    let cancelled = false
    const loadHistory = async () => {
      setHistoryLoading(true)
      setHistoryError(null)
      try {
        const response = await getTradingReports(undefined, 0, 20)
        if (cancelled) return
        setHistoryReports(response.reports)
        setHistoryLoadedRemote(true)
      } catch (error) {
        if (cancelled) return
        setHistoryError(error instanceof Error ? error.message : '加载分析历史失败')
      } finally {
        setHistoryLoading(false)
      }
    }
    void loadHistory()
    return () => {
      cancelled = true
    }
  }, [historyLoadedRemote, rightSidebarTab])

  const refreshReportHistory = useCallback(async () => {
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      const response = await getTradingReports(undefined, 0, 20)
      setHistoryReports(response.reports)
      setHistoryLoadedRemote(true)
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : '加载分析历史失败')
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  const runAnalysisFromShell = useCallback(
    (prompt: string) => {
      const trimmed = prompt.trim()
      if (!trimmed) return
      const sym = extractCnSymbol(trimmed) || normalizeCnSymbol(selectedSymbol)
      setSelectedSymbol(sym)
      setViewMode('ai')
      useAnalysisStore.getState().setCurrentSymbol(sym)
      if (rightSidebarTab === 'chat') {
        if (copilotRef.current) {
          copilotRef.current.submitPrompt(trimmed)
        } else {
          pendingShellPromptRef.current = trimmed
          queueMicrotask(() => {
            const p = pendingShellPromptRef.current
            if (!p) return
            pendingShellPromptRef.current = null
            copilotRef.current?.submitPrompt(p)
          })
        }
        return
      }
      pendingShellPromptRef.current = trimmed
      setRightSidebarTab('chat')
    },
    [selectedSymbol, rightSidebarTab],
  )

  useLayoutEffect(() => {
    if (rightSidebarTab !== 'chat') return
    const pending = pendingShellPromptRef.current
    if (!pending) return
    pendingShellPromptRef.current = null
    copilotRef.current?.submitPrompt(pending)
  }, [rightSidebarTab])

  const openHistoryReport = async (reportId: string) => {
    setOpeningHistoryReportId(reportId)
    setHistoryError(null)
    try {
      const detail = await getTradingReport(reportId)
      const merged = mergeTradingReportDetailToResult(detail)
      setSelectedSymbol(normalizeCnSymbol(detail.symbol))
      setViewMode('ai')
      hydrateTradingAnalysisFromHistory(detail, merged)
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : '打开历史报告失败')
    } finally {
      setOpeningHistoryReportId(null)
    }
  }

  return (
    <WorkbenchLayout
      className="bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.08),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.08),_transparent_24%),linear-gradient(180deg,_#f8fafc_0%,_#f8fafc_32%,_#eef2ff_100%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.10),_transparent_24%),linear-gradient(180deg,_#020617_0%,_#020617_32%,_#0f172a_100%)]"
      mainPanelId="analysis-main"
      rightPanelId="analysis-right"
      leftSidebarVisible={false}
      rightMinPx={360}
      rightMaxPx={580}
      rightSidebarVisible={!rightCollapsed}
      main={
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <div className="relative z-40 shrink-0 overflow-visible border-b border-slate-200/80 bg-white/70 px-4 py-3 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/70">
            <AnalysisToolbar
              symbol={selectedSymbol}
              stockName={stockName}
              viewMode={viewMode}
              onSymbolChange={(sym, name) => {
                setSelectedSymbol(sym)
                if (name) setStockName(name)
              }}
              onViewModeChange={setViewMode}
              onAiAnalyze={() => runAnalysisFromShell(`分析 ${selectedSymbol} 今日走势`)}
              analysisRunning={isAnalyzing}
            />
          </div>
          <div className="relative z-0 min-h-0 flex-1 overflow-y-auto p-4">
            <TradingAgentsAnalysisCenter
              selectedSymbol={selectedSymbol}
              stockName={stockName}
              viewMode={viewMode}
              activeSection={activeSection}
              onSelectSection={setActiveSection}
              onWorkbenchSymbolChange={(sym) => setSelectedSymbol(sym)}
            />
          </div>
        </div>
      }
      right={
        <AnalysisRightDock
          tab={rightSidebarTab}
          onTabChange={setRightSidebarTab}
          copilotRef={copilotRef}
          onSymbolDetected={(symbol) => setSelectedSymbol(normalizeCnSymbol(symbol))}
          onShowReport={(section) => setActiveSection(section)}
          selectedSymbol={selectedSymbol}
          onAnalyze={runAnalysisFromShell}
          onSelectSymbol={(symbol) => setSelectedSymbol(symbol)}
          analysisRunning={isAnalyzing}
          reportHistory={historyReports}
          reportHistoryLoading={historyLoading}
          reportHistoryError={historyError}
          onRefreshHistory={refreshReportHistory}
          openingHistoryReportId={openingHistoryReportId}
          onOpenHistoryReport={openHistoryReport}
        />
      }
    />
  )
}

type AnalysisRightDockProps = {
  tab: 'chat' | 'watchlist' | 'history'
  onTabChange: (tab: 'chat' | 'watchlist' | 'history') => void
  copilotRef: RefObject<ChatCopilotPanelHandle | null>
  onSymbolDetected: (symbol: string) => void
  onShowReport?: (section?: string) => void
  selectedSymbol: string
  onAnalyze: (prompt: string) => void
  onSelectSymbol: (symbol: string) => void
  analysisRunning: boolean
  reportHistory: TradingApiReportSummary[]
  reportHistoryLoading: boolean
  reportHistoryError: string | null
  onRefreshHistory: () => void | Promise<void>
  openingHistoryReportId: string | null
  onOpenHistoryReport: (id: string) => void | Promise<void>
}

function AnalysisRightDock({
  tab,
  onTabChange,
  copilotRef,
  onSymbolDetected,
  onShowReport,
  selectedSymbol,
  onAnalyze,
  onSelectSymbol,
  analysisRunning,
  reportHistory,
  reportHistoryLoading,
  reportHistoryError,
  onRefreshHistory,
  openingHistoryReportId,
  onOpenHistoryReport,
}: AnalysisRightDockProps) {
  const tabs = [
    { id: 'chat' as const, label: '聊天', Icon: MessageSquare },
    { id: 'watchlist' as const, label: '自选股', Icon: BookmarkCheck },
    { id: 'history' as const, label: '历史', Icon: History },
  ]

  return (
    <aside className="flex h-full min-h-0 flex-col bg-[#fbfcfd] dark:bg-slate-950">
      <div className="shrink-0 border-b border-slate-200 px-2 pb-2 pt-3 dark:border-slate-800">
        <div className="flex gap-0.5 rounded-xl bg-slate-200/50 p-1 dark:bg-slate-800/60">
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-all sm:text-[13px]',
                tab === id
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-100'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={2} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {tab === 'chat' ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col px-2 pb-2 pt-1">
            <TradingAgentsChatSidebar
              ref={copilotRef}
              onSymbolDetected={onSymbolDetected}
              onShowReport={onShowReport}
            />
          </div>
        ) : null}

        {tab === 'watchlist' ? (
          <AnalysisWatchlistPanel
            selectedSymbol={selectedSymbol}
            onAnalyze={onAnalyze}
            onSelectSymbol={onSelectSymbol}
          />
        ) : null}

        {tab === 'history' ? (
          <AnalysisHistoryPanel
            reportHistory={reportHistory}
            reportHistoryLoading={reportHistoryLoading}
            reportHistoryError={reportHistoryError}
            onRefreshHistory={onRefreshHistory}
            openingHistoryReportId={openingHistoryReportId}
            onOpenHistoryReport={onOpenHistoryReport}
          />
        ) : null}
      </div>
    </aside>
  )
}

function AnalysisWatchlistPanel({
  selectedSymbol,
  onAnalyze,
  onSelectSymbol,
}: {
  selectedSymbol: string
  onAnalyze: (prompt: string) => void
  onSelectSymbol: (symbol: string) => void
}) {
  const [watchlistItems, setWatchlistItems] = useState<{ symbol: string; name: string; note: string }[]>([])

  const refreshWatchlist = useCallback(() => {
    void listFollowedStocks()
      .then((rows) => {
        setWatchlistItems(
          rows.map((r) => ({
            symbol: normalizeCnSymbol(r.stockCode) || r.stockCode.trim().toUpperCase(),
            name: r.stockName || r.stockCode,
            note: (r.note && r.note.trim()) || '',
          })),
        )
      })
      .catch(() => setWatchlistItems([]))
  }, [])

  useEffect(() => {
    void migrateLocalPickerWatchlistOnce()
    refreshWatchlist()
  }, [refreshWatchlist])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') refreshWatchlist()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [refreshWatchlist])

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="space-y-4 p-4">
            <div>
              <div className="mb-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  自选列表
                </div>
                <div className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">点击切换标的并发起 AI 分析</div>
              </div>
              <div className="space-y-3">
                {watchlistItems.length === 0 ? (
                  <div className="rounded-[20px] border border-dashed border-slate-200 px-4 py-8 text-center text-[12px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    暂无自选。可在鲲鹏战法或专家分析中添加；数据在 AI_DATA_DIR/stock.db（与后端 .env 一致）。
                  </div>
                ) : (
                  watchlistItems.map((item) => {
                    const active = item.symbol === selectedSymbol
                    const showCodeSub = item.name.trim() !== item.symbol.trim()
                    return (
                      <button
                        key={item.symbol}
                        type="button"
                        onClick={() => {
                          onSelectSymbol(item.symbol)
                          onAnalyze(`分析 ${item.symbol} 今日走势`)
                        }}
                        className={cn(
                          'w-full rounded-[20px] border px-4 py-3.5 text-left transition-all',
                          active
                            ? 'border-blue-400 bg-blue-50/75 shadow-[0_4px_12px_rgba(59,130,246,0.10)] dark:bg-blue-500/10'
                            : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40',
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">{item.name}</div>
                            {showCodeSub ? (
                              <div className="mt-1 font-mono text-[12px] text-slate-500 dark:text-slate-400">{item.symbol}</div>
                            ) : null}
                            {item.note ? (
                              <div className="mt-1 text-[11.5px] text-slate-400 dark:text-slate-500">{item.note}</div>
                            ) : null}
                          </div>
                          <span className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-blue-600 dark:text-blue-300">
                            分析 <ArrowRight className="h-3.5 w-3.5" />
                          </span>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </div>
    </ScrollArea>
  )
}

function AnalysisHistoryPanel({
  reportHistory,
  reportHistoryLoading,
  reportHistoryError,
  onRefreshHistory,
  openingHistoryReportId,
  onOpenHistoryReport,
}: {
  reportHistory: TradingApiReportSummary[]
  reportHistoryLoading: boolean
  reportHistoryError: string | null
  onRefreshHistory: () => void | Promise<void>
  openingHistoryReportId: string | null
  onOpenHistoryReport: (id: string) => void | Promise<void>
}) {
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            历史记录
          </div>
          <button
            type="button"
            onClick={() => void onRefreshHistory()}
            disabled={openingHistoryReportId != null}
            className="text-[11px] text-slate-500 hover:text-slate-700 disabled:opacity-40 dark:text-slate-400 dark:hover:text-slate-200"
          >
            刷新
          </button>
        </div>

        {reportHistoryError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
            {reportHistoryError}
          </div>
        ) : null}

        {reportHistoryLoading ? (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 py-10 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            正在加载历史...
          </div>
        ) : null}

        {!reportHistoryLoading && reportHistory.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
            暂无分析历史。完成一次分析后，将显示服务端保存的报告。
          </div>
        ) : null}

        <div className="space-y-2">
          {reportHistory.map((report) => {
            const rowOpening = openingHistoryReportId === report.id
            return (
              <button
                key={report.id}
                type="button"
                disabled={openingHistoryReportId != null}
                onClick={() => void onOpenHistoryReport(report.id)}
                className={cn(
                  'w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700',
                  openingHistoryReportId != null && !rowOpening && 'opacity-50',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{report.symbol}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {(report.trade_date || '').slice(0, 10)} · {report.decision || '未知决策'} · {report.direction || '未知方向'}
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                      {report.target_price != null ? `目标价 ${formatNumber(report.target_price)} · ` : ''}
                      {report.stop_loss_price != null ? `止损 ${formatNumber(report.stop_loss_price)} · ` : ''}
                      {report.confidence != null ? `置信度 ${formatNumber(report.confidence, 0)}%` : '暂无置信度'}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]',
                        reportHistoryStatusTone(report.status),
                      )}
                    >
                      {report.status || '完成'}
                    </span>
                    {rowOpening ? (
                      <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </ScrollArea>
  )
}
