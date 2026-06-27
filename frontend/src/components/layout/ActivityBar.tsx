import * as React from "react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  Database,
  Filter,
  History,
  Layers,
  UserCircle,
} from "lucide-react";
import { WORKBENCH_PREFIX, type WorkbenchTab } from "@/lib/workbenchRoutes";

export type TabType = WorkbenchTab;

interface ActivityBarProps {
  /** 退出登录并应跳转至登录页（由外层处理导航） */
  onLogout: () => void;
}

export function ActivityBar({ onLogout }: ActivityBarProps) {
  return (
    <aside className="fixed left-0 top-0 bottom-0 z-50 w-20 flex flex-col items-center border-r border-slate-200/50 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-900 py-6">
      <div className="mb-10">
        <NavLink to={WORKBENCH_PREFIX.analysis} className="block">
          <span className="text-xl font-black text-slate-900 dark:text-white tracking-tighter">QP</span>
        </NavLink>
      </div>

      <div className="flex flex-col gap-2 items-center w-full">
        <ActivityNav
          to={WORKBENCH_PREFIX.analysis}
          icon={<Sparkles size={20} />}
          label="分析"
        />
        <ActivityNav
          to={WORKBENCH_PREFIX.market}
          icon={<Database size={20} />}
          label="数据"
        />
        <ActivityNav
          to={WORKBENCH_PREFIX.picker}
          icon={<Filter size={20} />}
          label="选股"
        />
        <ActivityNav
          to={WORKBENCH_PREFIX.backtest}
          icon={<History size={20} />}
          label="回测"
        />
        <ActivityNav
          to={WORKBENCH_PREFIX.strategies}
          icon={<Layers size={20} />}
          label="策略"
        />
      </div>

      <div className="mt-auto flex flex-col gap-2 items-center w-full">
        <ActivityButton icon={<UserCircle size={20} />} label="退出登录" onClick={onLogout} />
      </div>
    </aside>
  );
}

function ActivityNav({
  to,
  icon,
  label,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "w-full flex flex-col items-center justify-center py-4 transition-all duration-200 group relative",
          isActive
            ? "text-slate-900 dark:text-white border-l-2 border-slate-900 dark:border-white bg-white dark:bg-slate-800/50"
            : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/30 border-l-2 border-transparent",
        )
      }
    >
      {({ isActive }) => (
        <>
          <div
            className={cn(
              "mb-1 transition-transform group-active:scale-90",
              isActive ? "scale-110" : "scale-100",
            )}
          >
            {icon}
          </div>
          <span className="text-[10px] font-bold tracking-wider">{label}</span>
        </>
      )}
    </NavLink>
  );
}

function ActivityButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex flex-col items-center justify-center py-4 transition-all duration-200 group relative",
        "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/30 border-l-2 border-transparent",
      )}
    >
      <div className="mb-1 transition-transform group-active:scale-90">{icon}</div>
      <span className="text-[10px] font-bold tracking-wider">{label}</span>
    </button>
  );
}
