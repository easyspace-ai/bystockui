import { cn } from '@/lib/utils'

/** 与市场页 Workbench 列头一致 */
export const DAILY_WORKBENCH_COLUMN_HEADER =
  'flex min-h-10 items-center border-b border-slate-200 bg-white px-3 py-1 dark:border-slate-800 dark:bg-slate-950'

/** A 股常见配色：涨红跌绿（与 MarketRouteLayout toneByNumber 一致） */
export function toneByChangePct(value?: number | null): string {
  if ((value ?? 0) > 0) return 'text-rose-500 dark:text-rose-400'
  if ((value ?? 0) < 0) return 'text-emerald-600 dark:text-emerald-400'
  return 'text-slate-500 dark:text-slate-400'
}

export function cnActiveListItem(active: boolean): string {
  return cn(
    'flex w-full flex-col border-b border-slate-100 px-3 py-2.5 text-left transition-colors dark:border-slate-800/80',
    active
      ? 'border-l-2 border-l-blue-600 bg-blue-50/80 pl-[10px] dark:border-l-blue-500 dark:bg-blue-950/40'
      : 'border-l-2 border-l-transparent hover:bg-slate-50 dark:hover:bg-slate-900/50',
  )
}
