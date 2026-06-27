import { marked } from 'marked'
import { REPORT_DISCLAIMER, REPORT_SECTIONS } from '@/features/analysis/config/reportSections'
import type { AnalysisReport } from '@/features/analysis/tradingAgents/types'
import { sanitizeReportMarkdown } from '@/features/analysis/tradingAgents/reportText'

export function buildAnalysisHtmlReport(
  report: AnalysisReport,
  meta: { symbol: string; stockName?: string; confidence?: number | null },
): string {
  const title = `${meta.stockName || meta.symbol} · AI 分析报告`
  const signal = report.decision || report.direction || '—'
  const sections = REPORT_SECTIONS.map((s) => {
    const raw = report[s.key as keyof AnalysisReport]
    const body = typeof raw === 'string' ? sanitizeReportMarkdown(raw) : ''
    if (!body.trim()) return ''
    const html = marked.parse(body, { async: false }) as string
    return `<section id="${s.key}" class="section"><h2>${s.title}</h2><p class="team">${s.team}</p>${html}</section>`
  })
    .filter(Boolean)
    .join('\n')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(title)}</title>
<style>
  body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.65;color:#0f172a;background:#f8fafc;margin:0;padding:24px}
  .hero{background:linear-gradient(135deg,#0f172a,#312e81);color:#e2e8f0;border-radius:16px;padding:32px 24px;text-align:center;margin-bottom:24px}
  .hero h1{margin:0 0 8px;font-size:28px}
  .signal{font-size:48px;font-weight:900;color:#fbbf24;margin:12px 0}
  .meta{font-size:14px;color:#94a3b8}
  .section{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;margin-bottom:16px}
  .section h2{margin:0 0 4px;font-size:18px}
  .team{margin:0 0 12px;font-size:12px;color:#64748b}
  table{border-collapse:collapse;width:100%;margin:12px 0}
  th,td{border:1px solid #cbd5e1;padding:8px;text-align:left;font-size:13px}
  th{background:#f1f5f9}
  .disclaimer{font-size:12px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px;margin-top:24px}
</style>
</head>
<body>
<header class="hero">
  <div class="meta">TRADING AGENTS · ${escapeHtml(meta.symbol)}</div>
  <div class="signal">${escapeHtml(String(signal))}</div>
  <h1>${escapeHtml(title)}</h1>
  ${meta.confidence != null ? `<p class="meta">置信度 ${Math.round(meta.confidence)}%</p>` : ''}
  ${report.trade_date ? `<p class="meta">报告日期 ${escapeHtml(String(report.trade_date).slice(0, 10))}</p>` : ''}
</header>
${sections}
<footer class="disclaimer">${escapeHtml(REPORT_DISCLAIMER.replace(/^>\s*/, ''))}</footer>
</body>
</html>`
}

export function downloadAnalysisHtmlReport(
  report: AnalysisReport,
  meta: { symbol: string; stockName?: string; confidence?: number | null },
): void {
  const html = buildAnalysisHtmlReport(report, meta)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `analysis-${meta.symbol.replace(/\./g, '-')}.html`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
