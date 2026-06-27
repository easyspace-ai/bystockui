/**
 * DailyAPI（FastAPI）：浏览器只请求同源 `/daily-api`，由主 Go 进程反向代理（见 backend/internal/workbench/proxy/dailyapi.go）。
 * 本地 `vite` 开发时将 /daily-api 转到同一 Go 服务，路径与生产品一致。
 */

export function dailyApiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  return `/daily-api${p}`
}

export async function dailyFetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(dailyApiUrl(path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const t = await res.text()
    let msg = t || res.statusText || `HTTP ${res.status}`
    try {
      const j = JSON.parse(t) as { detail?: unknown }
      const d = j.detail
      if (typeof d === 'string' && d.trim()) msg = d
      else if (Array.isArray(d))
        msg = d.map((x) => (typeof x === 'object' && x && 'msg' in x ? String((x as { msg: string }).msg) : String(x))).join(' ')
    } catch {
      /* 非 JSON 时保留原文 */
    }
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

export type DailyMarketState = {
  index: { name: string; price: number; change_pct: number }
  stocks: DailyStockRow[]
  last_update?: string
  is_monitoring?: boolean
  config?: { update_interval?: number }
}

export type DailyStockRow = {
  symbol: string
  name: string
  price?: number
  change_pct?: number
  type?: string
  asset_type?: string
  cost_price?: number
  position_size?: number
  volume_ratio?: number
  composite_score?: number
  is_starred?: boolean
  status?: string
}

export type DailySelection = {
  symbol: string
  name: string
  close_price?: number
  volume_ratio?: number
  composite_score?: number
  asset_type?: string
  ai_analysis?: string
  created_at?: string
  ma20_signal?: string
}

export type DailySelectionsResponse = {
  selections: DailySelection[]
  available_dates: string[]
}

export type StockMetrics = {
  composite_score?: number
  rating?: string
  date?: string
  score_breakdown?: [string, number, number][]
  ma_arrangement?: string
  trend_signal?: string
  pattern_details?: string[]
  rsi?: number
  volume_ratio?: number
  stop_loss_suggest?: string | number
  operation_suggestion?: string
}

export type AnalysisHistoryData = {
  symbol?: string
  name?: string
  analysis_date?: string
  ai_analysis?: string
  html?: string
  mode?: string
}

export type StreamEvent =
  | { type: 'progress'; message?: string; value?: number; content?: string }
  | { type: 'step'; message?: string; content?: string }
  | { type: 'token'; content?: string }
  | { type: 'result'; content?: string }
  | { type: 'final_html'; content?: string }
  | { type: 'complete'; content?: string }
  | { type: 'error'; content?: string }

async function readSseStream(
  response: Response,
  onEvent: (ev: StreamEvent) => void,
): Promise<void> {
  const reader = response.body?.getReader()
  if (!reader) return
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        try {
          const data = JSON.parse(line.slice(6)) as StreamEvent
          onEvent(data)
        } catch {
          /* ignore */
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export const dailyApi = {
  getStatus: () => dailyFetchJson<DailyMarketState>('/api/status'),

  refreshRealtime: () =>
    dailyFetchJson<{
      status: string
      stocks?: DailyStockRow[]
      index?: DailyMarketState['index']
      last_update?: string
      message?: string
    }>('/api/realtime/refresh', { method: 'POST' }),

  getDailySelections: (date?: string) => {
    const q = date ? `?date=${encodeURIComponent(date)}` : ''
    return dailyFetchJson<DailySelectionsResponse>(`/api/selections${q}`)
  },

  addHolding: (body: {
    symbol: string
    name?: string
    asset_type?: string
    cost_price?: number
    position_size?: number
  }) =>
    dailyFetchJson<{ status: string; message?: string; already_existed?: boolean }>('/api/holdings', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateHolding: (symbol: string, body: { cost_price?: number; position_size?: number }) =>
    dailyFetchJson<{ status: string }>(`/api/holdings/${encodeURIComponent(symbol)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  deleteHolding: (symbol: string) =>
    dailyFetchJson<{ status: string }>(`/api/holdings/${encodeURIComponent(symbol)}`, { method: 'DELETE' }),

  toggleStarHolding: (symbol: string) =>
    dailyFetchJson<{ status: string; is_starred?: boolean }>(
      `/api/holdings/${encodeURIComponent(symbol)}/star`,
      { method: 'PATCH' },
    ),

  calculateStockScore: (symbol: string) =>
    dailyFetchJson<{ status: string; data?: StockMetrics }>(
      `/api/analyze/${encodeURIComponent(symbol)}/score`,
      { method: 'POST' },
    ),

  getStockMetrics: (symbol: string, date?: string | null) => {
    const q = date ? `?date=${encodeURIComponent(date)}` : ''
    return dailyFetchJson<{ status: string; data?: StockMetrics }>(
      `/api/analyze/${encodeURIComponent(symbol)}/metrics${q}`,
    )
  },

  getLatestAnalysis: (symbol: string, mode: string) =>
    dailyFetchJson<{ status: string; data?: AnalysisHistoryData }>(
      `/api/analyze/${encodeURIComponent(symbol)}/latest?mode=${encodeURIComponent(mode)}`,
    ),

  getAnalysisDates: (symbol: string, mode: string) =>
    dailyFetchJson<{ status: string; dates?: string[] }>(
      `/api/analyze/${encodeURIComponent(symbol)}/dates?mode=${encodeURIComponent(mode)}`,
    ),

  getAnalysisHistory: (symbol: string, date: string, mode: string) =>
    dailyFetchJson<{ status: string; data?: AnalysisHistoryData }>(
      `/api/analyze/${encodeURIComponent(symbol)}/history?date=${encodeURIComponent(date)}&mode=${encodeURIComponent(mode)}`,
    ),

  getAgents: () => dailyFetchJson<{ status: string; agents?: { slug: string; name: string }[] }>('/api/agents'),

  generateReport: (section: string) =>
    dailyFetchJson<{ status: string }>(`/api/report/generate?section=${encodeURIComponent(section)}`, {
      method: 'POST',
    }),

  getReportStatus: () =>
    dailyFetchJson<{ status: string; message?: string }>('/api/report/status'),

  getKline: (symbol: string, period: string) =>
    dailyFetchJson<{
      status: string
      message?: string
      dates: string[]
      values: [number, number, number, number][]
      volumes: number[]
      ma5?: (number | null)[]
      ma10?: (number | null)[]
      ma20?: (number | null)[]
      ma30?: (number | null)[]
    }>(`/api/kline/${encodeURIComponent(symbol)}?period=${encodeURIComponent(period)}`),

  analyzeStockStream: async (
    symbol: string,
    mode: string,
    agents: string[],
    onProgress: (ev: StreamEvent) => void,
    onComplete: (ev: StreamEvent) => void,
    onError: (err: Error | StreamEvent) => void,
  ) => {
    const ap = agents.length ? `&agents=${encodeURIComponent(agents.join(','))}` : ''
    const url = dailyApiUrl(
      `/api/analyze/${encodeURIComponent(symbol)}/report/stream?mode=${encodeURIComponent(mode)}${ap}`,
    )
    let response: Response
    try {
      response = await fetch(url)
    } catch (e) {
      onError(e instanceof Error ? e : new Error(String(e)))
      return
    }
    if (!response.ok) {
      onError(new Error(await response.text()))
      return
    }
    try {
      await readSseStream(response, (data) => {
        if (data.type === 'progress' || data.type === 'step' || data.type === 'token') {
          onProgress(data)
        } else if (
          data.type === 'final_html' ||
          data.type === 'result' ||
          data.type === 'complete'
        ) {
          onComplete(data)
        } else if (data.type === 'error') {
          onError(data)
        }
      })
    } catch (e) {
      onError(e instanceof Error ? e : new Error(String(e)))
    }
  },

  analyzeIntraday: async (
    symbol: string,
    onProgress: (ev: StreamEvent) => void,
    onComplete: (ev: StreamEvent) => void,
    onError: (err: Error | StreamEvent) => void,
  ) => {
    const url = dailyApiUrl(`/api/analyze/${encodeURIComponent(symbol)}/intraday`)
    let response: Response
    try {
      response = await fetch(url)
    } catch (e) {
      onError(e instanceof Error ? e : new Error(String(e)))
      return
    }
    if (!response.ok) {
      onError(new Error(await response.text()))
      return
    }
    try {
      await readSseStream(response, (data) => {
        if (data.type === 'progress' || data.type === 'step' || data.type === 'token') {
          onProgress(data)
        } else if (
          data.type === 'final_html' ||
          data.type === 'result' ||
          data.type === 'complete'
        ) {
          onComplete(data)
        } else if (data.type === 'error') {
          onError(data)
        }
      })
    } catch (e) {
      onError(e instanceof Error ? e : new Error(String(e)))
    }
  },
}
