import * as React from "react";
import {
  Bell,
  Search,
  Settings,
  HelpCircle,
  Menu,
  Command,
  PanelLeft,
  PanelRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkbenchChrome } from "@/components/layout/WorkbenchChromeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { WorkbenchSettingsDialog } from "@/components/layout/WorkbenchSettingsDialog";

// Breadcrumb 配置
const BREADCRUMB_LABELS: Record<string, string> = {
  analysis: "AI 分析",
  "daily-selection": "每日选股",
  "expert-analysis": "专家分析",
  market: "市场数据",
  picker: "智能选股",
  hotmoney: "游资大佬看盘",
  backtest: "策略回测",
  strategies: "策略管理",
  eod: "尾盘选股",
  momentum: "妖股扫描",
  kunpeng: "鲲鹏战法",
};

// Workspace Switcher - COMPACT
function WorkspaceSwitcher() {
  return (
    <button className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
      <div className="w-5 h-5 rounded-md bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
        <span className="text-white text-[10px] font-bold">Q</span>
      </div>
      <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
        量化平台
      </span>
    </button>
  );
}

// Search Bar - COMPACT
function SearchBar({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="hidden md:flex items-center gap-2 flex-1 max-w-md px-2.5 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all shadow-sm"
    >
      <Search size={14} className="text-gray-400" />
      <span className="text-xs text-gray-400 flex-1 text-left">
        搜索功能、数据、策略...
      </span>
      <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-[9px] font-medium text-gray-500">
        <Command size={9} />
        K
      </kbd>
    </button>
  );
}

// Quick Actions - COMPACT
function QuickActions({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <div className="flex items-center gap-0.5">
      <Button variant="ghost" size="icon" className="w-7 h-7 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
        <HelpCircle size={15} />
      </Button>
      <Button variant="ghost" size="icon" className="w-7 h-7 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 relative">
        <Bell size={15} />
        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500 border border-white dark:border-gray-950" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="w-7 h-7 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        onClick={onOpenSettings}
        title="设置"
      >
        <Settings size={15} />
      </Button>
    </div>
  );
}

// Breadcrumb - COMPACT
function Breadcrumb({ pathname }: { pathname: string }) {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  return (
    <div className="hidden sm:flex items-center gap-1.5 text-xs">
      {segments.map((segment, index) => {
        const label = BREADCRUMB_LABELS[segment] || segment;
        const isLast = index === segments.length - 1;

        return (
          <React.Fragment key={segment}>
            <span
              className={cn(
                "text-xs font-medium",
                isLast
                  ? "text-gray-900 dark:text-white"
                  : "text-gray-500 dark:text-gray-400"
              )}
            >
              {label}
            </span>
            {!isLast && (
              <span className="text-gray-300 dark:text-gray-600 text-[10px]">/</span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// Mobile Menu Button - COMPACT
function MobileMenuButton({ onClick }: { onClick?: () => void }) {
  return (
    <Button variant="ghost" size="icon" className="md:hidden w-7 h-7" onClick={onClick}>
      <Menu size={16} />
    </Button>
  );
}

/** 专业顶部栏 - COMPACT */
export function SaasTopBar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { toggleLeft, toggleRight } = useWorkbenchChrome();
  const { user } = useAuth();
  const location = useLocation();
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const analysisWorkbenchNoLeft =
    location.pathname === "/analysis" || location.pathname.startsWith("/analysis/");
  /** 市场 / DailyAPI 工作台无右侧栏，不展示 Panel Right */
  const marketWorkbenchNoRight =
    location.pathname === "/market" || location.pathname.startsWith("/market/");
  const dailyWorkbenchNoRight =
    location.pathname === "/daily-selection" || location.pathname === "/expert-analysis";

  return (
    <>
    <header className="sticky top-0 z-30 w-full h-[44px] bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-between h-full px-3 gap-2">
        {/* 左侧区域 - 左侧边栏控制按钮在最前面 */}
        <div className="flex items-center gap-2">
          <MobileMenuButton onClick={onMenuClick} />
          {!analysisWorkbenchNoLeft ? (
            <Button variant="ghost" size="icon" className="w-7 h-7 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" onClick={toggleLeft}>
              <PanelLeft size={15} />
            </Button>
          ) : null}
          <div className="hidden md:block h-4 w-px bg-gray-200 dark:bg-gray-800" />
          <WorkspaceSwitcher />
          <div className="hidden md:block h-4 w-px bg-gray-200 dark:bg-gray-800" />
          <Breadcrumb pathname={location.pathname} />
        </div>

        {/* 中间搜索区域 — analysis 页使用页面内搜索 */}
        {!(location.pathname === "/analysis" || location.pathname.startsWith("/analysis/")) ? (
          <SearchBar onClick={() => {}} />
        ) : (
          <div className="hidden md:block flex-1 max-w-md" />
        )}

        {/* 右侧区域 - 右侧边栏控制按钮在最后面 */}
        <div className="flex items-center gap-0.5">
          <QuickActions onOpenSettings={() => setSettingsOpen(true)} />
          <div className="h-4 w-px bg-gray-200 dark:bg-gray-800 mx-1" />

          {/* 右侧边栏控制按钮（市场页无右栏，不展示） */}
          {!(marketWorkbenchNoRight || dailyWorkbenchNoRight) ? (
            <Button variant="ghost" size="icon" className="w-7 h-7 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" onClick={toggleRight}>
              <PanelRight size={15} />
            </Button>
          ) : null}

          {/* 当前用户展示（不作为退出入口） */}
          <div
            className="flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-lg"
            title={user?.name ? user.name : undefined}
          >
            <div className="relative">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white text-[11px] font-semibold">
                {user?.name?.charAt(0) || "Q"}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-white dark:border-gray-950 bg-emerald-500" />
            </div>
            <div className="hidden sm:flex flex-col items-start">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 leading-tight">
                {user?.name || "量化交易员"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
    <WorkbenchSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
