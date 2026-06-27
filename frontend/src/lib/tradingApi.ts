import { searchStocks, type StockSearchItem } from "@/lib/marketApi";
import { normalizeCnSymbol } from "@/lib/symbols";

export interface TradingApiMessage {
  role: string;
  content: string;
}

export interface TradingApiKlineCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
  amount?: number | null;
  change?: number | null;
  change_percent?: number | null;
  turnover_rate?: number | null;
}

export interface TradingApiKlineResponse {
  symbol: string;
  start_date: string;
  end_date: string;
  candles: TradingApiKlineCandle[];
}

export interface TradingApiMinutePoint {
  time: string;
  price: number;
  volume: number;
}

/** 分时（1 分钟），来自合并后端通达信 */
export interface TradingApiMinuteResponse {
  symbol: string;
  date: string;
  points: TradingApiMinutePoint[];
}

export interface TradingApiStreamEvent {
  event: string;
  // Stream payloads are backend-defined; keep loose for SSE JSON chunks.
  data: any;
  timestamp?: string;
}

export interface TradingApiReportSummary {
  id: string;
  symbol: string;
  trade_date: string;
  decision?: string | null;
  direction?: string | null;
  confidence?: number | null;
  target_price?: number | null;
  stop_loss_price?: number | null;
  risk_items?: Array<Record<string, unknown>> | null;
  key_metrics?: Array<Record<string, unknown>> | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface TradingApiReportDetail extends TradingApiReportSummary {
  user_id?: string | null;
  error?: string | null;
  result_data?: Record<string, unknown> | null;
  risk_items?: Array<Record<string, unknown>> | null;
  key_metrics?: Array<Record<string, unknown>> | null;
  analyst_traces?: Array<Record<string, unknown>> | null;
  market_report?: string | null;
  sentiment_report?: string | null;
  news_report?: string | null;
  fundamentals_report?: string | null;
  macro_report?: string | null;
  smart_money_report?: string | null;
  game_theory_report?: string | null;
  investment_plan?: string | null;
  trader_investment_plan?: string | null;
  final_trade_decision?: string | null;
}

/** 与 backend 合并服务一致：多智能体分析挂载 /api/v1/analysis */
const ANALYSIS_API_PREFIX = "/api/v1/analysis";

function getServiceOrigin(): string {
  const envUrl = (import.meta.env.VITE_TRADING_API_URL as string | undefined)?.trim();
  if (envUrl) return envUrl.replace(/\/$/, "");
  return "";
}

function analysisApiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${ANALYSIS_API_PREFIX}${p}`;
}

function getToken(): string {
  const envToken = (import.meta.env.VITE_TRADING_API_TOKEN as string | undefined)?.trim();
  if (envToken) return envToken;
  try {
    return (localStorage.getItem("tradingapi-token") || "").trim();
  } catch {
    return "";
  }
}

function buildHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra || {});
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = getToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

async function readErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      const data = (await response.json()) as { detail?: string; message?: string };
      return data?.detail || data?.message || response.statusText;
    } catch {
      return response.statusText;
    }
  }
  try {
    const text = await response.text();
    return text || response.statusText;
  } catch {
    return response.statusText;
  }
}

export async function tradingApiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${getServiceOrigin()}${path}`;
  const response = await fetch(url, {
    ...init,
    cache: init?.cache ?? "no-store",
    headers: buildHeaders(init?.headers),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return response.json() as Promise<T>;
}

export async function getTradingKline(
  symbol: string,
  startDate?: string,
  endDate?: string,
): Promise<TradingApiKlineResponse> {
  const params = new URLSearchParams({ symbol });
  if (startDate) params.append("start_date", startDate);
  if (endDate) params.append("end_date", endDate);
  return tradingApiRequest<TradingApiKlineResponse>(analysisApiUrl(`/market/kline?${params.toString()}`));
}

/** 分时；`date` 空则服务端择日（通常最近交易日） */
export async function getTradingMinute(symbol: string, date?: string): Promise<TradingApiMinuteResponse> {
  const params = new URLSearchParams({ symbol });
  if (date) params.append("date", date);
  return tradingApiRequest<TradingApiMinuteResponse>(analysisApiUrl(`/market/minute?${params.toString()}`));
}

function tradingSymbolFromStockSearchItem(item: StockSearchItem): string {
  const code = item.code.trim().toUpperCase();
  const m = (item.market || "").trim();
  if (m.includes("沪")) return `${code}.SH`;
  if (m.includes("深")) return `${code}.SZ`;
  if (m.includes("京")) return `${code}.BJ`;
  const normalized = normalizeCnSymbol(code);
  if (normalized) return normalized;
  return code;
}

/** stock.db 未同步或为空时，用通达信本地代码表兜底（需合并服务开启 TDX） */
async function searchTdxStocksForTrading(keyword: string): Promise<Array<{ symbol: string; name: string }>> {
  const kw = keyword.trim();
  if (!kw) return [];
  const path = `/api/v1/tdx/search?keyword=${encodeURIComponent(kw)}`;
  const url = `${getServiceOrigin()}${path}`;
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as { code?: number; data?: unknown };
    if (payload.code !== 0 || !Array.isArray(payload.data)) return [];
    return payload.data
      .map((row: { code?: string; name?: string; exchange?: string }) => {
        const code = String(row.code ?? "").trim().toUpperCase();
        if (!code) return null;
        const ex = String(row.exchange ?? "").toLowerCase();
        const suffix = ex === "sh" ? ".SH" : ex === "bj" ? ".BJ" : ".SZ";
        return { symbol: `${code}${suffix}`, name: String(row.name ?? "") };
      })
      .filter((x): x is { symbol: string; name: string } => x != null)
      .slice(0, 50);
  } catch {
    return [];
  }
}

/** 标的联想：优先 stock.db（/api/v1/stock/search），无结果再试 TDX 代码表 */
export async function searchTradingStocks(
  query: string,
): Promise<{ results: Array<{ symbol: string; name: string }> }> {
  const kw = query.trim().replace(/\.[A-Z]+$/i, "").trim();
  if (!kw) {
    return { results: [] };
  }
  let results: Array<{ symbol: string; name: string }> = [];
  try {
    const items = await searchStocks(kw);
    const arr = Array.isArray(items) ? items : [];
    results = arr.slice(0, 50).map((item) => ({
      symbol: tradingSymbolFromStockSearchItem(item),
      name: item.name,
    }));
  } catch {
    /* stock 接口失败或未配置时尝试 TDX */
  }
  if (results.length === 0) {
    results = await searchTdxStocksForTrading(kw);
  }
  return { results };
}

export interface TradingAnalysisStreamOptions {
  messages: TradingApiMessage[];
  selectedAnalysts?: string[];
  onEvent: (event: TradingApiStreamEvent) => void;
  signal?: AbortSignal;
}

export async function streamTradingAnalysis({
  messages,
  selectedAnalysts,
  onEvent,
  signal,
}: TradingAnalysisStreamOptions): Promise<void> {
  const response = await fetch(`${getServiceOrigin()}${analysisApiUrl("/chat/completions")}`, {
    method: "POST",
    signal,
    headers: buildHeaders(),
    body: JSON.stringify({
      messages,
      stream: true,
      selected_analysts: selectedAnalysts,
    }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  if (!response.body) {
    throw new Error("分析流不可用");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "message";
  let currentData: string[] = [];

  const emit = () => {
    if (!currentData.length) return;
    const raw = currentData.join("\n");
    let parsed: any = raw;
    if (raw !== "[DONE]") {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = raw;
      }
    }
    onEvent({ event: currentEvent, data: parsed });
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (value) {
        buffer += decoder.decode(value, { stream: !done });
      }
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line) {
          emit();
          currentEvent = "message";
          currentData = [];
          continue;
        }
        if (line.startsWith("event:")) {
          currentEvent = line.slice(6).trim() || "message";
          continue;
        }
        if (line.startsWith("data:")) {
          currentData.push(line.slice(5).trimStart());
        }
      }

      if (done) {
        break;
      }
    }
    emit();
  } finally {
    reader.releaseLock();
  }
}

export async function getTradingReports(
  symbol?: string,
  skip = 0,
  limit = 20,
): Promise<{ total: number; reports: TradingApiReportSummary[] }> {
  const params = new URLSearchParams();
  if (symbol) params.append("symbol", symbol);
  params.append("skip", String(skip));
  params.append("limit", String(limit));
  const data = await tradingApiRequest<{ total: number; reports: TradingApiReportSummary[] | null }>(
    analysisApiUrl(`/reports?${params.toString()}`),
  );
  return {
    total: data.total ?? 0,
    reports: Array.isArray(data.reports) ? data.reports : [],
  };
}

export async function getTradingReport(reportId: string): Promise<TradingApiReportDetail> {
  return tradingApiRequest<TradingApiReportDetail>(analysisApiUrl(`/reports/${reportId}`));
}

/** 与 backend JobStatusResponse 对齐 */
export interface TradingJobStatusPayload {
  job_id: string;
  status: string;
  created_at?: string;
  updated_at?: string;
  symbol?: string;
  trade_date?: string;
  error?: string;
}

export async function getTradingJobStatus(jobId: string): Promise<TradingJobStatusPayload> {
  return tradingApiRequest<TradingJobStatusPayload>(analysisApiUrl(`/jobs/${encodeURIComponent(jobId)}`));
}

export async function getTradingJobResult(jobId: string): Promise<{
  job_id: string;
  status: string;
  result?: Record<string, unknown> | null;
}> {
  return tradingApiRequest<{ job_id: string; status: string; result?: Record<string, unknown> | null }>(
    analysisApiUrl(`/jobs/${encodeURIComponent(jobId)}/result`),
  );
}
