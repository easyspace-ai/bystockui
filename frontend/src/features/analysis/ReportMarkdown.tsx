import { useMemo } from 'react'
import { marked } from 'marked'
import { cn } from '@/lib/utils'

marked.setOptions({ gfm: true, breaks: true })

const mdWrap = cn(
  'report-markdown text-[13px] leading-relaxed text-slate-700 dark:text-slate-300',
  '[&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-slate-900 [&_h1]:dark:text-slate-50 [&_h1]:mt-5 [&_h1]:mb-2 [&_h1]:first:mt-0',
  '[&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-slate-900 [&_h2]:dark:text-slate-50 [&_h2]:mt-4 [&_h2]:mb-2',
  '[&_h3]:text-[15px] [&_h3]:font-semibold [&_h3]:text-slate-900 [&_h3]:dark:text-slate-50 [&_h3]:mt-3 [&_h3]:mb-1.5',
  '[&_h4]:text-sm [&_h4]:font-semibold [&_h4]:text-slate-800 [&_h4]:dark:text-slate-100 [&_h4]:mt-2 [&_h4]:mb-1',
  '[&_p]:my-2 [&_p]:text-slate-600 dark:[&_p]:text-slate-300',
  '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5',
  '[&_li]:my-1',
  '[&_strong]:font-semibold [&_strong]:text-slate-900 dark:[&_strong]:text-slate-100',
  '[&_hr]:my-4 [&_hr]:border-slate-200 dark:[&_hr]:border-slate-700',
  '[&_blockquote]:border-l-4 [&_blockquote]:border-blue-300 dark:[&_blockquote]:border-blue-500/40 [&_blockquote]:pl-3 [&_blockquote]:my-3 [&_blockquote]:text-slate-600 dark:[&_blockquote]:text-slate-400',
  '[&_a]:text-blue-600 [&_a]:underline [&_a]:underline-offset-2 dark:[&_a]:text-blue-400',
  '[&_code]:rounded [&_code]:bg-slate-100 dark:[&_code]:bg-slate-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12px] [&_code]:font-mono',
  '[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-slate-200 dark:[&_pre]:border-slate-700 [&_pre]:bg-slate-50 dark:[&_pre]:bg-slate-900/60 [&_pre]:p-3',
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
  '[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_table]:text-[12px]',
  '[&_th]:border [&_th]:border-slate-200 dark:[&_th]:border-slate-700 [&_th]:bg-slate-50 dark:[&_th]:bg-slate-800/50 [&_th]:px-2 [&_th]:py-1.5 [&_th]:font-semibold',
  '[&_td]:border [&_td]:border-slate-200 dark:[&_td]:border-slate-700 [&_td]:px-2 [&_td]:py-1.5',
)

export function ReportMarkdown({ text, className }: { text: string; className?: string }) {
  const html = useMemo(() => {
    const raw = text || ''
    try {
      return marked.parse(raw) as string
    } catch {
      const esc = raw
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
      return `<p class="whitespace-pre-wrap">${esc}</p>`
    }
  }, [text])

  return <div className={cn(mdWrap, className)} dangerouslySetInnerHTML={{ __html: html }} />
}
