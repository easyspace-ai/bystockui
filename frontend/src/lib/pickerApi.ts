// ========== 类型定义 ==========

export interface TimelinePoint {
  time: string
  price: number
  avgPrice: number
}

export interface PickerStockResult {
  // 基础信息
  code: string
  name: string
  price: number
  changePercent: number
  change: number
  volume: number
  amount: number
  turnoverRate: number
  volumeRatio: number
  circulatingMarketCap: number
  totalMarketCap: number
  pe: number
  pb: number
  high: number
  low: number
  open: number
  prevClose: number
  market: string

  // 尾盘选股特有
  timeline?: TimelinePoint[]
  timelineAboveAvgRatio?: number

  // 妖股候选人特有
  momentumRatio?: number
  ma60Distance?: number
  avgTurnover5d?: number
  high20d?: number
  low20d?: number
  ma60?: number

  // 鲲鹏战法特有
  netProfit?: number
  safetyScore?: number
  potentialMultiple?: number
}

export interface PickerResponse {
  strategy: 'end_of_day' | 'momentum' | 'kunpeng'
  total: number
  list: PickerStockResult[]
}

export interface EndOfDayPickerRequest {
  marketCapMin?: number
  marketCapMax?: number
  volumeRatioMin?: number
  changePercentMin?: number
  changePercentMax?: number
  turnoverRateMin?: number
  turnoverRateMax?: number
  excludeST?: boolean
  timelineAboveAvgRatio?: number
}

export interface MomentumPickerRequest {
  momentumThreshold?: number
  trendAboveMA60?: boolean
  avgTurnoverMin?: number
  marketCapMin?: number
  marketCapMax?: number
  excludeST?: boolean
  priceMin?: number
  priceMax?: number
}

export interface KunpengPickerRequest {
  marketCapMin?: number
  marketCapMax?: number
  netProfitMin?: number
  peMin?: number
  peMax?: number
  excludeST?: boolean
  excludeNewStock?: boolean
  priceMin?: number
  priceMax?: number
}

export interface MarketQuote {
  code: string
  name: string
  price: number
  changePercent: number
  change: number
  open: number
  high: number
  low: number
  prevClose: number
  volume: number
  amount: number
  turnoverRate: number
  volumeRatio: number
  circulatingMarketCap: number
  totalMarketCap: number
  pe: number
  pb: number
  market: string
}

interface ApiResponse<T> {
  code: number
  message: string
  data?: T
}

// ========== API 客户端 ==========

const API_BASE = '/api/v1/picker'

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`
  const resp = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  if (!resp.ok) {
    throw new Error(`API request failed: ${resp.status}`)
  }

  const payload = (await resp.json()) as ApiResponse<T>
  if (payload.code !== 0) {
    throw new Error(payload.message || 'API error')
  }

  return payload.data as T
}

// ========== 导出函数 ==========

// 获取全市场行情
export async function getAllMarketQuotes(): Promise<MarketQuote[]> {
  return fetchApi<MarketQuote[]>('/quotes')
}

// 获取今日分时数据
export async function getTodayTimeline(code: string): Promise<TimelinePoint[]> {
  return fetchApi<TimelinePoint[]>(`/timeline/${encodeURIComponent(code)}`)
}

// 尾盘选股
export async function pickEndOfDay(
  req: EndOfDayPickerRequest
): Promise<PickerResponse> {
  return fetchApi<PickerResponse>('/end-of-day', {
    method: 'POST',
    body: JSON.stringify(req),
  })
}

// 妖股候选人扫描
export async function pickMomentum(
  req: MomentumPickerRequest
): Promise<PickerResponse> {
  return fetchApi<PickerResponse>('/momentum', {
    method: 'POST',
    body: JSON.stringify(req),
  })
}

// 鲲鹏战法筛选
export async function pickKunpeng(
  req: KunpengPickerRequest
): Promise<PickerResponse> {
  return fetchApi<PickerResponse>('/kunpeng', {
    method: 'POST',
    body: JSON.stringify(req),
  })
}
