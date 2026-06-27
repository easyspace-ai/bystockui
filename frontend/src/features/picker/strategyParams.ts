import type { StrategyConfig } from "@/features/picker/AiPanel";

export const STRATEGY_ROUTES: Record<StrategyConfig["strategy_type"], string> = {
  end_of_day: "/picker/eod",
  momentum: "/picker/momentum",
  kunpeng: "/picker/kunpeng",
};

/** URL param carrying the user/AI strategy display name (survives param cleanup). */
export const STRATEGY_LABEL_PARAM = "strategyLabel";

export function parseNumericParam(params: URLSearchParams, key: string): number | undefined {
  const val = params.get(key);
  if (val === null || val === "") return undefined;
  const n = Number(val);
  return Number.isFinite(n) ? n : undefined;
}

export function parseBooleanParam(params: URLSearchParams, key: string): boolean | undefined {
  const val = params.get(key);
  if (val === null) return undefined;
  if (val === "true") return true;
  if (val === "false") return false;
  return undefined;
}

const EOD_PARAM_KEYS = [
  "marketCapMin",
  "marketCapMax",
  "volumeRatioMin",
  "changePercentMin",
  "changePercentMax",
  "turnoverRateMin",
  "turnoverRateMax",
  "timelineAboveAvgRatio",
] as const;

const MOMENTUM_PARAM_KEYS = [
  "momentumThreshold",
  "avgTurnoverMin",
  "marketCapMin",
  "marketCapMax",
  "priceMin",
  "priceMax",
] as const;

export function parseEndOfDayParams(params: URLSearchParams): Record<string, number | boolean> | null {
  const strategyType = params.get("strategyType");
  if (strategyType && strategyType !== "end_of_day") return null;

  const updates: Record<string, number | boolean> = {};
  for (const key of EOD_PARAM_KEYS) {
    const val = parseNumericParam(params, key);
    if (val !== undefined) updates[key] = val;
  }
  const excludeST = parseBooleanParam(params, "excludeST");
  if (excludeST !== undefined) updates.excludeST = excludeST;

  return Object.keys(updates).length > 0 ? updates : null;
}

export function parseMomentumParams(params: URLSearchParams): Record<string, number | boolean> | null {
  const strategyType = params.get("strategyType");
  if (strategyType && strategyType !== "momentum") return null;

  const updates: Record<string, number | boolean> = {};
  for (const key of MOMENTUM_PARAM_KEYS) {
    const val = parseNumericParam(params, key);
    if (val !== undefined) updates[key] = val;
  }
  const excludeST = parseBooleanParam(params, "excludeST");
  if (excludeST !== undefined) updates.excludeST = excludeST;
  const trendAboveMA60 = parseBooleanParam(params, "trendAboveMA60");
  if (trendAboveMA60 !== undefined) updates.trendAboveMA60 = trendAboveMA60;

  return Object.keys(updates).length > 0 ? updates : null;
}

const KUNPENG_PARAM_KEYS = [
  "marketCapMin",
  "marketCapMax",
  "netProfitMin",
  "peMin",
  "peMax",
  "priceMin",
  "priceMax",
] as const;

export function parseKunpengParams(params: URLSearchParams): Record<string, number | boolean> | null {
  const strategyType = params.get("strategyType");
  if (strategyType && strategyType !== "kunpeng") return null;

  const updates: Record<string, number | boolean> = {};
  for (const key of KUNPENG_PARAM_KEYS) {
    const val = parseNumericParam(params, key);
    if (val !== undefined) updates[key] = val;
  }
  const excludeST = parseBooleanParam(params, "excludeST");
  if (excludeST !== undefined) updates.excludeST = excludeST;
  const excludeNewStock = parseBooleanParam(params, "excludeNewStock");
  if (excludeNewStock !== undefined) updates.excludeNewStock = excludeNewStock;

  return Object.keys(updates).length > 0 ? updates : null;
}

export function clearAppliedStrategyParams(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete("applied");
  next.delete("strategyType");
  for (const key of [...EOD_PARAM_KEYS, ...MOMENTUM_PARAM_KEYS, ...KUNPENG_PARAM_KEYS, "excludeST", "trendAboveMA60", "excludeNewStock"]) {
    next.delete(key);
  }
  return next;
}

function pickNumericOrBooleanParams(
  source: Record<string, unknown>,
  keys: readonly string[],
): Record<string, number | boolean> {
  const updates: Record<string, number | boolean> = {};
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) updates[key] = value;
    if (typeof value === "boolean") updates[key] = value;
  }
  return updates;
}

export function kunpengParamsFromRecord(params: Record<string, unknown>): Record<string, number | boolean> {
  return mapKunpengAIParams(
    pickNumericOrBooleanParams(params, [...KUNPENG_PARAM_KEYS, "excludeST", "excludeNewStock"]),
  );
}

export function momentumParamsFromRecord(params: Record<string, unknown>): Record<string, number | boolean> {
  return pickNumericOrBooleanParams(params, [...MOMENTUM_PARAM_KEYS, "excludeST", "trendAboveMA60"]);
}

export function endOfDayParamsFromRecord(params: Record<string, unknown>): Record<string, number | boolean> {
  return pickNumericOrBooleanParams(params, [...EOD_PARAM_KEYS, "excludeST"]);
}

/** Map AI / URL params to KunpengScanner internal criteria field names. */
export function mapKunpengAIParams(parsed: Record<string, number | boolean>): Record<string, number | boolean> {
  const mapped = { ...parsed };
  if (parsed.priceMin !== undefined) {
    mapped.minPrice = parsed.priceMin;
    delete mapped.priceMin;
  }
  if (parsed.priceMax !== undefined) {
    mapped.maxPrice = parsed.priceMax;
    delete mapped.priceMax;
  }
  return mapped;
}
