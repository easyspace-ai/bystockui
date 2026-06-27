export type StrategyJsonPrimitive = string | number | boolean | null;
export type StrategyJsonValue = StrategyJsonPrimitive | StrategyJsonObject | StrategyJsonValue[];
export interface StrategyJsonObject {
  [key: string]: StrategyJsonValue;
}

export interface StrategySummary {
  id: number;
  name: string;
  code: string;
  language?: string;
  description?: string | null;
  tags?: string[];
  parameters_schema?: StrategyJsonObject | null;
  version?: string;
  status?: string;
  is_template?: boolean;
  template_type?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface StrategyCreateRequest {
  name: string;
  code: string;
  language?: string;
  description?: string | null;
  tags?: string[];
  parameters_schema?: StrategyJsonObject;
  version?: string;
  is_template?: boolean;
  template_type?: string | null;
  status?: string;
}

export interface StrategyUpdateRequest {
  name?: string;
  code?: string;
  description?: string | null;
  tags?: string[];
  parameters_schema?: StrategyJsonObject;
  version?: string;
  is_template?: boolean;
  template_type?: string | null;
  status?: string;
}

export interface StrategyValidateRequest {
  code: string;
}

export interface StrategyValidateResponse {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface StrategyGenerateRequest {
  prompt: string;
  style?: string;
  symbol?: string;
  horizon?: string;
}

export interface StrategyGenerateResponse {
  code: string;
  summary: string;
  parameters_schema: StrategyJsonObject;
}

function getBaseUrl(): string {
  const envUrl =
    (import.meta.env.VITE_BACKTEST_API_URL as string | undefined)?.trim() ||
    (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  return envUrl ? envUrl.replace(/\/$/, "") : "";
}

async function readErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      const data = await response.json();
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

async function request<T>(path: string, init?: Parameters<typeof fetch>[1]): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return response.json() as Promise<T>;
}

export async function listStrategies(params?: {
  skip?: number;
  limit?: number;
  keyword?: string;
}): Promise<StrategySummary[]> {
  const search = new URLSearchParams();
  if (typeof params?.skip === "number") search.set("skip", String(params.skip));
  if (typeof params?.limit === "number") search.set("limit", String(params.limit));
  if (params?.keyword) search.set("keyword", params.keyword);
  const query = search.toString();
  return request<StrategySummary[]>(`/api/v1/backtest/api/v1/strategies${query ? `?${query}` : ""}`);
}

export async function getStrategy(strategyId: number): Promise<StrategySummary> {
  return request<StrategySummary>(`/api/v1/backtest/api/v1/strategies/${strategyId}`);
}

export async function createStrategy(payload: StrategyCreateRequest): Promise<StrategySummary> {
  return request<StrategySummary>("/api/v1/backtest/api/v1/strategies", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateStrategy(
  strategyId: number,
  payload: StrategyUpdateRequest,
): Promise<StrategySummary> {
  return request<StrategySummary>(`/api/v1/backtest/api/v1/strategies/${strategyId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteStrategy(strategyId: number): Promise<void> {
  await request(`/api/v1/backtest/api/v1/strategies/${strategyId}`, {
    method: "DELETE",
  });
}

export async function validateStrategyCode(code: string): Promise<StrategyValidateResponse> {
  return request<StrategyValidateResponse>("/api/v1/backtest/api/v1/strategies/validate", {
    method: "POST",
    body: JSON.stringify({ code } satisfies StrategyValidateRequest),
  });
}

export async function generateStrategy(
  payload: StrategyGenerateRequest,
): Promise<StrategyGenerateResponse> {
  return request<StrategyGenerateResponse>("/api/v1/backtest/api/v1/strategies/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface StrategyModifyRequest {
  template_name: string;
  requirements: string;
  temperature?: number;
}

export interface StrategyModifyResponse {
  code: string;
  changes: string[];
  parameters_schema: StrategyJsonObject;
  is_valid: boolean;
  errors: string[];
  base_template: string;
}

export async function modifyStrategy(payload: StrategyModifyRequest): Promise<StrategyModifyResponse> {
  return request<StrategyModifyResponse>("/api/v1/backtest/api/v1/strategies/modify", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface StrategyOptimizeRequest {
  optimization_goal: string;
  backtest_job_id?: string;
  temperature?: number;
}

export interface StrategyOptimizeResponse {
  code: string;
  analysis: string;
  suggestions: string[];
  is_valid: boolean;
  errors: string[];
}

export async function optimizeStrategy(
  strategyId: number,
  payload: StrategyOptimizeRequest,
): Promise<StrategyOptimizeResponse> {
  return request<StrategyOptimizeResponse>(`/api/v1/backtest/api/v1/strategies/${strategyId}/optimize`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface StrategyExplainResponse {
  explanation: string;
  raw?: string;
}

export async function explainStrategy(strategyId: number): Promise<StrategyExplainResponse> {
  return request<StrategyExplainResponse>(`/api/v1/backtest/api/v1/strategies/${strategyId}/explain`, {
    method: "POST",
  });
}
