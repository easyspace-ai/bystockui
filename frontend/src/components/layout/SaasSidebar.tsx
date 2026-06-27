import * as React from "react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  Database,
  Filter,
  History,
  Layers,
  LogOut,
  TrendingUp,
  Zap,
  CalendarRange,
  Microscope,
  Crown,
} from "lucide-react";
import { WORKBENCH_PREFIX, type WorkbenchTab } from "@/lib/workbenchRoutes";

export type TabType = WorkbenchTab;

interface SaasSidebarProps {
  /** 退出登录并应跳转至登录页（由外层处理导航） */
  onLogout: () => void;
  /** 是否折叠状态 */
  collapsed?: boolean;
}

// 导航项配置
const NAV_ITEMS = [
  {
    id: "analysis" as const,
    to: WORKBENCH_PREFIX.analysis,
    icon: Sparkles,
    label: "AI 分析",
    description: "智能分析与洞察",
  },
  // {
  //   id: "daily-selection" as const,
  //   to: "/daily-selection",
  //   icon: CalendarRange,
  //   label: "每日选股",
  //   description: "DailyAPI 精选列表",
  // },
  // {
  //   id: "expert-analysis" as const,
  //   to: "/expert-analysis",
  //   icon: Microscope,
  //   label: "专家分析",
  //   description: "自选持仓深度诊断",
  // },
   {
    id: "picker" as const,
    to: WORKBENCH_PREFIX.picker,
    icon: Filter,
    label: "智能选股",
    description: "多维度筛选",
  },
  {
    id: "hotmoney" as const,
    to: WORKBENCH_PREFIX.hotmoney,
    icon: Crown,
    label: "游资大佬看盘",
    description: "AI 生成 HTML 报告",
  },
  {
    id: "market" as const,
    to: WORKBENCH_PREFIX.market,
    icon: Database,
    label: "市场数据",
    description: "实时市场行情",
  },
 
  // {
  //   id: "backtest" as const,
  //   to: WORKBENCH_PREFIX.backtest,
  //   icon: History,
  //   label: "策略回测",
  //   description: "历史回测验证",
  // },
  // {
  //   id: "strategies" as const,
  //   to: WORKBENCH_PREFIX.strategies,
  //   icon: Layers,
  //   label: "策略管理",
  //   description: "策略库管理",
  // },
] as const;

// Logo 组件 - COMPACT
function Logo({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5">
      <div className="relative">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-700 to-blue-800 flex items-center justify-center shadow-sm shadow-blue-700/20">
          <TrendingUp size={15} className="text-white" />
        </div>
        {!collapsed && (
          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-900 bg-emerald-500" />
        )}
      </div>
      {!collapsed && (
        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-tight text-gray-900 dark:text-white leading-tight">
            Quantum
          </span>
          <span className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight -mt-0.5">
            Pro Platform
          </span>
        </div>
      )}
    </div>
  );
}

// 导航项组件 - COMPACT
function NavItem({
  to,
  icon: Icon,
  label,
  description,
  collapsed,
}: {
  to: string;
  icon: any;
  label: string;
  description?: string;
  collapsed: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={to === "/analysis"}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center gap-2 mx-1.5 px-2 py-1.5 rounded-md transition-all duration-150",
          isActive
            ? "bg-gradient-to-r from-blue-50 to-blue-50/50 dark:from-blue-500/10 dark:to-blue-500/5 text-blue-700 dark:text-blue-300 shadow-sm"
            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-200"
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* 选中指示器 - Slim */}
          {isActive && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-gradient-to-b from-blue-600 to-blue-700 rounded-r-full" />
          )}

          {/* 图标 - Smaller */}
          <div
            className={cn(
              "flex items-center justify-center w-7 h-7 rounded-md transition-all duration-150",
              isActive
                ? "bg-blue-700 text-white shadow-sm shadow-blue-700/20"
                : "text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 group-hover:bg-gray-200 dark:group-hover:bg-gray-700"
            )}
          >
            <Icon size={16} strokeWidth={isActive ? 2.2 : 2} />
          </div>

          {/* 文本 - Compact */}
          {!collapsed && (
            <div className="flex flex-col">
              <span
                className={cn(
                  "text-xs font-semibold leading-tight",
                  isActive ? "text-blue-700 dark:text-blue-300" : "text-gray-700 dark:text-gray-300"
                )}
              >
                {label}
              </span>
              {description && (
                <span className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">
                  {description}
                </span>
              )}
            </div>
          )}

          {/* 折叠状态下的 Tooltip */}
          {collapsed && (
            <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 delay-75">
              <div className="px-2.5 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-medium rounded-md shadow-lg whitespace-nowrap">
                {label}
                {description && (
                  <div className="text-[10px] text-gray-400 dark:text-gray-500 font-normal">
                    {description}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </NavLink>
  );
}

// 分隔线 - Thinner
function Divider() {
  return <div className="mx-3 my-2 h-px bg-gray-200 dark:bg-gray-800" />;
}

// 升级卡片 - COMPACT
function UpgradeCard({ collapsed }: { collapsed: boolean }) {
  if (collapsed) return null;

  return (
    <div className="mx-2.5 mb-2.5">
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 p-3 text-white">
        <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full bg-white/10" />
        <div className="absolute -right-1 -bottom-1 w-10 h-10 rounded-full bg-white/10" />

        <div className="relative">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Zap size={14} className="text-yellow-200" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-yellow-100">
              Pro Plan
            </span>
          </div>
          <p className="text-xs font-medium mb-2.5">
            解锁高级分析功能
          </p>
          <button className="w-full py-1 px-2.5 bg-white text-amber-600 text-[10px] font-semibold rounded-md hover:bg-yellow-50 transition-colors">
            立即升级
          </button>
        </div>
      </div>
    </div>
  );
}

// 底部用户区域 - COMPACT
function UserArea({ collapsed, onLogout }: { collapsed: boolean; onLogout: () => void }) {
  return (
    <div className="mt-auto px-2.5 pb-2.5">
      <div
        className={cn(
          "relative group",
          collapsed ? "flex justify-center" : ""
        )}
      >
        {collapsed ? (
          <button
            onClick={onLogout}
            className="flex items-center justify-center w-8 h-8 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all duration-150"
            title="退出登录"
          >
            <LogOut size={16} />
          </button>
        ) : (
          <div className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors">
            <div className="relative">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white text-xs font-semibold">
                Q
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-900 bg-emerald-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-900 dark:text-white truncate leading-tight">
                量化交易员
              </p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate leading-tight">
                pro@quantum.dev
              </p>
            </div>
            <button
              onClick={onLogout}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-all"
              title="退出登录"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// 主组件 - COMPACT
export function SaasSidebar({
  onLogout,
  collapsed = false,
}: SaasSidebarProps) {
  return (
    <aside
      className={cn(
        "fixed left-0 top-0 bottom-0 z-40 flex flex-col bg-gray-50 dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 transition-all duration-250 ease-[cubic-bezier(0.4,0,0.2,1)]",
        collapsed ? "w-[56px]" : "w-[220px]"
      )}
    >
      {/* Logo 区域 */}
      <div>
        <Logo collapsed={collapsed} />
      </div>

      <Divider />

      {/* 导航列表 */}
      <nav className="flex-1 py-1.5 overflow-hidden">
        <div className="space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.id}
              to={item.to}
              icon={item.icon}
              label={item.label}
              description={item.description}
              collapsed={collapsed}
            />
          ))}
        </div>
      </nav>

      {/* 底部区域 */}
      <div className="mt-auto">
        <Divider />
        <UpgradeCard collapsed={collapsed} />
        <UserArea collapsed={collapsed} onLogout={onLogout} />
      </div>
    </aside>
  );
}
