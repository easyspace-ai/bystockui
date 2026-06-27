import { normalizeCnSymbol } from '@/lib/symbols'
import { searchTradingStocks } from '@/lib/tradingApi'

const API_V1 = '/api/v1'

export type FollowedStockRow = {
  id?: number
  stockCode: string
  stockName: string
  note?: string
  isStarred?: boolean
  costPrice?: number
  quantity?: number
  sort?: number
  userId?: string
}

type MarketEnvelope<T> = {
  code: number
  message: string
  data?: T
}

async function readJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T
  } catch {
    throw new Error('服务返回了无法解析的数据')
  }
}

function userHeaders(): HeadersInit {
  const uid = typeof localStorage !== 'undefined' ? localStorage.getItem('x-user-id') : null
  const h: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  if (uid) h['X-User-Id'] = uid
  return h
}

async function marketEnvelopeRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { ...userHeaders(), ...(init?.headers as Record<string, string> | undefined) },
  })
  if (!response.ok) {
    throw new Error(response.statusText || '请求失败')
  }
  const payload = await readJson<MarketEnvelope<T>>(response)
  if (payload.code !== 0) {
    throw new Error(payload.message || '接口返回错误')
  }
  return payload.data as T
}

/** 与后端 / 专家分析列表比对时：统一为 600519.SH 形式 */
export function normalizeWatchlistSymbol(raw: string): string {
  const m = raw.trim().toLowerCase().match(/^(sh|sz|bj)(\d{6})$/)
  if (m) return `${m[2]}.${m[1].toUpperCase()}`
  return normalizeCnSymbol(raw) || raw.trim().toUpperCase()
}

export function followStockSymbolForApi(raw: string): string {
  return normalizeWatchlistSymbol(raw)
}

/** 仅输入代码或与代码相同时，用本地股票库补全证券简称（鲲鹏加自选、写主库名称） */
async function resolveStockNameForFollow(
  normalizedSymbol: string,
  hint: string | undefined,
): Promise<string> {
  const h = hint?.trim()
  const core = normalizedSymbol.replace(/\.(SH|SZ|BJ)$/i, '')
  const hintIsUseful =
    !!h &&
    h !== normalizedSymbol &&
    h.toUpperCase() !== normalizedSymbol.toUpperCase() &&
    h !== core

  if (hintIsUseful) return h

  if (!/^\d{6}$/.test(core)) {
    return h || normalizedSymbol
  }
  try {
    const { results } = await searchTradingStocks(core)
    const exact = results.find((r) => normalizeWatchlistSymbol(r.symbol) === normalizedSymbol)
    if (exact?.name?.trim()) return exact.name.trim()
    const first = results[0]
    if (first?.name?.trim()) {
      const fc = normalizeWatchlistSymbol(first.symbol).replace(/\.(SH|SZ|BJ)$/i, '')
      if (fc === core) return first.name.trim()
    }
  } catch {
    /* 搜索失败时退回代码 */
  }
  return h || normalizedSymbol
}

/** 从主库拉取自选股列表 */
export async function listFollowedStocks(): Promise<FollowedStockRow[]> {
  const rows = await marketEnvelopeRequest<FollowedStockRow[]>(`${API_V1}/stock/followed`)
  return rows ?? []
}

/** 不吞掉错误，便于专家分析等页提示「主后端未就绪」 */
export async function listFollowedStocksSafe(): Promise<{
  rows: FollowedStockRow[]
  error: string | null
}> {
  try {
    const rows = await listFollowedStocks()
    return { rows: rows ?? [], error: null }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[watchlist] GET /api/v1/stock/followed failed:', msg)
    return { rows: [], error: msg }
  }
}

export async function followStock(symbol: string, stockName?: string, note?: string): Promise<void> {
  const code = normalizeWatchlistSymbol(symbol)
  if (!code) throw new Error('无效的代码')
  const name = await resolveStockNameForFollow(code, stockName)
  await marketEnvelopeRequest<null>(`${API_V1}/stock/${encodeURIComponent(code)}/follow`, {
    method: 'POST',
    body: JSON.stringify({
      stockName: name,
      note: note?.trim() ?? '',
    }),
  })
}

export async function unfollowStock(symbol: string): Promise<void> {
  const code = normalizeWatchlistSymbol(symbol)
  if (!code) return
  const response = await fetch(`${API_V1}/stock/${encodeURIComponent(code)}/follow`, {
    method: 'DELETE',
    headers: userHeaders(),
  })
  if (!response.ok) {
    throw new Error(response.statusText || '请求失败')
  }
}

/** 规范化后的代码集合，用于鲲鹏等组件判断「是否已加自选」 */
export async function loadWatchlistSymbolSet(): Promise<Set<string>> {
  const rows = await listFollowedStocks()
  const set = new Set<string>()
  for (const r of rows) {
    const c = normalizeWatchlistSymbol(r.stockCode)
    if (c) set.add(c)
  }
  return set
}

const LEGACY_STORAGE = 'watchlist.groups'
const MIGRATION_FLAG = 'watchlist.migrated-to-stockdb'

/** 将本地 stockPickerStorage 分组中的代码一次性写入 stock.db（仅执行一次） */
export async function migrateLocalPickerWatchlistOnce(): Promise<void> {
  if (typeof localStorage === 'undefined') return
  if (localStorage.getItem(MIGRATION_FLAG)) return
  const raw = localStorage.getItem(LEGACY_STORAGE)
  if (!raw) {
    localStorage.setItem(MIGRATION_FLAG, '1')
    return
  }
  try {
    const groups = JSON.parse(raw) as { codes?: string[] }[]
    const codes = new Set<string>()
    for (const g of groups) {
      for (const c of g.codes ?? []) {
        const n = normalizeWatchlistSymbol(c)
        if (n) codes.add(n)
      }
    }
    const existing = await loadWatchlistSymbolSet()
    for (const c of codes) {
      if (!existing.has(c)) {
        await followStock(c, c)
        existing.add(c)
      }
    }
  } catch (e) {
    console.warn('watchlist migration skipped:', e)
  }
  localStorage.setItem(MIGRATION_FLAG, '1')
}
