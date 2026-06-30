export type SymbolSuggestion = { symbol: string; name: string }

export function marketTagForSymbol(symbol: string): string {
  const s = symbol.toUpperCase()
  if (s.endsWith('.HK')) return '港股'
  if (s.endsWith('.SH') || s.endsWith('.SZ') || s.endsWith('.BJ')) return 'A股'
  if (/\.(US|O|N)$/i.test(s) || /^[A-Z]{1,5}$/.test(s)) return '美股'
  return '标的'
}

/** 保留中文；仅将拉丁字母转大写（数字不变） */
export function normalizeSearchQuery(raw: string): string {
  if (!raw) return ''
  if (/[\u4e00-\u9fff]/.test(raw)) return raw
  return raw.replace(/[a-z]/g, (ch) => ch.toUpperCase())
}

/** 输入框 onChange：IME 组合输入期间不转换 */
export function applySearchInputChange(raw: string, isComposing: boolean): string {
  if (isComposing) return raw
  return normalizeSearchQuery(raw)
}

/** 输入是否像股票代码（非中文名称） */
export function isLikelyStockCode(raw: string): boolean {
  const v = raw.trim()
  if (!v || /[\u4e00-\u9fff]/.test(v)) return false
  return /^(SH|SZ|BJ|SS)?\d{4,6}(\.(SH|SZ|BJ|SS))?$/i.test(v)
}

export function stockSearchScore(query: string, item: SymbolSuggestion): number {
  const q = query.trim()
  if (!q) return 0
  const qUpper = q.toUpperCase()
  const code = item.symbol.split('.')[0]?.toUpperCase() ?? ''
  const sym = item.symbol.toUpperCase()
  let score = 0
  if (code === qUpper || sym === qUpper) score = Math.max(score, 1000)
  if (item.name === q) score = Math.max(score, 950)
  if (code.startsWith(qUpper) || sym.startsWith(qUpper)) score = Math.max(score, 800)
  if (item.name.startsWith(q)) score = Math.max(score, 750)
  if (item.name.includes(q)) score = Math.max(score, 600)
  if (code.includes(qUpper)) score = Math.max(score, 500)
  if (/[\u4e00-\u9fff]/.test(q) && fuzzySubsequenceMatch(q, item.name)) score = Math.max(score, 400)
  return score * 1000 - item.name.length
}

export function rankSymbolSuggestions(query: string, items: SymbolSuggestion[]): SymbolSuggestion[] {
  const q = query.trim()
  if (!q || items.length <= 1) return items
  return [...items].sort((a, b) => stockSearchScore(q, b) - stockSearchScore(q, a))
}

function fuzzySubsequenceMatch(query: string, target: string): boolean {
  if (!query || !target) return false
  const qRunes = [...query]
  let qi = 0
  for (const ch of target) {
    if (ch === qRunes[qi]) qi++
    if (qi >= qRunes.length) return true
  }
  return qi >= qRunes.length
}

export function matchHint(query: string, item: SymbolSuggestion): string {
  const q = query.trim()
  if (!q) return ''
  const qUpper = q.toUpperCase()
  const code = item.symbol.split('.')[0]?.toUpperCase() ?? ''
  if (code === qUpper || item.symbol.toUpperCase() === qUpper) return '精确'
  if (item.name === q) return '精确'
  if (code.startsWith(qUpper) || item.symbol.toUpperCase().startsWith(qUpper)) return '前缀'
  if (item.name.startsWith(q)) return '前缀'
  if (item.name.includes(q)) return '名称'
  if (/[\u4e00-\u9fff]/.test(q) && fuzzySubsequenceMatch(q, item.name)) return '模糊'
  return ''
}

export function symbolToBareCode(symbol: string): string {
  return symbol.split('.')[0]?.trim() ?? symbol.trim()
}
