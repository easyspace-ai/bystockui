import { useSearchParams, useNavigate, Outlet } from "react-router-dom";
import { WorkbenchLayout } from "@/components/layout/WorkbenchLayout";
import { useWorkbenchChrome } from "@/components/layout/WorkbenchChromeContext";
import { ToastProvider } from "@/components/picker/common/Toast";
import { PickerLeftSidebar } from "@/features/picker/PickerLeftSidebar";
import { getSavedStrategyById } from "@/features/picker/savedStrategies";
import { STRATEGY_LABEL_PARAM, STRATEGY_ROUTES } from "@/features/picker/strategyParams";
import type { StrategyConfig } from "@/features/picker/AiPanel";

export function PickerRouteLayout() {
  const { leftCollapsed } = useWorkbenchChrome();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const handleApplyStrategy = (strategy: StrategyConfig, savedId?: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("strategyType", strategy.strategy_type);
    params.set("applied", "1");
    if (savedId) {
      params.set("savedId", savedId);
    } else {
      params.delete("savedId");
    }

    const displayName =
      (savedId ? getSavedStrategyById(savedId)?.label : undefined)?.trim() ||
      strategy.name?.trim();
    if (displayName) {
      params.set(STRATEGY_LABEL_PARAM, displayName);
    } else {
      params.delete(STRATEGY_LABEL_PARAM);
    }

    if (strategy.params) {
      for (const [key, value] of Object.entries(strategy.params)) {
        if (value !== undefined && value !== null) {
          params.set(key, String(value));
        }
      }
    }
    const route = STRATEGY_ROUTES[strategy.strategy_type] ?? "/picker/eod";
    navigate(`${route}?${params.toString()}`);
  };

  return (
    <ToastProvider>
      <WorkbenchLayout
        className="min-h-0 flex-1 bg-slate-100/80 dark:bg-slate-950/80"
        innerClassName="min-h-0"
        mainClassName="min-h-0 overflow-hidden flex flex-col"
        leftPanelId="picker-left"
        mainPanelId="picker-main"
        rightPanelId="picker-right"
        leftMinPx={280}
        leftMaxPx={420}
        leftSidebarVisible={!leftCollapsed}
        rightSidebarVisible={false}
        left={<PickerLeftSidebar onApplyStrategy={handleApplyStrategy} />}
        main={
          <div className="picker-unified min-h-0 min-w-0 flex flex-1 flex-col overflow-hidden bg-slate-50 text-foreground dark:bg-slate-950">
            <div className="relative mx-auto min-h-0 w-full max-w-[1800px] flex-1 overflow-auto px-4 py-4 md:px-6 md:py-6">
              <Outlet />
            </div>
          </div>
        }
        right={null}
      />
    </ToastProvider>
  );
}
