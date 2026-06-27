const API_V1 = '/api/v1'

export type HotMoneyChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type HotMoneySessionSummary = {
  id: string
  title: string
  preview: string
  updatedAt: string
}

export type HotMoneySession = HotMoneySessionSummary & {
  userId: string
  messages: HotMoneyChatMessage[]
  htmlReport: string
  createdAt: string
}

type Envelope<T> = {
  code: number
  message: string
  data?: T
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

async function readEnvelope<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as Envelope<T>
  if (payload.code !== 0) {
    throw new Error(payload.message || '请求失败')
  }
  return payload.data as T
}

export async function listHotMoneySessions(): Promise<HotMoneySessionSummary[]> {
  const response = await fetch(`${API_V1}/hotmoney/sessions`, { headers: userHeaders() })
  if (!response.ok) throw new Error(response.statusText || '加载历史失败')
  const data = await readEnvelope<HotMoneySessionSummary[]>(response)
  return data ?? []
}

export async function getHotMoneySession(id: string): Promise<HotMoneySession> {
  const response = await fetch(`${API_V1}/hotmoney/sessions/${id}`, { headers: userHeaders() })
  if (!response.ok) throw new Error(response.statusText || '加载会话失败')
  return readEnvelope<HotMoneySession>(response)
}

export async function saveHotMoneySession(input: {
  id?: string
  title?: string
  messages: HotMoneyChatMessage[]
  htmlReport?: string
}): Promise<HotMoneySession> {
  const response = await fetch(`${API_V1}/hotmoney/sessions`, {
    method: 'POST',
    headers: userHeaders(),
    body: JSON.stringify(input),
  })
  if (!response.ok) throw new Error(response.statusText || '保存会话失败')
  return readEnvelope<HotMoneySession>(response)
}

export async function deleteHotMoneySession(id: string): Promise<void> {
  const response = await fetch(`${API_V1}/hotmoney/sessions/${id}`, {
    method: 'DELETE',
    headers: userHeaders(),
  })
  if (!response.ok) throw new Error(response.statusText || '删除会话失败')
  await readEnvelope<null>(response)
}

export function formatSessionTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
