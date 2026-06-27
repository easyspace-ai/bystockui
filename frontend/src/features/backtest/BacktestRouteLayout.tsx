import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Activity,
  BarChart3,
  ChevronDown,
  LineChart as LineChartIcon,
  Loader2,
  Play,
  SquareStack,
  Target,
  Workflow,
} from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { WorkbenchLayout } from '@/components/layout/WorkbenchLayout'
import { useWorkbenchChrome } from '@/components/layout/WorkbenchChromeContext'
import { cn } from '@/lib/utils'
import { normalizeCnSymbol } from '@/lib/symbols'
import { searchTradingStocks } from '@/lib/tradingApi'
import {
  getBacktestDetail,
  listBacktestJobs,
  listBacktestStrategies,
  runBacktest,
  type BacktestJsonObject,
  type BacktestJsonValue,
  type BacktestDetailResponse,
  type BacktestJob,
  type BacktestStrategySummary,
} from '@/lib/backtestApi'

type StrategySchemaField = {
  title?: string
  description?: string
  type?: string
  default?: BacktestJsonValue
  enum?: BacktestJsonValue[]
}

type StrategySchema = BacktestJsonObject & {
  properties?: Record<string, StrategySchemaField>
}

type ParameterField = {
  key: string
  label: string
  description?: string
  type: string
  defaultValue?: BacktestJsonValue
  enum?: BacktestJsonValue[]
}

const DEFAULT_SYMBOL = '600519.SH'
const FALLBACK_SYMBOLS = [
  { symbol: '600519.SH', name: '贵州茅台' },
  { symbol: '000001.SZ', name: '平安银行' },
  { symbol: '000300.SH', name: '沪深300' },
  { symbol: '300750.SZ', name: '宁德时代' },
  { symbol: '601318.SH', name: '中国平安' },
]

type SymbolSuggestion = { symbol: string; name: string }

function marketTagForSymbol(symbol: string): string {
  const s = symbol.toUpperCase()
  if (s.endsWith('.HK')) return '港股'
  if (s.endsWith('.SH') || s.endsWith('.SZ') || s.endsWith('.BJ')) return 'A股'
  if (/\.(US|O|N)$/i.test(s) || /^[A-Z]{1,5}$/.test(s)) return '美股'
  return '标的'
}

function matchHint(query: string, item: SymbolSuggestion): string {
  const q = query.trim().toUpperCase()
  if (!q) return ''
  const code = item.symbol.split('.')[0]?.toUpperCase() ?? ''
  if (code.startsWith(q) || item.symbol.toUpperCase().startsWith(q)) return '前缀'
  if (item.name.includes(query.trim())) return '名称'
  return ''
}

function normalizeSymbol(raw: string): string {
  const value = raw.trim().toUpperCase()
  if (!value) return ''
  if (value.includes('.')) return value
  if (/^(6|5|9)/.test(value)) return `${value}.SH`
  if (/^(0|3)/.test(value)) return `${value}.SZ`
  if (/^8/.test(value)) return `${value}.BJ`
  return value
}

function formatPercent(value?: number | null, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--'
  return `${Number(value).toFixed(digits)}%`
}

function formatNumber(value?: number | null, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--'
  return Number(value).toLocaleString('zh-CN', { maximumFractionDigits: digits, minimumFractionDigits: digits })
}

function formatDate(value?: string | null): string {
  if (!value) return '--'
  return value.slice(0, 10)
}

function getStrategyFields(schema?: StrategySchema | null): ParameterField[] {
  if (!schema || typeof schema !== 'object') return []
  const properties = (schema.properties && typeof schema.properties === 'object' ? schema.properties : schema) as Record<
    string,
    StrategySchemaField
  >
  return Object.entries(properties)
    .map(([key, value]) => {
      if (!value || typeof value !== 'object') return null
      return {
        key,
        label: String(value.title || key),
        description: typeof value.description === 'string' ? value.description : undefined,
        type: String(value.type || (typeof value.default === 'number' ? 'number' : 'string')),
        defaultValue: value.default,
        enum: Array.isArray(value.enum) ? value.enum : undefined,
      } satisfies ParameterField
    })
    .filter(Boolean) as ParameterField[]
}

function buildDefaultParameters(
  schema?: StrategySchema | null,
  existing?: Record<string, BacktestJsonValue>,
): Record<string, BacktestJsonValue> {
  const fields = getStrategyFields(schema)
  if (!fields.length) return existing ? { ...existing } : {}

  const next: Record<string, BacktestJsonValue> = {}
  fields.forEach((field) => {
    if (existing && Object.prototype.hasOwnProperty.call(existing, field.key)) {
      next[field.key] = existing[field.key]
      return
    }
    next[field.key] = field.defaultValue ?? (field.type === 'boolean' ? false : field.type === 'number' ? 0 : '')
  })
  return next
}

function metricNumber(metrics: BacktestJsonObject | null | undefined, key: string): number {
  const value = metrics?.[key]
  return typeof value === 'number' ? value : 0
}

function statusTone(status?: string) {
  switch ((status || '').toLowerCase()) {
    case 'completed':
      return 'bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/20'
    case 'running':
    case 'pending':
      return 'bg-amber-500/10 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/20'
    case 'failed':
      return 'bg-rose-500/10 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/20'
    default:
      return 'bg-gray-500/10 text-gray-700 border-gray-200 dark:bg-gray-500/15 dark:text-gray-300 dark:border-gray-500/20'
  }
}

function sideTone(side: string) {
  const value = side.toLowerCase()
  if (value.includes('buy') || value.includes('多')) {
    return 'bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/20'
  }
  return 'bg-rose-500/10 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/20'
}

function selectStrategyLabel(strategy?: BacktestStrategySummary | null): string {
  if (!strategy) return '--'
  return `${strategy.name}${strategy.version ? ` · ${strategy.version}` : ''}`
}

function parseDateInputFromOffset(daysAgo: number): string {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return date.toISOString().slice(0, 10)
}

function EquityChart({
  data,
}: {
  data: Array<{ trade_date: string; equity: number }>
}) {
  if (!data.length) {
    return (
      <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white/70 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-950/40 dark:text-gray-400">
        暂无权益曲线数据
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={288}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.28} />
            <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
        <XAxis dataKey="trade_date" tickLine={false} axisLine={false} minTickGap={24} tick={{ fill: 'currentColor', fontSize: 12 }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fill: 'currentColor', fontSize: 12 }} width={68} />
        <Tooltip
          contentStyle={{
            borderRadius: 16,
            border: '1px solid rgba(148,163,184,0.18)',
            background: 'rgba(255,255,255,0.95)',
            boxShadow: '0 18px 48px rgba(15,23,42,0.08)',
          }}
          formatter={(value: number | string) => [formatNumber(Number(value), 2), '权益']}
        />
        <Area
          type="monotone"
          dataKey="equity"
          stroke="#2563eb"
          strokeWidth={2.4}
          fill="url(#equityGradient)"
          dot={false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function BacktestRouteLayout() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { leftCollapsed, rightCollapsed } = useWorkbenchChrome()
  const querySymbol = normalizeSymbol(searchParams.get('symbol') || DEFAULT_SYMBOL)
  const queryStrategyId = Number.parseInt(searchParams.get('strategy_id') || '', 10)
  const queryStrategyIdValue = Number.isFinite(queryStrategyId) ? queryStrategyId : null
  const [sidebarTab, setSidebarTab] = useState<'params' | 'history'>('params')
  const [strategies, setStrategies] = useState<BacktestStrategySummary[]>([])
  const [strategiesLoading, setStrategiesLoading] = useState(false)
  const [strategiesError, setStrategiesError] = useState<string | null>(null)
  const [selectedStrategyId, setSelectedStrategyId] = useState<number | null>(null)
  const [strategyParameters, setStrategyParameters] = useState<Record<string, BacktestJsonValue>>({})
  const [symbolInput, setSymbolInput] = useState(querySymbol)
  const [selectedSymbol, setSelectedSymbol] = useState(querySymbol)
  const [selectedSymbolName, setSelectedSymbolName] = useState('')
  const [symbolSearchResults, setSymbolSearchResults] = useState<Array<{ symbol: string; name: string }>>(
    FALLBACK_SYMBOLS,
  )
  const [runStartDate, setRunStartDate] = useState(parseDateInputFromOffset(180))
  const [runEndDate, setRunEndDate] = useState(parseDateInputFromOffset(1))
  const [initialCapital, setInitialCapital] = useState('1000000')
  const [commissionRate, setCommissionRate] = useState('0.0003')
  const [slippage, setSlippage] = useState('0.001')
  const [dataSource, setDataSource] = useState('auto')
  const [strategyHistory, setStrategyHistory] = useState<BacktestJob[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [activeDetail, setActiveDetail] = useState<BacktestDetailResponse | null>(null)
  const [runStatus, setRunStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle')
  const [runMessage, setRunMessage] = useState('等待选择标的和策略')
  const pollTimerRef = useRef<number | null>(null)
  const resultSyncTimerRef = useRef<number | null>(null)
  const resultSyncAttemptsRef = useRef(0)
  const debounceRef = useRef<number | null>(null)
  const symbolBlurCloseRef = useRef<number | null>(null)
  const [symbolPickerOpen, setSymbolPickerOpen] = useState(false)
  const [symbolSuggestLoading, setSymbolSuggestLoading] = useState(false)
  const [symbolHighlight, setSymbolHighlight] = useState(0)
  const selectedStrategy = useMemo(
    () => strategies.find((item) => item.id === selectedStrategyId) || strategies[0] || null,
    [strategies, selectedStrategyId],
  )
  const parameterFields = useMemo(() => getStrategyFields(selectedStrategy?.parameters_schema), [selectedStrategy])
  const equityCurveData = useMemo(
    () =>
      activeDetail?.equity_points?.map((point) => ({
        trade_date: point.trade_date,
        equity: point.equity,
      })) || activeDetail?.result?.equity_curve?.map((equity, index) => ({
        trade_date: String(index + 1),
        equity,
      })) || [],
    [activeDetail],
  )
  const trades = activeDetail?.trades || []
  const result = activeDetail?.result || null

  const clearResultSyncTimer = useCallback(() => {
    if (resultSyncTimerRef.current) {
      window.clearTimeout(resultSyncTimerRef.current)
      resultSyncTimerRef.current = null
    }
  }, [])

  const resetResultSyncState = useCallback(() => {
    clearResultSyncTimer()
    resultSyncAttemptsRef.current = 0
  }, [clearResultSyncTimer])

  const scheduleResultSyncRetry = useCallback((jobId: string) => {
    clearResultSyncTimer()
    if (!jobId) return
    if (resultSyncAttemptsRef.current >= 5) return

    resultSyncAttemptsRef.current += 1
    resultSyncTimerRef.current = window.setTimeout(async () => {
      try {
        const detail = await getBacktestDetail(jobId)
        setActiveDetail(detail)
        if (detail.result) {
          setRunMessage('回测完成，结果已同步到页面。')
          resetResultSyncState()
          return
        }
        setRunMessage('回测已完成，结果明细同步中...')
        scheduleResultSyncRetry(jobId)
      } catch {
        setRunMessage('回测已完成，但结果详情暂时同步失败，正在重试...')
        scheduleResultSyncRetry(jobId)
      }
    }, 1200)
  }, [clearResultSyncTimer, resetResultSyncState])

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const jobs = await listBacktestJobs({ limit: 8 })
      setStrategyHistory(jobs)
    } catch {
      // keep existing list
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    if (querySymbol) {
      setSelectedSymbol(querySymbol)
      setSymbolInput(querySymbol)
    }
  }, [querySymbol])

  useEffect(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('symbol', selectedSymbol)
      return next
    }, { replace: true })
  }, [selectedSymbol, setSearchParams])

  useEffect(() => {
    if (selectedStrategyId == null) return
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('strategy_id', String(selectedStrategyId))
      return next
    }, { replace: true })
  }, [selectedStrategyId, setSearchParams])

  useEffect(() => {
    let cancelled = false
    const loadStrategies = async () => {
      setStrategiesLoading(true)
      setStrategiesError(null)
      try {
        const list = await listBacktestStrategies()
        if (cancelled) return
        setStrategies(list)
        const nextSelected =
          (queryStrategyIdValue ? list.find((item) => item.id === queryStrategyIdValue) : null) ||
          list.find((item) => item.status !== 'disabled') ||
          list[0] ||
          null
        if (nextSelected) {
          setSelectedStrategyId((current) => current || nextSelected.id)
        } else if (queryStrategyIdValue) {
          setSelectedStrategyId(queryStrategyIdValue)
        }
      } catch (error) {
        if (cancelled) return
        setStrategiesError(error instanceof Error ? error.message : '加载策略失败')
        setStrategies([])
      } finally {
        if (!cancelled) setStrategiesLoading(false)
      }
    }
    loadStrategies()
    return () => {
      cancelled = true
    }
  }, [queryStrategyIdValue])

  useEffect(() => {
    let cancelled = false
    const loadHistory = async () => {
      setHistoryLoading(true)
      setHistoryError(null)
      try {
        const jobs = await listBacktestJobs({ limit: 8 })
        if (cancelled) return
        setStrategyHistory(jobs)
        setSelectedJobId((current) => current ?? jobs[0]?.job_id ?? null)
      } catch (error) {
        if (cancelled) return
        setHistoryError(error instanceof Error ? error.message : '加载历史失败')
      } finally {
        if (!cancelled) setHistoryLoading(false)
      }
    }
    loadHistory()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedStrategy) return
    setStrategyParameters((prev) => buildDefaultParameters(selectedStrategy.parameters_schema, prev))
  }, [selectedStrategy, setStrategyParameters])

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    const keyword = symbolInput.trim()
    if (!keyword) {
      setSymbolSuggestLoading(false)
      setSymbolSearchResults(FALLBACK_SYMBOLS)
      return undefined
    }

    setSymbolSuggestLoading(true)

    debounceRef.current = window.setTimeout(async () => {
      try {
        const response = await searchTradingStocks(keyword.replace(/\.[A-Z]+$/, ''))
        setSymbolSearchResults(response.results.slice(0, 12))
      } catch {
        setSymbolSearchResults(
          FALLBACK_SYMBOLS.filter((item) => item.symbol.includes(keyword.toUpperCase()) || item.name.includes(keyword)),
        )
      } finally {
        setSymbolSuggestLoading(false)
      }
    }, 280)

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [symbolInput])

  useEffect(() => {
    setSymbolHighlight((h) => {
      const max = Math.max(0, symbolSearchResults.length - 1)
      return Math.min(h, max)
    })
  }, [symbolSearchResults])

  useEffect(() => {
    if (pollTimerRef.current) {
      window.clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }

    if (runStatus !== 'running' || !selectedJobId) return undefined

    const poll = async () => {
      try {
        const detail = await getBacktestDetail(selectedJobId)
        setActiveDetail(detail)
        setRunMessage(
          detail.job.status === 'completed'
            ? detail.result
              ? '回测完成，结果已写入历史。'
              : '回测完成，结果正在同步中...'
            : detail.job.status === 'failed'
              ? detail.job.error_message || '回测失败'
              : `回测中 · ${detail.job.progress || 0}%`,
        )
        if (detail.job.status === 'completed') {
          setRunStatus('success')
          if (detail.result) {
            resetResultSyncState()
            await refreshHistory()
          } else {
            scheduleResultSyncRetry(selectedJobId)
          }
          return
        }
        if (detail.job.status === 'failed' || detail.job.status === 'cancelled') {
          resetResultSyncState()
          setRunStatus('failed')
          return
        }
      } catch (error) {
        setRunMessage(error instanceof Error ? error.message : '获取回测详情失败')
      }
      pollTimerRef.current = window.setTimeout(poll, 1800)
    }

    poll()
    return () => {
      if (pollTimerRef.current) {
        window.clearTimeout(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }
  }, [runStatus, selectedJobId, resetResultSyncState, scheduleResultSyncRetry, refreshHistory])

  useEffect(() => () => {
    if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current)
    if (resultSyncTimerRef.current) window.clearTimeout(resultSyncTimerRef.current)
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    if (symbolBlurCloseRef.current) window.clearTimeout(symbolBlurCloseRef.current)
  }, [])

  const loadDetail = async (jobId: string) => {
    setSelectedJobId(jobId)
    setDetailLoading(true)
    setDetailError(null)
    resetResultSyncState()
    try {
      const detail = await getBacktestDetail(jobId)
      setActiveDetail(detail)
      setRunStatus(detail.job.status === 'completed' ? 'success' : detail.job.status === 'failed' ? 'failed' : 'idle')
      setRunMessage(
        detail.job.status === 'completed'
          ? detail.result
            ? '已加载历史回测结果。'
            : '历史任务已完成，结果明细正在同步...'
          : detail.job.status === 'failed'
            ? detail.job.error_message || '回测失败'
            : `历史任务 · ${detail.job.status}`,
      )
      if (detail.job.status === 'completed' && !detail.result) {
        scheduleResultSyncRetry(jobId)
      }
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : '打开历史失败')
    } finally {
      setDetailLoading(false)
    }
  }

  const applySymbol = (symbol: string, name?: string) => {
    const nextSymbol = normalizeSymbol(symbol)
    if (!nextSymbol) return
    setSelectedSymbol(nextSymbol)
    setSymbolInput(nextSymbol)
    setSelectedSymbolName(name || '')
  }

  const applySymbolFromSuggestion = (item: SymbolSuggestion) => {
    const sym = normalizeCnSymbol(item.symbol) || item.symbol.trim().toUpperCase()
    applySymbol(sym, item.name)
    setSymbolPickerOpen(false)
  }

  useEffect(() => {
    let cancelled = false
    const loadSymbolMeta = async () => {
      try {
        const results = await searchTradingStocks(selectedSymbol.split('.')[0])
        if (cancelled) return
        const exact = results.results.find((item) => normalizeSymbol(item.symbol) === selectedSymbol) || results.results[0]
        setSelectedSymbolName(exact?.name || selectedSymbol)
      } catch {
        if (!cancelled) setSelectedSymbolName(selectedSymbol)
      }
    }
    loadSymbolMeta()
    return () => {
      cancelled = true
    }
  }, [selectedSymbol])

  const submitBacktest = async () => {
    if (!selectedStrategy) {
      setRunMessage('请先选择策略')
      return
    }
    if (!selectedSymbol) {
      setRunMessage('请先选择标的')
      return
    }

    setRunStatus('running')
    setRunMessage('已提交回测任务，等待引擎启动...')
    setActiveDetail(null)
    resetResultSyncState()
    try {
      const job = await runBacktest({
        strategy_id: selectedStrategy.id,
        symbol: selectedSymbol,
        start_date: runStartDate,
        end_date: runEndDate,
        initial_capital: Number(initialCapital) || 1000000,
        commission_rate: Number(commissionRate) || 0.0003,
        slippage: Number(slippage) || 0.001,
        parameters: strategyParameters,
        data_source: dataSource,
        benchmark_symbol: '000300.SH',
      })
      setSelectedJobId(job.job_id)
      await refreshHistory()
      setRunMessage('回测执行中...')
    } catch (error) {
      setRunStatus('failed')
      setRunMessage(error instanceof Error ? error.message : '发起回测失败')
    }
  }

  const summaryCards = useMemo(() => {
    const metrics = result?.metrics
    return [
      { label: '总收益', value: formatPercent(result?.total_return ?? metricNumber(metrics, 'total_return')), tone: 'text-emerald-600' },
      { label: '年化', value: formatPercent(result?.annual_return ?? metricNumber(metrics, 'annual_return')), tone: 'text-sky-600' },
      { label: '最大回撤', value: formatPercent(result?.max_drawdown ?? metricNumber(metrics, 'max_drawdown')), tone: 'text-rose-600' },
      { label: '夏普', value: formatNumber(result?.sharpe_ratio ?? metricNumber(metrics, 'sharpe_ratio'), 2), tone: 'text-amber-600' },
      { label: '交易数', value: String(result?.total_trades ?? metricNumber(metrics, 'total_trades') ?? trades.length ?? 0), tone: 'text-gray-700' },
      { label: '胜率', value: formatPercent(result?.win_rate ?? metricNumber(metrics, 'win_rate')), tone: 'text-violet-600' },
    ]
  }, [result, trades.length])

  const backtestChromeHeaderClass =
    'flex min-h-[52px] shrink-0 items-center border-b border-gray-200 px-4 py-2 dark:border-gray-800'

  const leftPanel = (
    <div className="flex h-full flex-col bg-white dark:bg-gray-950">
      <div className={backtestChromeHeaderClass}>
        <div className="flex w-full rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
          <button
            type="button"
            onClick={() => setSidebarTab('params')}
            className={cn(
              'flex-1 rounded-lg py-2 text-sm font-medium transition-all',
              sidebarTab === 'params'
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-950 dark:text-gray-100'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
            )}
          >
            回测
          </button>
          <button
            type="button"
            onClick={() => setSidebarTab('history')}
            className={cn(
              'flex-1 rounded-lg py-2 text-sm font-medium transition-all',
              sidebarTab === 'history'
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-950 dark:text-gray-100'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
            )}
          >
            历史列表
          </button>
        </div>
      </div>

      {sidebarTab === 'params' ? (
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-5 p-4">
            {/* <div className="flex items-center justify-end">
              <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
                <Activity size={12} />
                <span>{runStatus === 'running' ? '执行中' : '待回测'}</span>
              </div>
            </div> */}

            <section className="space-y-2">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">股票代码</label>
              <div className="relative">
                <Input
                  value={symbolInput}
                  autoComplete="off"
                  onChange={(event) => {
                    setSymbolInput(event.target.value.toUpperCase())
                    setSymbolPickerOpen(true)
                  }}
                  onFocus={() => {
                    if (symbolBlurCloseRef.current) window.clearTimeout(symbolBlurCloseRef.current)
                    setSymbolPickerOpen(true)
                  }}
                  onBlur={() => {
                    symbolBlurCloseRef.current = window.setTimeout(() => {
                      setSymbolPickerOpen(false)
                      applySymbol(symbolInput, symbolSearchResults[0]?.name)
                    }, 160)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      setSymbolPickerOpen(false)
                      return
                    }
                    if (event.key === 'ArrowDown') {
                      if (!symbolPickerOpen) setSymbolPickerOpen(true)
                      event.preventDefault()
                      setSymbolHighlight((i) => Math.min(i + 1, Math.max(0, symbolSearchResults.length - 1)))
                      return
                    }
                    if (event.key === 'ArrowUp') {
                      event.preventDefault()
                      setSymbolHighlight((i) => Math.max(i - 1, 0))
                      return
                    }
                    if (event.key === 'Enter') {
                      if (symbolPickerOpen && symbolSearchResults[symbolHighlight]) {
                        event.preventDefault()
                        applySymbolFromSuggestion(symbolSearchResults[symbolHighlight])
                        return
                      }
                      applySymbol(symbolInput, symbolSearchResults[0]?.name)
                    }
                  }}
                  className={cn(
                    'h-10 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100',
                    symbolPickerOpen && 'border-blue-500 ring-1 ring-blue-500 dark:border-blue-400 dark:ring-blue-400',
                  )}
                  placeholder="600519.SH"
                />
                {symbolPickerOpen &&
                (symbolSuggestLoading || symbolSearchResults.length > 0 || symbolInput.trim().length > 0) ? (
                  <div
                    className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-blue-200 bg-white shadow-lg dark:border-blue-800 dark:bg-gray-950"
                    role="listbox"
                  >
                    {symbolSuggestLoading ? (
                      <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2 text-[11px] text-gray-500 dark:border-gray-800 dark:text-gray-400">
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                        正在匹配标的…
                      </div>
                    ) : null}
                    {!symbolSuggestLoading && !symbolSearchResults.length && symbolInput.trim() ? (
                      <div className="px-3 py-3 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                        股票库中暂无匹配项。可换个关键词，或手动输入港股/美股代码。
                      </div>
                    ) : null}
                    {symbolSearchResults.map((item, idx) => {
                      const hint = matchHint(symbolInput, item)
                      return (
                        <button
                          key={`${item.symbol}-${idx}`}
                          type="button"
                          role="option"
                          aria-selected={idx === symbolHighlight}
                          onMouseDown={(ev) => ev.preventDefault()}
                          onMouseEnter={() => setSymbolHighlight(idx)}
                          onClick={() => applySymbolFromSuggestion(item)}
                          className={cn(
                            'flex w-full items-center gap-2 border-b border-gray-100 px-3 py-2.5 text-left transition-colors last:border-b-0 dark:border-gray-800/80',
                            idx === symbolHighlight
                              ? 'bg-gray-100 dark:bg-gray-800/90'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-900/80',
                          )}
                        >
                          <span className="shrink-0 rounded-md bg-rose-600 px-1.5 py-px text-[10px] font-medium text-white dark:bg-rose-500">
                            {marketTagForSymbol(item.symbol)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[13px] font-semibold text-gray-900 dark:text-gray-100">{item.name}</div>
                            <div className="mt-0.5 font-mono text-[11px] text-gray-500 dark:text-gray-400">{item.symbol}</div>
                          </div>
                          {hint ? (
                            <span className="shrink-0 text-[11px] font-medium text-violet-600 dark:text-violet-400">{hint}</span>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            </section>

            <section className="space-y-2">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">策略选择</label>
              <div className="relative">
                <select
                  value={selectedStrategyId ?? ''}
                  onChange={(event) => {
                    const id = Number(event.target.value)
                    if (!Number.isFinite(id)) return
                    setSelectedStrategyId(id)
                    const s = strategies.find((x) => x.id === id)
                    if (s) setStrategyParameters(buildDefaultParameters(s.parameters_schema))
                  }}
                  disabled={strategiesLoading || !strategies.length}
                  className="h-10 w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 pr-9 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100"
                >
                  {!strategies.length ? <option value="">暂无策略</option> : null}
                  {strategies.map((strategy) => (
                    <option key={strategy.id} value={strategy.id}>
                      {selectStrategyLabel(strategy)}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -trangray-y-1/2 text-gray-400"
                  aria-hidden
                />
              </div>
              {strategiesError ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
                  {strategiesError}
                </div>
              ) : null}
              {selectedStrategy ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 text-xs leading-5 text-gray-500 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400">
                  {selectedStrategy.description || '该策略支持参数面板配置，运行时参数会直接注入回测引擎。'}
                </div>
              ) : null}
            </section>

            <section className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5">
                <span className="text-xs text-gray-500 dark:text-gray-400">开始日期</span>
                <Input
                  type="date"
                  value={runStartDate}
                  onChange={(event) => setRunStartDate(event.target.value)}
                  className="h-10 rounded-lg border border-gray-200 bg-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs text-gray-500 dark:text-gray-400">结束日期</span>
                <Input
                  type="date"
                  value={runEndDate}
                  onChange={(event) => setRunEndDate(event.target.value)}
                  className="h-10 rounded-lg border border-gray-200 bg-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950"
                />
              </label>
            </section>

            <section className="space-y-2">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">初始资金 (CNY)</label>
              <div className="relative">
                <Input
                  type="number"
                  value={initialCapital}
                  onChange={(event) => setInitialCapital(event.target.value)}
                  className="h-10 rounded-lg border border-gray-200 bg-white pr-10 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -trangray-y-1/2 text-sm text-gray-400">元</span>
              </div>
            </section>

            <button
              type="button"
              onClick={submitBacktest}
              disabled={!selectedStrategy || runStatus === 'running'}
              className={cn(
                'flex h-10 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors',
                !selectedStrategy || runStatus === 'running'
                  ? 'cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
                  : 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600',
              )}
            >
              {runStatus === 'running' ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} className="shrink-0 fill-current" />}
              {runStatus === 'running' ? '回测中...' : '开始回测'}
            </button>
            <div className="text-[11px] leading-5 text-gray-400">{runMessage}</div>

            <Separator className="bg-gray-200 dark:bg-gray-800" />

            <section className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">策略参数</div>

              {parameterFields.length ? (
                <div className="space-y-3">
                  {parameterFields.map((field) => {
                    const value = strategyParameters[field.key]
                    const enabled = value === true
                    const inputValue =
                      typeof value === 'string' || typeof value === 'number' ? value : value == null ? '' : String(value)
                    return (
                      <label key={field.key} className="block">
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{field.label}</span>
                          <span className="text-[11px] text-gray-400">{field.type}</span>
                        </div>
                        {field.enum?.length ? (
                          <select
                            value={String(value ?? '')}
                            onChange={(event) =>
                              setStrategyParameters((prev) => ({ ...prev, [field.key]: event.target.value }))
                            }
                            className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100"
                          >
                            {field.enum.map((option) => (
                              <option key={String(option)} value={String(option)}>
                                {String(option)}
                              </option>
                            ))}
                          </select>
                        ) : field.type === 'boolean' ? (
                          <button
                            type="button"
                            onClick={() => setStrategyParameters((prev) => ({ ...prev, [field.key]: !enabled }))}
                            className={cn(
                              'flex h-10 w-full items-center justify-between rounded-lg border px-3 text-sm transition-colors',
                              enabled
                                ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                : 'border-gray-200 bg-white text-gray-600 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300',
                            )}
                          >
                            <span>{enabled ? '已开启' : '已关闭'}</span>
                            <ChevronDown size={14} className={cn(enabled && 'rotate-180')} />
                          </button>
                        ) : (
                          <Input
                            type={field.type === 'number' ? 'number' : 'text'}
                            value={inputValue}
                            onChange={(event) =>
                              setStrategyParameters((prev) => ({
                                ...prev,
                                [field.key]: field.type === 'number' ? Number(event.target.value) : event.target.value,
                              }))
                            }
                            className="h-10 rounded-lg border border-gray-200 bg-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950"
                          />
                        )}
                        {field.description ? (
                          <div className="mt-1 text-[11px] leading-5 text-gray-400">{field.description}</div>
                        ) : null}
                      </label>
                    )
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  <Textarea
                    value={JSON.stringify(strategyParameters, null, 2)}
                    onChange={(event) => {
                      try {
                        const parsed = JSON.parse(event.target.value || '{}')
                        setStrategyParameters(parsed)
                        setRunMessage('参数已更新')
                      } catch {
                        setRunMessage('参数 JSON 暂未生效，请确认格式后再运行')
                      }
                    }}
                    className="min-h-40 rounded-lg border border-gray-200 bg-white font-mono text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950"
                  />
                  <div className="text-[11px] leading-5 text-gray-400">
                    该策略暂无结构化参数 schema，可在此编辑 JSON。
                  </div>
                </div>
              )}
            </section>

            <Separator className="bg-gray-200 dark:bg-gray-800" />

            <section className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">交易成本与数据源</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-[11px] text-gray-400">手续费</span>
                  <Input type="number" step="0.0001" value={commissionRate} onChange={(event) => setCommissionRate(event.target.value)} className="h-10 rounded-lg border-gray-200 bg-white text-sm dark:border-gray-800 dark:bg-gray-950" />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] text-gray-400">滑点</span>
                  <Input type="number" step="0.0001" value={slippage} onChange={(event) => setSlippage(event.target.value)} className="h-10 rounded-lg border-gray-200 bg-white text-sm dark:border-gray-800 dark:bg-gray-950" />
                </label>
                <label className="col-span-2 space-y-1">
                  <span className="text-[11px] text-gray-400">数据源</span>
                  <select
                    value={dataSource}
                    onChange={(event) => setDataSource(event.target.value)}
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100"
                  >
                    <option value="auto">auto（推荐）</option>
                    <option value="akshare">akshare</option>
                    <option value="akshare_tx">akshare_tx</option>
                  </select>
                </label>
              </div>
            </section>
          </div>
        </ScrollArea>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">历史记录</div>
              <button type="button" onClick={refreshHistory} className="text-[11px] text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                刷新
              </button>
            </div>
            {historyError ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
                {historyError}
              </div>
            ) : null}
            <div className="space-y-2">
              {historyLoading ? (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-400">
                  正在加载历史...
                </div>
              ) : null}
              {strategyHistory.map((job) => {
                const active = job.job_id === selectedJobId
                return (
                  <button
                    key={job.job_id}
                    type="button"
                    onClick={() => {
                      void loadDetail(job.job_id)
                      setSidebarTab('params')
                    }}
                    className={cn(
                      'w-full rounded-lg border p-3 text-left transition-colors',
                      active
                        ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/30'
                        : 'border-gray-200 bg-white hover:border-blue-200 hover:bg-blue-50/50 dark:border-gray-800 dark:bg-gray-950 dark:hover:border-blue-800',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{job.symbol}</div>
                      <span className={cn('rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em]', statusTone(job.status))}>
                        {job.status}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(job.start_date)} → {formatDate(job.end_date)}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-400">
                      <span>{formatPercent(job.progress || 0)}</span>
                      {job.strategy_id ? <span>策略 #{job.strategy_id}</span> : null}
                    </div>
                  </button>
                )
              })}
              {!historyLoading && !strategyHistory.length ? (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-400">
                  暂无回测历史，运行一次后这里会自动出现。
                </div>
              ) : null}
            </div>
          </div>
        </ScrollArea>
      )}
    </div>
  )

  const mainPanel = (
    <div className="flex h-full min-w-0 flex-col bg-white dark:bg-gray-950">
      <div className={backtestChromeHeaderClass}>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase leading-none tracking-[0.18em] text-gray-400 dark:text-gray-500">Backtest Result</div>
            <div className="mt-1 min-w-0 truncate text-sm font-semibold leading-tight text-gray-900 dark:text-gray-100">
              {selectedSymbol} · {selectedSymbolName || '等待选择标的'}
              <span className="font-normal text-gray-500 dark:text-gray-400">
                {' '}
                · {selectedStrategy ? selectStrategyLabel(selectedStrategy) : '请选择一个策略开始回测'}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <span
              className={cn(
                'rounded-full border px-2 py-0.5 text-[10px] font-medium',
                statusTone(runStatus === 'idle' ? activeDetail?.job.status : runStatus),
              )}
            >
              {runStatus === 'idle' ? activeDetail?.job.status || 'idle' : runStatus}
            </span>
            <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
              {runStartDate} → {runEndDate}
            </span>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-5 bg-gray-50 p-5 dark:bg-gray-900/50">
          {detailLoading ? (
            <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-white text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-950/40 dark:text-gray-400">
              <Loader2 className="mr-2 animate-spin" size={16} />
              正在打开历史回测...
            </div>
          ) : null}

          {!detailLoading && !activeDetail ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-dashed border-gray-200 bg-white p-8 shadow-[0_18px_60px_rgba(15,23,42,0.04)] dark:border-gray-800 dark:bg-gray-950/40"
            >
              <div className="flex items-start justify-between gap-6">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
                    <Workflow size={12} />
                    回测工作台
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    先选标的、再选策略、最后点击开始。
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-gray-500 dark:text-gray-400">
                    中间区域承载回测结果、权益曲线和交易明细。左栏选择标的和参数后，就可以直接开始。
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className="rounded-full border border-gray-200 bg-white px-3 py-1 dark:border-gray-800 dark:bg-gray-950">日频回测</span>
                    <span className="rounded-full border border-gray-200 bg-white px-3 py-1 dark:border-gray-800 dark:bg-gray-950">A 股标的</span>
                    <span className="rounded-full border border-gray-200 bg-white px-3 py-1 dark:border-gray-800 dark:bg-gray-950">策略参数</span>
                    <span className="rounded-full border border-gray-200 bg-white px-3 py-1 dark:border-gray-800 dark:bg-gray-950">历史结果</span>
                  </div>
                </div>
                <div className="hidden rounded-lg border border-gray-200 bg-gray-50 p-4 text-gray-500 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400 lg:block">
                  <BarChart3 size={22} className="text-gray-500" />
                </div>
              </div>
            </motion.div>
          ) : null}

          {activeDetail ? (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-[0_16px_60px_rgba(15,23,42,0.05)] dark:border-gray-800 dark:bg-gray-950/70">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-2xl">
                    <div className="text-xs uppercase tracking-[0.18em] text-gray-400">结果摘要</div>
                    <div className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {activeDetail.result ? `${activeDetail.result.strategy_name} · ${activeDetail.result.symbol}` : `${activeDetail.job.symbol} · 结果同步中`}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                      {activeDetail.result
                        ? '这条摘要卡固定在顶部，方便快速判断这次回测是否已经产出有效结果。'
                        : '任务已经跑完，但结果详情还在同步中。这里会先展示任务级状态，等结果落库后自动补齐。'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400">
                    <Activity size={14} />
                    {runMessage}
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/60">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-gray-400">总收益</div>
                    <div className={cn('mt-1 text-xl font-semibold', summaryCards[0]?.tone)}>{summaryCards[0]?.value}</div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/60">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-gray-400">年化 / 回撤</div>
                    <div className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100">
                      {summaryCards[1]?.value} / {summaryCards[2]?.value}
                    </div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/60">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-gray-400">交易数</div>
                    <div className={cn('mt-1 text-xl font-semibold', summaryCards[4]?.tone)}>{summaryCards[4]?.value}</div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/60">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-gray-400">胜率 / 夏普</div>
                    <div className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100">
                      {summaryCards[5]?.value} / {summaryCards[3]?.value}
                    </div>
                  </div>
                </div>
              </section>

              {activeDetail.result ? (
                <>
                  <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                    {summaryCards.map((card) => (
                      <div key={card.label} className="rounded-lg border border-gray-200 bg-white p-4 shadow-[0_16px_60px_rgba(15,23,42,0.05)] dark:border-gray-800 dark:bg-gray-950/70">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-gray-400">{card.label}</div>
                        <div className={cn('mt-2 text-2xl font-semibold tracking-tight', card.tone)}>{card.value}</div>
                      </div>
                    ))}
                  </section>

                  <section className="grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
                    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-[0_16px_60px_rgba(15,23,42,0.05)] dark:border-gray-800 dark:bg-gray-950/70">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="text-xs uppercase tracking-[0.18em] text-gray-400">权益曲线</div>
                          <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">账户价值与回撤</div>
                        </div>
                        <div className="flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
                          <LineChartIcon size={14} />
                          {equityCurveData.length} 个点
                        </div>
                      </div>
                      <div className="mt-4">
                        <EquityChart data={equityCurveData} />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-[0_16px_60px_rgba(15,23,42,0.05)] dark:border-gray-800 dark:bg-gray-950/70">
                        <div className="text-xs uppercase tracking-[0.18em] text-gray-400">回测概况</div>
                        <div className="mt-4 space-y-3 text-sm text-gray-600 dark:text-gray-400">
                          <div className="flex items-center justify-between gap-4">
                            <span>策略</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">{activeDetail.result.strategy_name}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span>标的</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">{activeDetail.result.symbol}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span>区间</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {formatDate(activeDetail.result.start_date)} → {formatDate(activeDetail.result.end_date)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span>初始资金</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">{formatNumber(activeDetail.result.initial_capital)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span>最终资金</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">{formatNumber(activeDetail.result.final_capital)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-[0_16px_60px_rgba(15,23,42,0.05)] dark:border-gray-800 dark:bg-gray-950/70">
                        <div className="text-xs uppercase tracking-[0.18em] text-gray-400">运行信息</div>
                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/60">
                            <div className="text-[11px] text-gray-400">回测任务</div>
                            <div className="mt-1 font-medium text-gray-900 dark:text-gray-100">{activeDetail.job.job_id.slice(0, 10)}</div>
                          </div>
                          <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/60">
                            <div className="text-[11px] text-gray-400">任务状态</div>
                            <div className="mt-1 font-medium text-gray-900 dark:text-gray-100">{activeDetail.job.status}</div>
                          </div>
                          <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/60">
                            <div className="text-[11px] text-gray-400">提交时间</div>
                            <div className="mt-1 font-medium text-gray-900 dark:text-gray-100">
                              {formatDate(activeDetail.job.created_at || undefined)}
                            </div>
                          </div>
                          <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/60">
                            <div className="text-[11px] text-gray-400">进度</div>
                            <div className="mt-1 font-medium text-gray-900 dark:text-gray-100">{formatPercent(activeDetail.job.progress)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-[0_16px_60px_rgba(15,23,42,0.05)] dark:border-gray-800 dark:bg-gray-950/70">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-gray-400">交易明细</div>
                        <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">买卖记录与手续费</div>
                      </div>
                      <div className="flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
                        <SquareStack size={14} />
                        {trades.length} 笔
                      </div>
                    </div>
                    <div className="mt-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>时间</TableHead>
                            <TableHead>方向</TableHead>
                            <TableHead>价格</TableHead>
                            <TableHead>数量</TableHead>
                            <TableHead>手续费</TableHead>
                            <TableHead>PnL</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {trades.length ? trades.map((trade) => (
                            <TableRow key={trade.trade_id}>
                              <TableCell className="font-mono text-xs text-gray-500">{formatDate(trade.trade_time)}</TableCell>
                              <TableCell>
                                <span className={cn('rounded-full border px-2.5 py-1 text-[11px] font-medium', sideTone(trade.side))}>
                                  {trade.side}
                                </span>
                              </TableCell>
                              <TableCell>{formatNumber(trade.price, 2)}</TableCell>
                              <TableCell>{trade.quantity}</TableCell>
                              <TableCell>{formatNumber(trade.commission, 2)}</TableCell>
                              <TableCell className={cn(trade.pnl && trade.pnl > 0 ? 'text-emerald-600' : trade.pnl && trade.pnl < 0 ? 'text-rose-600' : '')}>
                                {formatNumber(trade.pnl ?? 0, 2)}
                              </TableCell>
                            </TableRow>
                          )) : (
                            <TableRow>
                              <TableCell colSpan={6} className="py-10 text-center text-gray-500">
                                暂无交易明细
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </section>
                </>
              ) : (
                <section className="rounded-lg border border-dashed border-gray-200 bg-white p-6 shadow-[0_16px_60px_rgba(15,23,42,0.04)] dark:border-gray-800 dark:bg-gray-950/70">
                  <div className="flex items-start justify-between gap-6">
                    <div className="max-w-2xl">
                      <div className="text-xs uppercase tracking-[0.18em] text-gray-400">结果同步中</div>
                      <h2 className="mt-3 text-xl font-semibold text-gray-900 dark:text-gray-100">
                        任务已经完成，正在等待结果明细落库。
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                        这通常只会持续几秒钟。如果一直停在这里，我们会继续重试，直到权益曲线、交易明细和指标都同步出来。
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 dark:border-gray-800 dark:bg-gray-900/60">
                          任务：{activeDetail.job.job_id.slice(0, 10)}
                        </span>
                        <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 dark:border-gray-800 dark:bg-gray-900/60">
                          状态：{activeDetail.job.status}
                        </span>
                        <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 dark:border-gray-800 dark:bg-gray-900/60">
                          进度：{formatPercent(activeDetail.job.progress)}
                        </span>
                      </div>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-gray-500 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400">
                      <Loader2 size={22} className="animate-spin text-gray-500" />
                    </div>
                  </div>
                </section>
              )}
            </motion.div>
          ) : null}

          {detailError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
              {detailError}
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  )

  const rightPanel = (
    <div className="flex h-full flex-col bg-white dark:bg-gray-950">
      <div className={backtestChromeHeaderClass}>
        <div>
          <div className="text-[10px] uppercase leading-none tracking-[0.18em] text-gray-400">Reserve Panel</div>
          <h3 className="mt-1 text-sm font-semibold leading-tight text-gray-900 dark:text-gray-100">右侧预留区</h3>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center p-5">
        <div className="max-w-xs rounded-lg border border-dashed border-gray-200 bg-gray-50/80 p-5 text-center dark:border-gray-800 dark:bg-gray-900/40">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
            <Target size={20} />
          </div>
          <div className="mt-4 text-sm font-semibold text-gray-900 dark:text-gray-100">暂时留白</div>
          <p className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
            后续可以放策略日志、参数扫描、调仓建议，或 AI 对回测结果的点评。
          </p>
        </div>
      </div>
      <div className="border-t border-gray-200 px-4 py-3 text-[11px] text-gray-400 dark:border-gray-800">
        当前先保持克制，等右栏业务确定后再继续加内容。
      </div>
    </div>
  )

  return (
    <WorkbenchLayout
      className="bg-gray-50 dark:bg-gray-950"
      innerClassName="border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950"
      leftPanelId="backtest-left"
      mainPanelId="backtest-main"
      rightPanelId="backtest-right"
      leftMinPx={300}
      leftMaxPx={420}
      rightMinPx={240}
      rightMaxPx={340}
      leftSidebarVisible={!leftCollapsed}
      rightSidebarVisible={!rightCollapsed}
      left={leftPanel}
      main={mainPanel}
      right={rightPanel}
    />
  )
}
