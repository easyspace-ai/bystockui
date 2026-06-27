import { useCallback, useEffect, useState } from 'react'
import { Database, Loader2, RefreshCw, Settings2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  getStockBasicSyncStatus,
  syncStockBasic,
  type StockBasicSyncResult,
  type StockBasicSyncStatus,
} from '@/lib/marketApi'

type WorkbenchSettingsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function WorkbenchSettingsDialog({ open, onOpenChange }: WorkbenchSettingsDialogProps) {
  const [status, setStatus] = useState<StockBasicSyncStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [syncSource, setSyncSource] = useState<'auto' | 'eastmoney' | 'tushare'>('auto')
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<StockBasicSyncResult | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)

  const loadStatus = useCallback(async () => {
    setStatusLoading(true)
    try {
      const data = await getStockBasicSyncStatus()
      setStatus(data)
    } catch (e) {
      setStatus(null)
      setSyncError(e instanceof Error ? e.message : '读取同步状态失败')
    } finally {
      setStatusLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setSyncResult(null)
    setSyncError(null)
    void loadStatus()
  }, [open, loadStatus])

  const handleSync = async () => {
    setSyncing(true)
    setSyncError(null)
    setSyncResult(null)
    try {
      const result = await syncStockBasic(syncSource)
      setSyncResult(result)
      await loadStatus()
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : '同步失败')
    } finally {
      setSyncing(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange(false)} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="workbench-settings-title"
        className="relative z-[201] w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-950"
      >
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800">
            <Settings2 className="h-5 w-5 text-gray-600 dark:text-gray-300" />
          </div>
          <div>
            <h2 id="workbench-settings-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">
              工作台设置
            </h2>
            <p className="text-xs text-gray-500">数据维护与同步</p>
          </div>
        </div>

        <section className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-800 dark:bg-gray-900/50">
          <div className="mb-3 flex items-center gap-2">
            <Database className="h-4 w-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">股票基础信息同步</h3>
          </div>
          <p className="mb-4 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            将 A 股代码、名称、市场等写入 <code className="rounded bg-white px-1 py-0.5 dark:bg-gray-800">stock.db / stock_info</code>。
            同步后搜索联想、基本数据中的行业字段（Tushare）会生效。东财同步约需 1–2 分钟。
          </p>

          <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-white px-3 py-2 dark:bg-gray-950">
              <div className="text-gray-400">当前记录数</div>
              <div className="mt-0.5 font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                {statusLoading ? '…' : (status?.count ?? '--')}
              </div>
            </div>
            <div className="rounded-lg bg-white px-3 py-2 dark:bg-gray-950">
              <div className="text-gray-400">上次更新</div>
              <div className="mt-0.5 font-medium text-gray-900 dark:text-gray-100">
                {status?.lastUpdatedAt
                  ? new Date(status.lastUpdatedAt).toLocaleString('zh-CN')
                  : '从未同步'}
              </div>
            </div>
          </div>

          {status?.dataPath ? (
            <p className="mb-4 truncate text-[10px] text-gray-400" title={status.dataPath}>
              数据目录：{status.dataPath}
            </p>
          ) : null}

          <div className="mb-4 flex flex-wrap gap-2">
            {(
              [
                { id: 'auto', label: '自动（推荐）' },
                { id: 'eastmoney', label: '东财行情' },
                { id: 'tushare', label: 'Tushare（含行业）' },
              ] as const
            ).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSyncSource(id)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  syncSource === id
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {syncError ? (
            <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
              {syncError}
            </div>
          ) : null}

          {syncResult ? (
            <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
              {syncResult.message}
              <span className="mt-1 block text-[10px] opacity-80">
                {syncResult.total} 条 · {syncResult.duration}
              </span>
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={syncing}
              onClick={() => void handleSync()}
              className="gap-1.5"
            >
              {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {syncing ? '同步中…' : '开始同步'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={syncing || statusLoading}
              onClick={() => void loadStatus()}
            >
              刷新状态
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
