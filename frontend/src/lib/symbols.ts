export function normalizeCnSymbol(raw: string): string {
  const value = raw.trim().toUpperCase()
  if (!value) return ''

  const prefixedMatch = /^(SH|SZ|BJ|SS)(\d{6})$/.exec(value)
  if (prefixedMatch) {
    const [, prefix, code] = prefixedMatch
    return `${code}.${prefix === 'SS' ? 'SH' : prefix}`
  }

  const match = /(\d{6})(?:\.(SH|SZ|BJ|SS))?/.exec(value)
  if (match) {
    const [, code, suffix] = match
    if (suffix) {
      return `${code}.${suffix === 'SS' ? 'SH' : suffix}`
    }
    if (/^[569]/.test(code)) return `${code}.SH`
    if (/^[03]/.test(code)) return `${code}.SZ`
    if (/^8/.test(code)) return `${code}.BJ`
    return code
  }

  return value
}

export function extractCnSymbol(text: string): string | null {
  const value = text.trim().toUpperCase()
  if (!value) return null

  const explicit = /\b(?:SH|SZ|BJ|SS)?\d{6}(?:\.(?:SH|SZ|BJ|SS))?\b/i.exec(value)
  if (!explicit) return null

  const normalized = normalizeCnSymbol(explicit[0])
  return normalized || null
}
