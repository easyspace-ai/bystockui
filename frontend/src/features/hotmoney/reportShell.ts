/** UZI-inspired dark Bloomberg report shell — wraps LLM fragment output. */

export const REPORT_NAV = [
  { id: "section-info", num: "01", label: "标的信息" },
  { id: "section-review", num: "02", label: "游资速评" },
  { id: "section-emotion", num: "03", label: "情绪周期" },
  { id: "section-fund", num: "04", label: "龙虎&资金" },
  { id: "section-fund-holders", num: "05", label: "机构持仓" },
  { id: "section-tech", num: "06", label: "技术走势" },
  { id: "section-experts", num: "07", label: "大佬观点" },
  { id: "section-radar", num: "08", label: "22维雷达" },
  { id: "section-action", num: "09", label: "操作建议" },
] as const;

const REPORT_CSS = `
:root {
  --bg-deep: #0f141b;
  --bg-card: #161b22;
  --bg-tinted: #1c2128;
  --bg-rail: #0a0e14;
  --border: #30363d;
  --neon-cyan: #22d3ee;
  --neon-gold: #facc15;
  --bull-green: #34d399;
  --bear-red: #f87171;
  --accent-blue: #60a5fa;
  --text-bright: #f0f6fc;
  --text-main: #c9d1d9;
  --text-mid: #8b949e;
  --text-dim: #6e7681;
  --bull-tint: rgba(52,211,153,.18);
  --bear-tint: rgba(248,113,113,.18);
  --gold-tint: rgba(250,204,21,.18);
  --cyan-tint: rgba(34,211,238,.18);
  --shadow-md: 0 4px 12px rgba(0,0,0,.5);
  --glass-bg: rgba(22,27,34,.92);
  --glass-border: rgba(240,246,252,.08);
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  background: var(--bg-deep);
  color: var(--text-main);
  font-family: -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 14px;
  line-height: 1.6;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}
body {
  background:
    radial-gradient(ellipse 80% 60% at 50% 0%, rgba(34,211,238,.06), transparent 60%),
    var(--bg-deep);
}
.container { max-width: 1200px; margin: 0 auto; padding: 24px 32px 64px 100px; }
.topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 18px; margin-bottom: 20px;
  background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px;
}
.topbar .brand { font-weight: 700; font-size: 14px; letter-spacing: .12em; color: var(--text-bright); }
.topbar .brand span { color: var(--neon-cyan); }
.topbar .status { font-size: 10px; color: var(--text-dim); letter-spacing: .08em; }
.toc-rail {
  position: fixed; left: 12px; top: 50%; transform: translateY(-50%);
  z-index: 50; display: flex; flex-direction: column; gap: 4px;
  padding: 10px 6px; background: var(--glass-bg);
  border: 1px solid var(--glass-border); border-radius: 10px;
  box-shadow: var(--shadow-md); max-height: 85vh; overflow-y: auto;
}
.toc-rail .toc-item {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 8px; font-size: 10px; letter-spacing: .06em;
  color: var(--text-dim); text-decoration: none; border-radius: 5px;
  border-left: 2px solid transparent; transition: all .15s; white-space: nowrap;
}
.toc-rail .toc-item:hover { color: var(--neon-cyan); background: var(--cyan-tint); }
.toc-rail .toc-num { font-weight: 700; font-size: 10px; opacity: .7; }
@media (max-width: 900px) { .toc-rail { display: none; } .container { padding-left: 24px; } }

.bento-hero {
  display: grid; grid-template-columns: 1.5fr 1fr; grid-template-rows: auto auto;
  gap: 14px; margin-bottom: 20px;
}
.bento {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: 14px; padding: 22px; position: relative; overflow: hidden;
}
.bento.name-card { grid-row: span 2; border-left: 3px solid var(--neon-cyan); }
.ticker-label { font-size: 10px; color: var(--neon-cyan); letter-spacing: .18em; margin-bottom: 8px; }
.stock-name { font-weight: 900; font-size: 42px; line-height: 1; color: var(--text-bright); margin-bottom: 6px; }
.stock-code { font-size: 13px; color: var(--text-dim); margin-bottom: 12px; font-family: ui-monospace, monospace; }
.concept-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
.concept-tag {
  font-size: 10px; padding: 3px 10px; border-radius: 999px;
  background: var(--cyan-tint); color: var(--neon-cyan); border: 1px solid rgba(34,211,238,.35);
}
.price-row { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; margin-bottom: 14px; }
.price { font-family: ui-monospace, monospace; font-size: 36px; font-weight: 700; color: var(--text-bright); }
.change { font-family: ui-monospace, monospace; font-size: 16px; font-weight: 600; padding: 4px 10px; border-radius: 6px; }
.change.up { color: var(--bull-green); background: var(--bull-tint); border: 1px solid var(--bull-green); }
.change.down { color: var(--bear-red); background: var(--bear-tint); border: 1px solid var(--bear-red); }
.metric-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip {
  font-size: 10px; padding: 5px 10px; border: 1px solid var(--border);
  border-radius: 16px; color: var(--text-mid); background: var(--bg-tinted);
  font-family: ui-monospace, monospace;
}
.chip strong { color: var(--text-bright); margin-right: 4px; }

.bento.score-card {
  border: 2px solid var(--neon-gold); display: flex; flex-direction: column;
  justify-content: center; align-items: center; min-height: 140px; text-align: center;
}
.score-label { font-size: 9px; letter-spacing: .2em; color: var(--neon-gold); font-weight: 700; margin-bottom: 4px; }
.score-giant { font-weight: 900; font-size: 72px; line-height: 1; color: var(--neon-gold); }
.score-verdict { font-size: 13px; font-weight: 600; color: var(--text-bright); margin-top: 6px; padding-top: 8px; border-top: 1px solid var(--gold-tint); }

.bento.signal-card { display: flex; align-items: center; gap: 12px; padding: 16px 18px; }
.signal-badge {
  font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 6px;
  background: var(--gold-tint); color: var(--neon-gold); border: 1px solid var(--neon-gold);
  letter-spacing: .08em;
}
.signal-desc { font-size: 12px; color: var(--text-mid); }

.section-head {
  display: flex; align-items: center; gap: 12px; margin: 36px 0 14px;
}
.section-tag {
  font-size: 10px; font-weight: 600; color: var(--neon-cyan); letter-spacing: .15em;
  padding: 4px 10px; border: 1px solid var(--neon-cyan); border-radius: 4px;
}
.section-title { font-weight: 800; font-size: 22px; color: var(--text-bright); }
.section-line { flex: 1; height: 1px; background: linear-gradient(90deg, var(--neon-cyan), transparent); }

.section-body {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: 12px; padding: 20px 22px; line-height: 1.75;
}
.section-body p { margin-bottom: 10px; }
.section-body p:last-child { margin-bottom: 0; }

.dim-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; }
.dim-card {
  background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 14px;
}
.dim-title { font-weight: 700; font-size: 13px; color: var(--text-bright); margin-bottom: 6px; }
.dim-score { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.dim-score .num { font-weight: 900; font-size: 22px; }
.dim-score .num.high { color: var(--bull-green); }
.dim-score .num.mid { color: var(--neon-gold); }
.dim-score .num.low { color: var(--bear-red); }
.dim-bar { height: 5px; background: var(--bg-rail); border-radius: 3px; overflow: hidden; }
.dim-bar .fill { height: 100%; }
.dim-bar .fill.high { background: var(--bull-green); }
.dim-bar .fill.mid { background: var(--neon-gold); }
.dim-bar .fill.low { background: var(--bear-red); }

.expert-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
.expert-card {
  background: var(--bg-tinted); border: 1px solid var(--border); border-radius: 10px; padding: 14px;
  border-left: 3px solid var(--accent-blue);
}
.expert-name { font-weight: 700; color: var(--text-bright); font-size: 14px; }
.expert-style { font-size: 10px; color: var(--neon-gold); letter-spacing: .1em; margin: 4px 0 8px; }
.expert-quote { font-size: 13px; color: var(--text-main); line-height: 1.6; }

.battle-plan {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px;
  background: var(--gold-tint); border: 1px solid var(--neon-gold); border-radius: 10px; padding: 16px 18px;
}
.plan-field .k { font-size: 9px; color: var(--text-dim); letter-spacing: .12em; display: block; margin-bottom: 2px; }
.plan-field .v { font-family: ui-monospace, monospace; font-size: 14px; color: var(--text-bright); font-weight: 600; }

.disclaimer {
  margin-top: 32px; padding: 14px; font-size: 11px; color: var(--text-dim);
  border-top: 1px solid var(--border); line-height: 1.6;
}

table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 8px 0; }
th, td { padding: 8px 10px; border: 1px solid var(--border); text-align: left; }
th { background: var(--bg-tinted); color: var(--neon-cyan); font-size: 10px; letter-spacing: .08em; }
`;

function buildNav(): string {
  return REPORT_NAV.map(
    (n) =>
      `<a href="#${n.id}" class="toc-item"><span class="toc-num">${n.num}</span>${n.label}</a>`,
  ).join("\n    ");
}

function buildShell(body: string): string {
  const ts = new Date().toISOString().slice(0, 16).replace("T", " ");
  return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>游资大佬看盘 · 分析报告</title>
<style>${REPORT_CSS}</style>
</head>
<body>
<div class="container">
  <div class="topbar">
    <div class="brand">游资大佬看盘 <span>· UZI STYLE</span></div>
    <div class="status">DATA @ ${ts}</div>
  </div>
  <nav class="toc-rail" aria-label="报告章节导航">
    ${buildNav()}
  </nav>
  <main id="report-body">
${body}
  </main>
</div>
</body>
</html>`;
}

/** True when HTML is a full UZI assemble_report output (66-persona pipeline). */
export function isUziFullReport(html: string): boolean {
  if (!html?.trim()) return false;
  const hasUziSection =
    /id=["']section-jury["']/i.test(html) ||
    /id=["']section-clash["']/i.test(html) ||
    /id=["']section-scan["']/i.test(html);
  const hasUziBlocks = /deep-scan|panel-card|debate-rounds|boot-overlay/i.test(html);
  return hasUziSection && hasUziBlocks;
}

/** True when HTML already has LLM reportShell wrapper (sidebar nav in DOM, not CSS). */
export function hasReportShell(html: string): boolean {
  return (
    /<nav[^>]*class="[^"]*\btoc-rail\b/i.test(html) &&
    /<html[^>]*\bdata-theme\s*=\s*["']dark["']/i.test(html)
  );
}

/** Extract inner report fragment from full or partial HTML. */
export function extractReportBody(html: string): string {
  const trimmed = html.trim();
  const mainMatch = trimmed.match(/<main[^>]*id=["']report-body["'][^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch?.[1]) return mainMatch[1].trim();

  const bodyMatch = trimmed.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch?.[1]) {
    let inner = bodyMatch[1].trim();
    inner = inner.replace(/<div class="container"[^>]*>/i, "").replace(/<nav class="toc-rail"[\s\S]*?<\/nav>/i, "");
    inner = inner.replace(/<div class="topbar"[\s\S]*?<\/div>/i, "");
    inner = inner.replace(/<\/div>\s*$/, "").trim();
    return inner;
  }

  if (/^<!DOCTYPE/i.test(trimmed) || /^<html/i.test(trimmed)) {
    return trimmed;
  }
  return trimmed;
}

/** Wrap LLM fragment in UZI dark Bloomberg shell if not already wrapped. */
export function wrapReportHtml(html: string): string {
  if (!html?.trim()) return html;
  if (isUziFullReport(html)) return html;
  if (hasReportShell(html)) return html;

  const body = extractReportBody(html);
  if (/^<!DOCTYPE/i.test(body) && !/bento-hero/i.test(body)) {
    return html;
  }
  return buildShell(body);
}

/** Structured hero metrics from backend (do not rely on LLM for these). */
export interface ReportHeroMeta {
  tsCode?: string;
  name?: string;
  industry?: string;
  price?: string;
  changePct?: string;
  turnover?: string;
  marketCap?: string;
  pe?: string;
  pb?: string;
  concepts?: string[];
  limitHeight?: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function replaceInnerHtml(html: string, className: string, inner: string): string {
  const re = new RegExp(`(<[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*>)([\\s\\S]*?)(</[^>]+>)`, "i");
  return html.replace(re, `$1${inner}$3`);
}

function changeClass(changePct?: string): string {
  const n = parseFloat(String(changePct ?? "").replace(/[%+]/g, ""));
  if (Number.isNaN(n) || n === 0) return "change";
  return n > 0 ? "change up" : "change down";
}

function formatChangeDisplay(changePct?: string): string {
  if (!changePct?.trim()) return "—";
  const trimmed = changePct.trim();
  return trimmed.includes("%") ? trimmed : `${trimmed}%`;
}

/** Inject backend-collected hero metrics into LLM HTML (overrides placeholders). */
export function injectHeroMetrics(html: string, meta: ReportHeroMeta | null | undefined): string {
  if (!html?.trim() || !meta) return html;

  let out = html;
  const name = meta.name?.trim();
  const tsCode = meta.tsCode?.trim();
  const price = meta.price?.trim();
  const changePct = meta.changePct?.trim();

  if (name) {
    out = replaceInnerHtml(out, "stock-name", escapeHtml(name));
  }
  if (tsCode) {
    out = replaceInnerHtml(out, "stock-code", escapeHtml(tsCode));
  }
  if (price) {
    out = replaceInnerHtml(out, "price", escapeHtml(price));
  }
  if (changePct) {
    const cls = changeClass(changePct);
    out = out.replace(
      /(<span[^>]*class=")[^"]*\bchange\b[^"]*("[^>]*>)[^<]*/i,
      `$1${cls}$2${escapeHtml(formatChangeDisplay(changePct))}`,
    );
  }

  if (meta.concepts?.length) {
    const tags = meta.concepts
      .slice(0, 8)
      .map((c) => `<span class="concept-tag">${escapeHtml(c)}</span>`)
      .join("\n      ");
    out = replaceInnerHtml(out, "concept-tags", `\n      ${tags}\n    `);
  }

  const chips: string[] = [];
  if (price) chips.push(`<span class="chip"><strong>现价</strong> ${escapeHtml(price)}</span>`);
  if (changePct) {
    chips.push(
      `<span class="chip"><strong>涨跌幅</strong> ${escapeHtml(formatChangeDisplay(changePct))}</span>`,
    );
  }
  if (meta.limitHeight?.trim()) {
    chips.push(`<span class="chip"><strong>连板高度</strong> ${escapeHtml(meta.limitHeight.trim())}</span>`);
  } else if (price || changePct) {
    chips.push(`<span class="chip"><strong>连板高度</strong> —</span>`);
  }
  if (meta.turnover?.trim()) {
    const t = meta.turnover.includes("%") ? meta.turnover : `${meta.turnover}%`;
    chips.push(`<span class="chip"><strong>换手率</strong> ${escapeHtml(t)}</span>`);
  }
  if (meta.pe?.trim()) {
    chips.push(`<span class="chip"><strong>PE</strong> ${escapeHtml(meta.pe.trim())}</span>`);
  }
  if (meta.marketCap?.trim()) {
    chips.push(`<span class="chip"><strong>市值</strong> ${escapeHtml(meta.marketCap.trim())}</span>`);
  }

  if (chips.length > 0) {
    out = replaceInnerHtml(out, "metric-chips", `\n      ${chips.join("\n      ")}\n    `);
  }

  return out;
}
