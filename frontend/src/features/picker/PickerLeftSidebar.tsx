import { useState, useEffect, useCallback, type ComponentType } from "react";
import { NavLink, useNavigate, useSearchParams } from "react-router-dom";
import { Filter, Sparkles, Plus, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { AiPanel, type StrategyConfig } from "@/features/picker/AiPanel";
import { SavedStrategyRenameDialog } from "@/features/picker/SavedStrategyRenameDialog";
import { STRATEGY_ROUTES } from "@/features/picker/strategyParams";
import {
  BUILTIN_STRATEGIES,
  SAVED_STRATEGIES_CHANGED,
  loadSavedStrategies,
  deleteSavedStrategy,
  saveStrategy,
  renameSavedStrategy,
  toStrategyConfig,
  type SavedStrategyItem,
} from "@/features/picker/savedStrategies";

interface PickerStrategiesListProps {
  savedStrategies: SavedStrategyItem[];
  onApplyStrategy: (strategy: StrategyConfig, savedId?: string) => void;
  onDeleteSaved: (id: string) => void;
  onRenameSaved: (id: string, label: string, description?: string) => void;
}

function PickerStrategiesList({
  savedStrategies,
  onApplyStrategy,
  onDeleteSaved,
  onRenameSaved,
}: PickerStrategiesListProps) {
  const [searchParams] = useSearchParams();
  const activeSavedId = searchParams.get("savedId");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ScrollArea className="flex-1 min-h-0 px-3">
        <nav className="space-y-1 pb-5 pt-1">
          {BUILTIN_STRATEGIES.map((item) => (
            <NavLink
              key={item.id}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "w-full flex items-start gap-3 rounded-xl border px-3 py-3 text-left transition-all",
                  isActive && !activeSavedId
                    ? "border-blue-500/50 bg-white dark:bg-slate-900 shadow-sm ring-1 ring-slate-200/80 dark:ring-slate-800"
                    : "border-transparent hover:bg-slate-100 dark:hover:bg-slate-900/60",
                )
              }
            >
              {({ isActive }) => {
                const Icon = item.icon;
                const highlighted = isActive && !activeSavedId;
                return (
                  <>
                    <span
                      className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        highlighted ? "bg-blue-500/15 text-blue-600 dark:text-blue-400" : "bg-slate-200/60 dark:bg-slate-800 text-slate-500",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-slate-900 dark:text-white">{item.label}</span>
                      <span className="mt-0.5 block text-[10px] leading-snug text-slate-500">{item.description}</span>
                    </span>
                  </>
                );
              }}
            </NavLink>
          ))}

          {savedStrategies.length > 0 && (
            <div className="pt-2">
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">我的策略</p>
              {savedStrategies.map((item) => {
                const Icon = item.icon as ComponentType<{ className?: string }>;
                const active = activeSavedId === item.id;
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "group mb-1 flex items-start gap-1 rounded-xl border px-1 py-1 transition-all",
                      active
                        ? "border-purple-500/40 bg-white dark:bg-slate-900 shadow-sm ring-1 ring-purple-200/80 dark:ring-purple-900/50"
                        : "border-transparent hover:bg-slate-100 dark:hover:bg-slate-900/60",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onApplyStrategy(toStrategyConfig(item), item.id)}
                      className="flex min-w-0 flex-1 items-start gap-3 rounded-lg px-2 py-2 text-left"
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                          active ? "bg-purple-500/15 text-purple-600 dark:text-purple-400" : "bg-slate-200/60 dark:bg-slate-800 text-slate-500",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-slate-900 dark:text-white">{item.label}</span>
                        <span className="mt-0.5 block text-[10px] leading-snug text-slate-500">{item.description}</span>
                      </span>
                    </button>
                    <SavedStrategyRenameDialog
                      label={item.label}
                      description={item.description}
                      onSave={(label, description) => onRenameSaved(item.id, label, description)}
                      triggerClassName="mt-2 shrink-0 rounded-lg p-1.5 text-slate-400 opacity-0 transition-all hover:bg-purple-500/10 hover:text-purple-600 group-hover:opacity-100"
                    />
                    <button
                      type="button"
                      onClick={() => onDeleteSaved(item.id)}
                      className="mt-2 shrink-0 rounded-lg p-1.5 text-slate-400 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-500 group-hover:opacity-100"
                      title="删除策略"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </nav>
      </ScrollArea>
    </div>
  );
}

interface PickerLeftSidebarProps {
  onApplyStrategy: (strategy: StrategyConfig, savedId?: string) => void;
}

export function PickerLeftSidebar({ onApplyStrategy }: PickerLeftSidebarProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<"strategies" | "ai">("strategies");
  const [savedStrategies, setSavedStrategies] = useState<SavedStrategyItem[]>(() => loadSavedStrategies());

  const refreshSaved = useCallback(() => {
    setSavedStrategies(loadSavedStrategies());
  }, []);

  useEffect(() => {
    refreshSaved();
  }, [refreshSaved, tab]);

  useEffect(() => {
    const handler = () => refreshSaved();
    window.addEventListener(SAVED_STRATEGIES_CHANGED, handler);
    return () => window.removeEventListener(SAVED_STRATEGIES_CHANGED, handler);
  }, [refreshSaved]);

  const handleSaveStrategy = useCallback(
    (strategy: StrategyConfig) => {
      const saved = saveStrategy(strategy);
      refreshSaved();
      return saved;
    },
    [refreshSaved],
  );

  const handleDeleteSaved = useCallback(
    (id: string) => {
      const wasActive = searchParams.get("savedId") === id;
      const item = savedStrategies.find((s) => s.id === id);
      deleteSavedStrategy(id);
      refreshSaved();
      if (wasActive && item) {
        const route = STRATEGY_ROUTES[item.strategy_type] ?? "/picker/eod";
        navigate(route, { replace: true });
      }
    },
    [refreshSaved, searchParams, savedStrategies, navigate],
  );

  const handleRenameSaved = useCallback(
    (id: string, label: string, description?: string) => {
      renameSavedStrategy(id, label, description);
      refreshSaved();
    },
    [refreshSaved],
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50 dark:bg-slate-950 border-r border-slate-200/50 dark:border-slate-800/50">
      <div className="shrink-0 p-4 pb-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Filter className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-slate-900 dark:text-white">选股工作台</h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">策略与 AI 生成</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setTab("ai")}
          className={cn(
            "mb-3 flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition-all",
            tab === "ai"
              ? "border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-300"
              : "border-slate-200/60 bg-white text-slate-600 hover:border-purple-300/50 hover:text-purple-600 dark:border-slate-700/60 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-purple-300",
          )}
        >
          <Plus className="h-3.5 w-3.5 shrink-0" />
          AI 生成策略
        </button>

        <Tabs value={tab} onValueChange={(value) => setTab(value as "strategies" | "ai")}>
          <TabsList className="grid h-8 w-full grid-cols-2">
            <TabsTrigger value="strategies" className="text-[11px]">
              策略库
            </TabsTrigger>
            <TabsTrigger value="ai" className="text-[11px] gap-1">
              <Sparkles className="h-3 w-3" />
              AI 生成
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "strategies" ? (
          <PickerStrategiesList
            savedStrategies={savedStrategies}
            onApplyStrategy={onApplyStrategy}
            onDeleteSaved={handleDeleteSaved}
            onRenameSaved={handleRenameSaved}
          />
        ) : (
          <AiPanel
            onApplyStrategy={onApplyStrategy}
            onSaveStrategy={handleSaveStrategy}
            onSaved={refreshSaved}
          />
        )}
      </div>

      <div className="shrink-0 border-t border-slate-200/50 px-4 py-2.5 dark:border-slate-800/50">
        <p className="text-[10px] text-slate-400">策略仅供参考，投资需谨慎</p>
      </div>
    </div>
  );
}
