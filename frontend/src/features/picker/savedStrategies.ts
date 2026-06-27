import type { StrategyConfig } from "@/features/picker/AiPanel";
import { TrendingUp, Flame, Fish, Sparkles } from "lucide-react";
import type { ComponentType } from "react";

const STORAGE_KEY = "picker-saved-strategies-v1";

export const SAVED_STRATEGIES_CHANGED = "picker-saved-strategies-changed";

export interface BuiltinStrategyItem {
  id: string;
  to: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  builtin: true;
  strategy_type: StrategyConfig["strategy_type"];
}

export interface SavedStrategyItem {
  id: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  builtin: false;
  strategy_type: StrategyConfig["strategy_type"];
  params: Record<string, unknown>;
  explanation?: string;
  steps?: string[];
  createdAt: number;
}

export type StrategyListItem = BuiltinStrategyItem | SavedStrategyItem;

export const BUILTIN_STRATEGIES: BuiltinStrategyItem[] = [
  {
    id: "builtin-eod",
    to: "/picker/eod",
    label: "尾盘选股",
    description: "一日持股法，盘尾筛出强势候选",
    icon: TrendingUp,
    builtin: true,
    strategy_type: "end_of_day",
  },
  {
    id: "builtin-momentum",
    to: "/picker/momentum",
    label: "妖股扫描",
    description: "动量、趋势、活跃度三因子",
    icon: Flame,
    builtin: true,
    strategy_type: "momentum",
  },
  {
    id: "builtin-kunpeng",
    to: "/picker/kunpeng",
    label: "鲲鹏战法",
    description: "安全垫与潜在倍数初筛",
    icon: Fish,
    builtin: true,
    strategy_type: "kunpeng",
  },
];

type SavedStrategyRaw = Omit<SavedStrategyItem, "icon" | "builtin">;

function persistSaved(items: SavedStrategyRaw[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function notifySavedStrategiesChanged(): void {
  window.dispatchEvent(new CustomEvent(SAVED_STRATEGIES_CHANGED));
}

function readSavedRaw(): SavedStrategyItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedStrategyRaw[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((s) => s && s.id && s.label && s.strategy_type)
      .map((s) => ({ ...s, builtin: false as const, icon: Sparkles }));
  } catch {
    return [];
  }
}

export function loadSavedStrategies(): SavedStrategyItem[] {
  return readSavedRaw();
}

export function getSavedStrategyById(id: string): SavedStrategyItem | null {
  return readSavedRaw().find((s) => s.id === id) ?? null;
}

export function saveStrategy(config: StrategyConfig): SavedStrategyItem {
  const existing = readSavedRaw();
  const item: SavedStrategyItem = {
    id: `ai-${Date.now()}`,
    label: config.name || "AI 策略",
    description: config.description || "AI 生成的选股策略",
    icon: Sparkles,
    builtin: false,
    strategy_type: config.strategy_type,
    params: config.params ?? {},
    explanation: config.explanation,
    steps: config.steps,
    createdAt: Date.now(),
  };
  const next = [item, ...existing];
  persistSaved(next.map(({ icon: _i, ...rest }) => rest));
  notifySavedStrategiesChanged();
  return item;
}

export function renameSavedStrategy(
  id: string,
  label: string,
  description?: string,
): SavedStrategyItem | null {
  const trimmed = label.trim();
  if (!trimmed) return null;

  const items = readSavedRaw();
  const index = items.findIndex((s) => s.id === id);
  if (index < 0) return null;

  const updated: SavedStrategyItem = {
    ...items[index],
    label: trimmed,
    ...(description !== undefined ? { description: description.trim() || items[index].description } : {}),
  };
  const next = [...items];
  next[index] = updated;
  persistSaved(next.map(({ icon: _i, ...rest }) => rest));
  notifySavedStrategiesChanged();
  return updated;
}

export function deleteSavedStrategy(id: string): void {
  const next = readSavedRaw().filter((s) => s.id !== id);
  persistSaved(next.map(({ icon: _i, ...rest }) => rest));
  notifySavedStrategiesChanged();
}

export function toStrategyConfig(item: SavedStrategyItem): StrategyConfig {
  return {
    strategy_type: item.strategy_type,
    name: item.label,
    description: item.description,
    params: item.params,
    explanation: item.explanation,
    steps: item.steps,
  };
}
