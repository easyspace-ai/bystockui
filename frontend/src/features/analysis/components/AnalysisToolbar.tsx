import { BarChart3, Loader2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StockSymbolSearch } from './StockSymbolSearch'

export type AnalysisViewMode = 'basic' | 'ai'

export type AnalysisToolbarProps = {
  symbol: string
  stockName?: string
  viewMode: AnalysisViewMode
  onSymbolChange: (symbol: string, name?: string) => void
  onViewModeChange: (mode: AnalysisViewMode) => void
  onAiAnalyze: () => void
  analysisRunning?: boolean
}

export function AnalysisToolbar({
  symbol,
  viewMode,
  onSymbolChange,
  onViewModeChange,
  onAiAnalyze,
  analysisRunning = false,
}: AnalysisToolbarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <StockSymbolSearch value={symbol} onChange={onSymbolChange} />

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => onViewModeChange('basic')}
          className={cn(
            'inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-all',
            viewMode === 'basic'
              ? 'bg-slate-900 text-white shadow-md dark:bg-white dark:text-slate-900'
              : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
          )}
        >
          <BarChart3 className="h-4 w-4" />
          基本数据
        </button>

        <button
          type="button"
          onClick={() => {
            onViewModeChange('ai')
            if (!analysisRunning) onAiAnalyze()
          }}
          className={cn(
            'inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-all',
            viewMode === 'ai'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20'
              : 'border border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-300 hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300',
            analysisRunning && viewMode !== 'ai' && 'ring-2 ring-blue-400/50 ring-offset-1',
          )}
        >
          {analysisRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {analysisRunning ? (viewMode === 'ai' ? '分析中…' : '查看工作流') : 'AI 分析'}
        </button>
      </div>
    </div>
  )
}
