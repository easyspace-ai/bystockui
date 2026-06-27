export interface LocalAnalysisHistoryRecord {
  id: string
  symbol: string
  tradeDate: string
  decision?: string | null
  direction?: string | null
  confidence?: number | null
  targetPrice?: number | null
  stopLossPrice?: number | null
  createdAt: string
  updatedAt: string
  summary?: string | null
  resultData?: Record<string, any> | null
}

const STORAGE_KEY = 'analysis-workspace-history-v1'
const MAX_HISTORY = 30

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function safeLoad(): LocalAnalysisHistoryRecord[] {
  try {
    const parsed = safeParse<LocalAnalysisHistoryRecord[]>(localStorage.getItem(STORAGE_KEY))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function safeSave(records: LocalAnalysisHistoryRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, MAX_HISTORY)))
  } catch {
    // ignore private mode / quota failures
  }
}

export function loadAnalysisHistory(): LocalAnalysisHistoryRecord[] {
  return safeLoad()
}

export function saveAnalysisHistory(records: LocalAnalysisHistoryRecord[]) {
  safeSave(records)
}

export function upsertAnalysisHistory(
  records: LocalAnalysisHistoryRecord[],
  record: LocalAnalysisHistoryRecord,
): LocalAnalysisHistoryRecord[] {
  const next = records.filter((item) => item.id !== record.id)
  next.unshift(record)
  next.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return next.slice(0, MAX_HISTORY)
}

