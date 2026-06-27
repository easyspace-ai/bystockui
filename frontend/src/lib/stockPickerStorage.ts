type WatchlistGroup = {
  id: string
  name: string
  codes: string[]
  createdAt: number
  updatedAt: number
}

const STORAGE_KEY = 'watchlist.groups'

const DEFAULT_GROUPS: WatchlistGroup[] = [
  {
    id: 'default',
    name: '默认分组',
    codes: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
]

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function normalizeStockCode(code: string): string {
  const trimmed = code.trim().toLowerCase()
  if (!trimmed) return ''

  const prefixMatch = trimmed.match(/^(sh|sz|bj)\.?(\d{6})$/i)
  if (prefixMatch) return `${prefixMatch[1].toLowerCase()}${prefixMatch[2]}`

  const suffixMatch = trimmed.match(/^(\d{6})\.(sh|sz|bj)$/i)
  if (suffixMatch) return `${suffixMatch[2].toLowerCase()}${suffixMatch[1]}`

  if (/^\d{6}$/.test(trimmed)) {
    if (trimmed.startsWith('6')) return `sh${trimmed}`
    if (trimmed.startsWith('0') || trimmed.startsWith('3')) return `sz${trimmed}`
    if (trimmed.startsWith('8') || trimmed.startsWith('4')) return `bj${trimmed}`
  }

  return trimmed
}

function getWatchlistGroups(): WatchlistGroup[] {
  return parseJson(localStorage.getItem(STORAGE_KEY), DEFAULT_GROUPS)
}

function saveWatchlistGroups(groups: WatchlistGroup[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(groups))
}

export function addToWatchlist(code: string, groupId = 'default') {
  const normalized = normalizeStockCode(code)
  if (!normalized) return

  const groups = getWatchlistGroups()
  const target = groups.find((group) => group.id === groupId)
  if (!target || target.codes.includes(normalized)) return

  target.codes.push(normalized)
  target.updatedAt = Date.now()
  saveWatchlistGroups(groups)
}

export function isInWatchlist(code: string): boolean {
  const normalized = normalizeStockCode(code)
  if (!normalized) return false
  return getWatchlistGroups().some((group) => group.codes.includes(normalized))
}
