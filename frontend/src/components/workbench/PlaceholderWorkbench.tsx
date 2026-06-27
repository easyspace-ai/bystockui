import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizablePanel } from "@/components/layout/ResizablePanel";
import { SidebarLeft } from "@/components/layout/SidebarLeft";
import { SidebarRight } from "@/components/layout/SidebarRight";
import { DashboardMetrics, TradeDistribution } from "@/components/dashboard/DashboardMetrics";
import { MainChart } from "@/components/dashboard/MainChart";
import { StrategyRouteLayout } from "@/features/strategy/StrategyRouteLayout";
import { ScreenerSidebarLeft } from "@/components/screener/ScreenerSidebarLeft";
import { ScreenerSidebarRight } from "@/components/screener/ScreenerSidebarRight";
import { StockScreener } from "@/components/screener/StockScreener";
import { BacktestSidebarLeft } from "@/components/backtest/BacktestSidebarLeft";
import { BacktestSidebarRight } from "@/components/backtest/BacktestSidebarRight";
import { BacktestPage } from "@/components/backtest/BacktestPage";
import type { TabType } from "@/components/layout/ActivityBar";
import { useWorkbenchChrome } from "@/components/layout/WorkbenchChromeContext";

type Props = {
  tab: TabType;
};

/** 未从 src 迁移的域：沿用 web 三栏演示布局（不含「数据」域） */
export function PlaceholderWorkbench({ tab }: Props) {
  const { leftCollapsed, rightCollapsed } = useWorkbenchChrome();

  if (tab === "strategy") {
    return (
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <StrategyRouteLayout />
      </main>
    );
  }

  return (
    <main className="flex min-h-0 flex-1 overflow-hidden">
      <ResizablePanel
        side="left"
        defaultWidth={tab === "filter" || tab === "backtest" ? 240 : 280}
        isCollapsed={leftCollapsed}
      >
        {tab === "filter" ? (
          <ScreenerSidebarLeft />
        ) : tab === "backtest" ? (
          <BacktestSidebarLeft />
        ) : (
          <SidebarLeft />
        )}
      </ResizablePanel>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
        {tab === "filter" ? (
          <StockScreener />
        ) : tab === "backtest" ? (
          <BacktestPage />
        ) : (
          <ScrollArea className="flex-1">
            <div className="max-w-6xl mx-auto p-8 space-y-8">
              <DashboardMetrics />
              <MainChart />
              <TradeDistribution />
            </div>
          </ScrollArea>
        )}
      </div>

      <ResizablePanel side="right" defaultWidth={320} isCollapsed={rightCollapsed}>
        {tab === "filter" ? (
          <ScreenerSidebarRight />
        ) : tab === "backtest" ? (
          <BacktestSidebarRight />
        ) : (
          <SidebarRight />
        )}
      </ResizablePanel>
    </main>
  );
}
