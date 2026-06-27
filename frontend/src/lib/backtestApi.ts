export type BacktestJsonPrimitive = string | number | boolean | null
export type BacktestJsonValue = BacktestJsonPrimitive | BacktestJsonObject | BacktestJsonValue[]
export interface BacktestJsonObject {
  [key: string]: BacktestJsonValue
}

export interface BacktestStrategySummary {
  id: number
  name: string
  code: string
  language?: string
  description?: string | null
  tags?: string[]
  parameters_schema?: BacktestJsonObject | null
  version?: string
  status?: string
  is_template?: boolean
  template_type?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface BacktestJob {
  job_id: string
  strategy_id: number
  strategy_version?: string | null
  symbol: string
  start_date: string
  end_date: string
  initial_capital: number
  commission_rate: number
  slippage: number
  parameters?: BacktestJsonObject
  benchmark_symbol?: string | null
  data_source?: string | null
  status: string
  progress: number
  error_message?: string | null
  created_at?: string | null
  started_at?: string | null
  finished_at?: string | null
}

export interface BacktestResult {
  job_id: string
  strategy_id: number
  strategy_name: string
  symbol: string
  start_date: string
  end_date: string
  initial_capital: number
  final_capital: number
  total_return: number
  annual_return: number
  benchmark_return?: number
  max_drawdown?: number
  volatility?: number
  sharpe_ratio?: number
  sortino_ratio?: number
  calmar_ratio?: number
  total_trades?: number
  win_trades?: number
  loss_trades?: number
  win_rate?: number
  profit_loss_ratio?: number
  avg_profit?: number
  avg_loss?: number
  max_profit?: number
  max_loss?: number
  equity_curve?: number[]
  metrics?: BacktestJsonObject
  created_at?: string | null
}

export interface BacktestTrade {
  trade_id: string
  order_id: string
  symbol: string
  side: string
  price: number
  quantity: number
  commission: number
  pnl?: number
  trade_time: string
  bar_time?: string | null
}

export interface BacktestEquityPoint {
  trade_date: string
  equity: number
  cash: number
  position_value: number
  drawdown?: number
}

export interface BacktestDetailResponse {
  job: BacktestJob
  result: BacktestResult | null
  trades: BacktestTrade[]
  equity_points: BacktestEquityPoint[]
  metrics: BacktestJsonObject
}

export interface BacktestRunRequest {
  strategy_id: number
  symbol: string
  start_date: string
  end_date: string
  initial_capital: number
  commission_rate: number
  slippage: number
  parameters?: BacktestJsonObject
  data_source?: string
  benchmark_symbol?: string | null
}

function getBaseUrl(): string {
  const envUrl =
    (import.meta.env.VITE_BACKTEST_API_URL as string | undefined)?.trim() ||
    (import.meta.env.VITE_API_URL as string | undefined)?.trim()
  return envUrl ? envUrl.replace(/\/$/, '') : ''
}

async function readErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    try {
      const data = await response.json()
      return data?.detail || data?.message || response.statusText
    } catch {
      return response.statusText
    }
  }
  try {
    const text = await response.text()
    return text || response.statusText
  } catch {
    return response.statusText
  }
}

async function request<T>(path: string, init?: Parameters<typeof fetch>[1]): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  return response.json() as Promise<T>
}

export async function listBacktestStrategies(): Promise<BacktestStrategySummary[]> {
  return request<BacktestStrategySummary[]>('/api/v1/backtest/api/v1/strategies?limit=200')
}

export async function listBacktestJobs(params?: {
  skip?: number
  limit?: number
  strategy_id?: number
  symbol?: string
  status?: string
}): Promise<BacktestJob[]> {
  const search = new URLSearchParams()
  if (typeof params?.skip === 'number') search.set('skip', String(params.skip))
  if (typeof params?.limit === 'number') search.set('limit', String(params.limit))
  if (typeof params?.strategy_id === 'number') search.set('strategy_id', String(params.strategy_id))
  if (params?.symbol) search.set('symbol', params.symbol)
  if (params?.status) search.set('status', params.status)
  const query = search.toString()
  return request<BacktestJob[]>(`/api/v1/backtest/api/v1/backtests${query ? `?${query}` : ''}`)
}

export async function runBacktest(requestBody: BacktestRunRequest): Promise<BacktestJob> {
  return request<BacktestJob>('/api/v1/backtest/api/v1/backtests/run', {
    method: 'POST',
    body: JSON.stringify(requestBody),
  })
}

export async function getBacktestDetail(jobId: string): Promise<BacktestDetailResponse> {
  return request<BacktestDetailResponse>(`/api/v1/backtest/api/v1/backtests/${jobId}/detail`)
}
