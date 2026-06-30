import { useCallback, useEffect, useRef, useState } from 'react'
import { Command, Loader2, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { normalizeCnSymbol } from '@/lib/symbols'
import { resolveTradingSymbolInput, searchTradingStocks } from '@/lib/tradingApi'
import {
  applySearchInputChange,
  isLikelyStockCode,
  marketTagForSymbol,
  matchHint,
  normalizeSearchQuery,
  type SymbolSuggestion,
} from './symbolSearchUtils'

export type StockSymbolSearchProps = {
  value: string
  onChange: (symbol: string, name?: string) => void
  placeholder?: string
  className?: string
  /** 聚焦快捷键（默认 ⌘K / Ctrl+K） */
  enableShortcut?: boolean
}

export function StockSymbolSearch({
  value,
  onChange,
  placeholder = '搜索股票代码、名称…',
  className,
  enableShortcut = true,
}: StockSymbolSearchProps) {
  const [inputValue, setInputValue] = useState(value)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<SymbolSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const debounceRef = useRef<number | null>(null)
  const blurCloseRef = useRef<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => setInputValue(value), [value])

  useEffect(() => {
    if (!enableShortcut) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setPickerOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enableShortcut])

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    const q = inputValue.trim()
    if (!q) {
      setLoading(false)
      setSuggestions([])
      return undefined
    }

    setLoading(true)
    debounceRef.current = window.setTimeout(async () => {
      try {
        const kw = q.replace(/\.[A-Z]+$/i, '')
        const response = await searchTradingStocks(kw)
        setSuggestions(response.results.slice(0, 12))
      } catch {
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    }, 260)

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [inputValue])

  useEffect(() => {
    setHighlight((h) => Math.min(h, Math.max(0, suggestions.length - 1)))
  }, [suggestions])

  useEffect(
    () => () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
      if (blurCloseRef.current) window.clearTimeout(blurCloseRef.current)
    },
    [],
  )

  const applySuggestion = useCallback(
    (item: SymbolSuggestion) => {
      const sym = normalizeCnSymbol(item.symbol) || item.symbol.trim().toUpperCase()
      setInputValue(sym)
      onChange(sym, item.name)
      setPickerOpen(false)
    },
    [onChange],
  )

  const commitRaw = useCallback(async () => {
    const raw = inputValue.trim()
    if (!raw) return

    if (isLikelyStockCode(raw)) {
      const sym = normalizeCnSymbol(raw) || raw.toUpperCase()
      setInputValue(sym)
      onChange(sym)
      setPickerOpen(false)
      return
    }

    const resolved = await resolveTradingSymbolInput(raw, suggestions, highlight)
    if (resolved) {
      setInputValue(resolved.symbol)
      onChange(resolved.symbol, resolved.name)
      setPickerOpen(false)
    }
  }, [highlight, inputValue, onChange, suggestions])

  return (
    <div className={cn('relative z-10 flex-1 min-w-0', className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          ref={inputRef}
          value={inputValue}
          autoComplete="off"
          onChange={(e) => {
            setInputValue(applySearchInputChange(e.target.value, e.nativeEvent.isComposing))
            setPickerOpen(true)
          }}
          onCompositionEnd={(e) => {
            setInputValue(normalizeSearchQuery(e.currentTarget.value))
          }}
          onFocus={() => {
            if (blurCloseRef.current) window.clearTimeout(blurCloseRef.current)
            setPickerOpen(true)
          }}
          onBlur={() => {
            blurCloseRef.current = window.setTimeout(() => setPickerOpen(false), 160)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setPickerOpen(false)
              return
            }
            if (e.key === 'ArrowDown') {
              if (!pickerOpen) setPickerOpen(true)
              e.preventDefault()
              setHighlight((i) => Math.min(i + 1, Math.max(0, suggestions.length - 1)))
              return
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setHighlight((i) => Math.max(i - 1, 0))
              return
            }
            if (e.key === 'Enter') {
              e.preventDefault()
              if (pickerOpen && suggestions[highlight]) {
                applySuggestion(suggestions[highlight])
                return
              }
              void commitRaw()
            }
          }}
          className={cn(
            'h-10 rounded-full border-slate-200 bg-white pl-9 pr-16 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900',
            pickerOpen && 'ring-2 ring-blue-500/30 dark:ring-blue-400/25',
          )}
          placeholder={placeholder}
        />
        {enableShortcut ? (
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 dark:border-slate-700 dark:bg-slate-800 sm:flex">
            <Command size={10} />
            K
          </kbd>
        ) : null}
      </div>

      {pickerOpen && (loading || suggestions.length > 0 || inputValue.trim().length > 0) ? (
        <div
          className="absolute left-0 right-0 top-full z-[100] mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-950"
          role="listbox"
        >
          {loading ? (
            <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-xs text-slate-500 dark:border-slate-800">
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
              正在匹配标的…
            </div>
          ) : null}
          {!loading && !suggestions.length && inputValue.trim() ? (
            <div className="px-3 py-3 text-xs leading-relaxed text-slate-500">
              暂无匹配项，可继续输入或按 Enter 尝试解析名称
            </div>
          ) : null}
          {suggestions.map((item, idx) => {
            const hint = matchHint(inputValue, item)
            return (
              <button
                key={`${item.symbol}-${idx}`}
                type="button"
                role="option"
                aria-selected={idx === highlight}
                onMouseDown={(ev) => ev.preventDefault()}
                onMouseEnter={() => setHighlight(idx)}
                onClick={() => applySuggestion(item)}
                className={cn(
                  'flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-left transition-colors last:border-b-0 dark:border-slate-800/80',
                  idx === highlight
                    ? 'bg-blue-50 dark:bg-slate-800/90'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-900/80',
                )}
              >
                <span className="shrink-0 rounded-md bg-rose-600 px-1.5 py-px text-[10px] font-medium text-white dark:bg-rose-500">
                  {marketTagForSymbol(item.symbol)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">{item.name}</div>
                  <div className="mt-0.5 font-mono text-[11px] text-slate-500">{item.symbol}</div>
                </div>
                {hint ? (
                  <span className="shrink-0 text-[11px] font-medium text-violet-600 dark:text-violet-400">{hint}</span>
                ) : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
