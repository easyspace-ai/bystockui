export type SymbolSuggestion = { symbol: string; name: string }

export function marketTagForSymbol(symbol: string): string {
  const s = symbol.toUpperCase()
  if (s.endsWith('.HK')) return '港股'
  if (s.endsWith('.SH') || s.endsWith('.SZ') || s.endsWith('.BJ')) return 'A股'
  if (/\.(US|O|N)$/i.test(s) || /^[A-Z]{1,5}$/.test(s)) return '美股'
  return '标的'
}

export function matchHint(query: string, item: SymbolSuggestion): string {
  const q = query.trim().toUpperCase()
  if (!q) return ''
  const code = item.symbol.split('.')[0]?.toUpperCase() ?? ''
  if (code.startsWith(q) || item.symbol.toUpperCase().startsWith(q)) return '前缀'
  if (item.name.includes(query.trim())) return '名称'
  return ''
}

export function symbolToBareCode(symbol: string): string {
  return symbol.split('.')[0]?.trim() ?? symbol.trim()
}
