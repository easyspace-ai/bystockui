import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { FileText, X } from 'lucide-react'
import type { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { REPORT_SECTIONS } from '@/features/analysis/config/reportSections'
import { sanitizeReportMarkdown } from '@/features/analysis/tradingAgents/reportText'
import { useAnalysisStore } from '@/features/analysis/tradingAgents/analysisStore'

type ReportSectionSheetProps = {
  sectionKey?: string
  onClose: () => void
}

const MD_COMPONENTS = {
  table: ({ children }: { children?: ReactNode }) => (
    <table className="my-4 w-full border-collapse border border-slate-300 dark:border-slate-600">{children}</table>
  ),
  thead: ({ children }: { children?: ReactNode }) => (
    <thead className="bg-slate-100 dark:bg-slate-700">{children}</thead>
  ),
  th: ({ children }: { children?: ReactNode }) => (
    <th className="border border-slate-300 px-3 py-2 text-left font-semibold dark:border-slate-600">{children}</th>
  ),
  td: ({ children }: { children?: ReactNode }) => (
    <td className="border border-slate-300 px-3 py-2 dark:border-slate-600">{children}</td>
  ),
}

export function ReportSectionSheet({ sectionKey, onClose }: ReportSectionSheetProps) {
  const { report, streamingSections } = useAnalysisStore()

  useEffect(() => {
    if (!sectionKey) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [sectionKey, onClose])

  if (!sectionKey) return null

  const meta = REPORT_SECTIONS.find((s) => s.key === sectionKey)
  const stream = streamingSections[sectionKey]
  const stored = report?.[sectionKey as keyof typeof report] as string | undefined
  const content = sanitizeReportMarkdown(stream?.displayed || stored || '')

  if (!meta) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-section-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="关闭"
      />
      <div className="relative z-[201] flex max-h-[min(85vh,900px)] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950 sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-500" />
            <div>
              <h3 id="report-section-title" className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {meta.title}
              </h3>
              <p className="text-[11px] text-slate-500">{meta.team}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {content ? (
            <div className="prose prose-sm max-w-none dark:prose-invert sm:prose-base">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
                {content}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">该章节暂无内容</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
