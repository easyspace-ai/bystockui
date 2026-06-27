/** 与 backend StockV1Handler 一致：挂载在 /api/v1/market-data */
const API_BASE_URL = '/api/v1/market-data'

interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

const cache = new Map<string, { data: unknown; timestamp: number; ttl: number }>()

const DEFAULT_TTL = {
  quotes: 5_000,
  historyKline: 600_000,
  timeline: 5_000,
} as const

function getCacheKey(method: string, ...args: unknown[]): string {
  return `${method}:${JSON.stringify(args)}`
}

function withCache<T>(key: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
  const item = cache.get(key)
  if (item && Date.now() - item.timestamp <= item.ttl) {
    return Promise.resolve(item.data as T)
  }
  return fetcher().then((data) => {
    cache.set(key, { data, timestamp: Date.now(), ttl })
    return data
  })
}

async function get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const url = new URL(API_BASE_URL + path, window.location.origin)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value))
      }
    })
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const result = (await response.json()) as ApiResponse<T>
  if (result.code !== 0) {
    throw new Error(result.message || 'API error')
  }
  return result.data
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(API_BASE_URL + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  const result = (await response.json()) as ApiResponse<T>
  if (result.code !== 0) {
    throw new Error(result.message || 'API error')
  }
  return result.data
}

export interface FullQuote {
  code: string
  name: string
  price: number
  prevClose: number
  open: number
  high: number
  low: number
  volume: number
  amount: number
  change: number
  changePercent: number
  turnoverRate?: number | null
  pe?: number | null
  pb?: number | null
  amplitude?: number | null
  circulatingMarketCap?: number | null
  totalMarketCap?: number | null
  volumeRatio?: number | null
  avgPrice?: number | null
  time?: string
}

export interface KlineData {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  amount: number
}

export interface TimelineData {
  time: string
  price: number
  avgPrice: number
  volume: number
}

export interface TimelineResponse {
  symbol: string
  prevClose: number
  data: TimelineData[]
}

export interface TimelineBatchResponse {
  success: Record<string, TimelineResponse>
  failed?: Record<string, string>
}

export async function getAllAShareQuotesWithProgress(
  options?: {
    batchSize?: number
    concurrency?: number
    onProgress?: (completed: number, total: number) => void
  },
): Promise<FullQuote[]> {
  const result = await withCache(getCacheKey('getAllAShareQuotes'), DEFAULT_TTL.quotes, () =>
    get<FullQuote[]>('/quotes/all'),
  )
  if (options?.onProgress) {
    options.onProgress(result.length, result.length)
  }
  return result
}

export async function getHistoryKline(
  symbol: string,
  options?: {
    period?: 'daily' | 'weekly' | 'monthly'
    adjust?: '' | 'qfq' | 'hfq'
    startDate?: string
    endDate?: string
  },
): Promise<KlineData[]> {
  const params = {
    symbol,
    period: options?.period || 'daily',
    adjust: options?.adjust || '',
    start_date: options?.startDate,
    end_date: options?.endDate,
  }
  return withCache(
    getCacheKey('getHistoryKline', symbol, options),
    DEFAULT_TTL.historyKline,
    () => get<KlineData[]>('/kline/history', params),
  )
}

export async function getTodayTimeline(code: string): Promise<TimelineResponse> {
  return withCache(getCacheKey('getTodayTimeline', code), DEFAULT_TTL.timeline, () =>
    get<TimelineResponse>(`/timeline/${code}`),
  )
}

export async function getTodayTimelineBatch(codes: string[]): Promise<TimelineBatchResponse> {
  const uniqueCodes = Array.from(new Set(codes.filter(Boolean)))
  if (uniqueCodes.length === 0) {
    return { success: {} }
  }
  return post<TimelineBatchResponse>('/timeline/batch', { symbols: uniqueCodes })
}
