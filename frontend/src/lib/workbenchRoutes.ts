/** 侧栏五入口与 URL 前缀、设计稿 Tab 标识的映射 */

export type WorkbenchTab = "ai" | "data" | "filter" | "backtest" | "strategy";

export const WORKBENCH_PREFIX = {
  analysis: "/analysis",
  market: "/market",
  picker: "/picker",
  hotmoney: "/hotmoney",
  backtest: "/backtest",
  strategies: "/strategies",
} as const;

export function workbenchTabFromPath(pathname: string): WorkbenchTab {
  if (pathname.startsWith(WORKBENCH_PREFIX.market)) return "data";
  if (pathname.startsWith(WORKBENCH_PREFIX.picker)) return "filter";
  if (pathname.startsWith(WORKBENCH_PREFIX.backtest)) return "backtest";
  if (pathname.startsWith(WORKBENCH_PREFIX.strategies)) return "strategy";
  if (pathname.startsWith(WORKBENCH_PREFIX.analysis)) return "ai";
  return "ai";
}
