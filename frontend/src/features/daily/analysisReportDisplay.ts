import { marked } from 'marked'

/**
 * Pre-render transforms for "AI 机会诊断" style markdown: replaces text progress
 * bars and dense bullet blocks with compact HTML cards (parsed as HTML by marked).
 */
/** Tailwind classes for the AI 机会诊断 HTML shell (used with dangerouslySetInnerHTML). */
export const ANALYSIS_REPORT_BODY_CLASSNAME =
  'analysis-report-body text-[13px] leading-relaxed text-gray-700 dark:text-gray-300 ' +
  '[&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-gray-900 [&_h1]:dark:text-gray-50 [&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:first:mt-0 ' +
  '[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-gray-900 [&_h2]:dark:text-gray-50 [&_h2]:mt-5 [&_h2]:mb-2.5 [&_h2]:pb-2 [&_h2]:border-b [&_h2]:border-gray-200 [&_h2]:dark:border-gray-800 ' +
  '[&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-gray-900 [&_h3]:dark:text-gray-50 [&_h3]:mt-4 [&_h3]:mb-2 ' +
  '[&_h4]:text-sm [&_h4]:font-semibold [&_h4]:text-gray-800 [&_h4]:dark:text-gray-100 [&_h4]:mt-3 [&_h4]:mb-1.5 ' +
  '[&_p]:my-2 [&_p]:text-gray-600 [&_p]:dark:text-gray-300 ' +
  '[&_ul]:my-2.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2.5 [&_ol]:list-decimal [&_ol]:pl-5 ' +
  '[&_li]:my-1 ' +
  '[&_strong]:font-semibold [&_strong]:text-gray-900 [&_strong]:dark:text-gray-100 ' +
  '[&_hr]:my-4 [&_hr]:border-gray-200 [&_hr]:dark:border-gray-700 ' +
  '[&_blockquote]:border-l-4 [&_blockquote]:border-blue-300 [&_blockquote]:dark:border-blue-500/40 [&_blockquote]:pl-3 [&_blockquote]:my-3 [&_blockquote]:text-gray-600 [&_blockquote]:dark:text-gray-400 ' +
  '[&_a]:text-blue-600 [&_a]:underline [&_a]:underline-offset-2 [&_a]:dark:text-blue-400 ' +
  '[&_code]:rounded [&_code]:bg-gray-100 [&_code]:dark:bg-gray-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12px] [&_code]:font-mono ' +
  '[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-gray-200 [&_pre]:dark:border-gray-700 [&_pre]:bg-gray-50 [&_pre]:dark:bg-gray-900/60 [&_pre]:p-3 ' +
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0 ' +
  '[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_table]:text-[12px] ' +
  '[&_th]:border [&_th]:border-gray-200 [&_th]:dark:border-gray-700 [&_th]:bg-gray-50 [&_th]:dark:bg-gray-800/50 [&_th]:px-2.5 [&_th]:py-2 [&_th]:font-semibold ' +
  '[&_td]:border [&_td]:border-gray-200 [&_td]:dark:border-gray-700 [&_td]:px-2.5 [&_td]:py-2'

export function refineOpportunityReportMarkdown(md: string): string {
  let s = md
  s = replaceStrategyCallout(s)
  s = replaceEtfOperationCallout(s)
  s = replaceScoreLines(s)
  s = wrapScoreSection(s)
  s = replaceKeySignals(s)
  s = replaceIntradaySection(s)
  return s
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fillToneClass(pct: number): string {
  if (pct >= 85) return 'from-emerald-500 to-teal-500'
  if (pct >= 65) return 'from-blue-500 to-indigo-500'
  if (pct >= 45) return 'from-amber-500 to-orange-500'
  return 'from-gray-400 to-gray-500 dark:from-gray-500 dark:to-gray-600'
}

/** `**💡 策略建议：…**` (stocks) */
function replaceStrategyCallout(md: string): string {
  return md.replace(/\*\*💡\s*策略建议[：:](.+?)\*\*/gs, (_, inner: string) => {
    const html = marked.parseInline(inner.trim()) as string
    return `<div class="not-prose my-4 rounded-xl border border-blue-200 bg-blue-50/80 px-4 py-3 text-sm dark:border-blue-800/50 dark:bg-blue-900/20">
  <div class="flex items-start gap-3">
    <span class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400" aria-hidden="true">💡</span>
    <div class="min-w-0 flex-1">
      <div class="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">策略建议</div>
      <div class="mt-1.5 text-[13px] leading-relaxed text-gray-800 dark:text-gray-200 [&_strong]:font-semibold [&_strong]:text-gray-900 dark:[&_strong]:text-white">${html}</div>
    </div>
  </div>
</div>`
  })
}

/** `**💡 操作建议：…**` (ETF template) */
function replaceEtfOperationCallout(md: string): string {
  return md.replace(/\*\*💡\s*操作建议[：:](.+?)\*\*/gs, (_, inner: string) => {
    const html = marked.parseInline(inner.trim()) as string
    return `<div class="not-prose my-4 rounded-xl border border-cyan-200 bg-cyan-50/80 px-4 py-3 text-sm dark:border-cyan-800/50 dark:bg-cyan-900/20">
  <div class="flex items-start gap-3">
    <span class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-100 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400" aria-hidden="true">💡</span>
    <div class="min-w-0 flex-1">
      <div class="text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">操作建议</div>
      <div class="mt-1.5 text-[13px] leading-relaxed text-gray-800 dark:text-gray-200 [&_strong]:font-semibold [&_strong]:text-gray-900 dark:[&_strong]:text-white">${html}</div>
    </div>
  </div>
</div>`
  })
}

const SCORE_BACKTICK =
  /^- \s*(.+?)[：:]`([▮▯█░\s]+)`\s*(\d+)\s*\/\s*(\d+)\s*$/gm
/** ETF 等板块用方括号进度条：`- 趋势：[████] 3/10分` */
const SCORE_BRACKET =
  /^- \s*(.+?)[：:]\[([▮▯█░\s]+)\]\s*(\d+)\s*\/\s*(\d+)分?\s*$/gm

function scoreRowHtml(label: string, got: string, total: string): string {
  const g = parseInt(got, 10)
  const t = parseInt(total, 10)
  const pct = t > 0 ? Math.min(100, Math.max(0, Math.round((g / t) * 100))) : 0
  const tone = fillToneClass(pct)
  const safeLabel = escapeHtml(String(label).trim())
  const denom = t > 0 ? `${g}/${t}` : `${g}/—`
  return `<div class="mb-3 last:mb-0">
    <div class="mb-1.5 flex items-baseline justify-between gap-2 text-[13px]">
      <span class="font-medium text-gray-700 dark:text-gray-200">${safeLabel}</span>
      <span class="shrink-0 font-mono text-xs tabular-nums text-gray-500 dark:text-gray-400">${denom}</span>
    </div>
    <div class="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
      <div class="h-full rounded-full bg-gradient-to-r ${tone} transition-[width] duration-500 ease-out" style="width:${pct}%"></div>
    </div>
  </div>`
}

function replaceScoreLines(md: string): string {
  let s = md.replace(SCORE_BACKTICK, (_f, label: string, _b: string, got: string, total: string) =>
    scoreRowHtml(label, got, total),
  )
  s = s.replace(SCORE_BRACKET, (_f, label: string, _b: string, got: string, total: string) =>
    scoreRowHtml(label, got, total),
  )
  return s
}

/** Merge `**评分明细**` heading with following generated score rows into one card */
function wrapScoreSection(md: string): string {
  const blockRe =
    /\*\*(?:📊\s*)?评分明细[：:]\*\*\s*\n+((?:<div class="[^"]*mb-3[\s\S]*?<\/div>\s*\n*)+)/g
  return md.replace(
    blockRe,
    (_, rows: string) => `<div class="not-prose my-5 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/40">
  <div class="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
    <span class="inline-block h-px w-4 rounded-full bg-blue-500"></span>评分明细
  </div>
  <div class="space-y-0">${rows.trim()}</div>
</div>\n\n`,
  )
}

function replaceKeySignals(md: string): string {
  const re = /\*\*📈\s*核心技术信号[^*]*\*\*\s*\n((?:- .+(?:\n|$))+)/gm
  return md.replace(re, (full, lines: string) => {
    const items: string[] = []
    for (const line of lines.trim().split('\n')) {
      const m = line.match(/^- \*\*([^*]+)\*\*[：:]\s*(.*)$/)
      if (!m) continue
      const label = escapeHtml(m[1].trim())
      const rawVal = m[2].trim()
      const valueHtml = marked.parseInline(rawVal) as string
      items.push(`<div class="rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800/50">
  <dt class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">${label}</dt>
  <dd class="mt-1 text-[13px] leading-snug text-gray-800 dark:text-gray-200 [&_strong]:font-semibold [&_strong]:text-gray-900 dark:[&_strong]:text-white">${valueHtml}</dd>
</div>`)
    }
    if (!items.length) return full
    return `<div class="not-prose my-5 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/40">
  <div class="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
    <span class="inline-block h-px w-4 rounded-full bg-emerald-500"></span>核心技术信号
  </div>
  <dl class="grid gap-2.5">${items.join('')}</dl>
</div>\n\n`
  })
}

function splitIntradayLabelValue(content: string): { left: string; right: string } | null {
  const cn = content.indexOf('：')
  if (cn !== -1) {
    return { left: content.slice(0, cn).trim(), right: content.slice(cn + 1).trim() }
  }
  const parenColon = content.match(/^(.+\))\s*:\s*(.+)$/)
  if (parenColon) {
    return { left: parenColon[1]!.trim(), right: parenColon[2]!.trim() }
  }
  const spaced = content.indexOf(': ')
  if (spaced !== -1) {
    return { left: content.slice(0, spaced).trim(), right: content.slice(spaced + 2).trim() }
  }
  const tight = content.indexOf(':')
  if (tight !== -1) {
    return { left: content.slice(0, tight).trim(), right: content.slice(tight + 1).trim() }
  }
  return null
}

function replaceIntradaySection(md: string): string {
  const re = /\*\*日内分时特征\*\*\s*\n((?:- .+(?:\n|$))+)/gm
  return md.replace(re, (full, lines: string) => {
    const rows: string[] = []
    for (const line of lines.trim().split('\n')) {
      if (!line.startsWith('- ')) continue
      const content = line.slice(2).trim()
      const parts = splitIntradayLabelValue(content)
      if (!parts) {
        rows.push(`<div class="text-[13px] text-gray-700 dark:text-gray-300">${escapeHtml(content)}</div>`)
        continue
      }
      const left = escapeHtml(parts.left)
      const rightRaw = parts.right
      const rightHtml = marked.parseInline(rightRaw) as string
      rows.push(`<div class="flex flex-col gap-0.5 border-b border-gray-100 py-2.5 last:border-0 dark:border-gray-800 sm:grid sm:grid-cols-[minmax(0,9rem)_1fr] sm:items-start sm:gap-4">
  <span class="shrink-0 text-[12px] font-medium text-gray-500 dark:text-gray-400">${left}</span>
  <span class="min-w-0 text-[13px] leading-snug text-gray-800 dark:text-gray-200">${rightHtml}</span>
</div>`)
    }
    if (!rows.length) return full
    return `<div class="not-prose my-5 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/40">
  <div class="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
    <span class="inline-block h-px w-4 rounded-full bg-amber-500"></span>日内分时特征
  </div>
  <div>${rows.join('')}</div>
</div>\n\n`
  })
}
