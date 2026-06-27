export interface AnalysisSessionMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'report'
  content: string
  timestamp: string
  agent?: string
  section?: string
  complete?: boolean
}

export interface AnalysisSession {
  id: string
  title: string
  symbol: string
  createdAt: string
  updatedAt: string
  messages: AnalysisSessionMessage[]
  reportSummary?: string
}

const STORAGE_KEY = 'analysis-workspace-sessions-v1'
const MAX_SESSIONS = 20
const SAVE_DELAY_MS = 800

let pendingSessions: AnalysisSession[] | null = null
let saveTimer: number | null = null

function nowIso(): string {
  return new Date().toISOString()
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function safeLoad(): AnalysisSession[] {
  try {
    const parsed = safeParse<AnalysisSession[]>(localStorage.getItem(STORAGE_KEY))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function safeSave(sessions: AnalysisSession[]) {
  pendingSessions = sessions.slice(0, MAX_SESSIONS)
  if (saveTimer != null) {
    window.clearTimeout(saveTimer)
  }
  saveTimer = window.setTimeout(() => {
    if (!pendingSessions) return
    const snapshot = pendingSessions
    pendingSessions = null
    saveTimer = null
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
    } catch {
      // ignore storage quota / private mode failures
    }
  }, SAVE_DELAY_MS)
}

export function flushAnalysisSessionsSave() {
  if (saveTimer != null) {
    window.clearTimeout(saveTimer)
    saveTimer = null
  }
  if (!pendingSessions) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingSessions))
  } catch {
    // ignore storage quota / private mode failures
  } finally {
    pendingSessions = null
  }
}

export function loadAnalysisSessions(): AnalysisSession[] {
  return safeLoad()
}

export function saveAnalysisSessions(sessions: AnalysisSession[]) {
  safeSave(sessions)
}

export function createAnalysisSession(symbol: string, title?: string): AnalysisSession {
  const createdAt = nowIso()
  return {
    id: `session-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: title || `${symbol || '未命名会话'}`,
    symbol,
    createdAt,
    updatedAt: createdAt,
    messages: [],
  }
}

export function summarizeSessionTitle(messages: AnalysisSessionMessage[], symbol: string): string {
  const firstUser = messages.find((message) => message.role === 'user' && message.content.trim())
  const content = firstUser?.content.trim().replace(/\s+/g, ' ') || ''
  if (content) return content.slice(0, 24)
  return symbol || '未命名会话'
}

export function normalizeSessions(sessions: AnalysisSession[]): AnalysisSession[] {
  return [...sessions]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_SESSIONS)
}

export function upsertSession(
  sessions: AnalysisSession[],
  session: AnalysisSession,
): AnalysisSession[] {
  const next = sessions.filter((item) => item.id !== session.id)
  next.unshift(session)
  return normalizeSessions(next)
}
