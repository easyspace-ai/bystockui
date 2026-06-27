import * as React from "react";
import { 
  Settings, 
  History, 
  Play, 
  Calendar, 
  ChevronDown, 
  Info,
  DollarSign,
  BarChart3
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SidebarTab = "config" | "history";

export function BacktestSidebarLeft() {
  const [activeTab, setActiveTab] = React.useState<SidebarTab>("history");

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 border-r border-slate-200/50 dark:border-slate-800/50">
      {/* Sidebar Header */}
      

      {/* Tabs Header */}
      <div className="flex p-1 bg-slate-200/50 dark:bg-slate-900 mx-4 mb-4 rounded-xl">
        <button
          onClick={() => setActiveTab("config")}
          className={cn(
            "flex-1 py-2 text-[10px] font-bold rounded-lg transition-all uppercase tracking-wider",
            activeTab === "config" 
              ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" 
              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          参数配置
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={cn(
            "flex-1 py-2 text-[10px] font-bold rounded-lg transition-all uppercase tracking-wider",
            activeTab === "history" 
              ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" 
              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          历史列表
        </button>
      </div>

      <ScrollArea className="flex-1 px-4">
        {activeTab === "config" ? (
          <div className="space-y-6 pb-8 px-2">
            {/* Ticker Selection */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">标的代码</label>
              <div className="relative">
                <input 
                  type="text" 
                  defaultValue="600519.SH"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-bold focus:ring-1 focus:ring-blue-500 transition-all outline-none"
                />
              </div>
              <p className="text-[10px] text-slate-400">支持 A股、港股、美股标的</p>
            </div>

            {/* Strategy Selection */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">策略选择</label>
              <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-bold flex items-center justify-between cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                <span>均线交叉增强策略 V2.1</span>
                <ChevronDown size={16} className="text-slate-400" />
              </div>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">开始日期</label>
                <div className="relative">
                  <input 
                    type="text" 
                    defaultValue="2023-01-01"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-4 pr-10 py-3 text-xs font-bold outline-none"
                  />
                  <Calendar size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">结束日期</label>
                <div className="relative">
                  <input 
                    type="text" 
                    defaultValue="2023-12-31"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-4 pr-10 py-3 text-xs font-bold outline-none"
                  />
                  <Calendar size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
            </div>

            {/* Initial Capital */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">初始资金 (CNY)</label>
              <div className="relative">
                <input 
                  type="text" 
                  defaultValue="1,000,000"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-4 pr-10 py-3 text-sm font-bold outline-none"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">元</span>
              </div>
            </div>

            {/* Start Button */}
            <Button className="w-full py-6 bg-slate-900 dark:bg-white text-white dark:text-black hover:opacity-90 rounded-2xl font-black text-sm uppercase tracking-[0.2em] gap-3 shadow-xl shadow-slate-200 dark:shadow-none transition-all active:scale-95">
              <Play size={18} fill="currentColor" />
              开始回测
            </Button>
          </div>
        ) : (
          <div className="space-y-3 pb-8">
            <HistoryItem 
              title="均线交叉增强策略 V2.1" 
              ticker="600519.SH" 
              dateRange="2023.01.01 - 2023.12.31" 
              status="completed"
              active
            />
            <HistoryItem 
              title="高频动能回归模型" 
              ticker="300750.SZ" 
              dateRange="2024.01.01 - 至今" 
              status="running"
            />
            <HistoryItem 
              title="多因子Alpha轮动策略" 
              ticker="000001.SZ" 
              dateRange="2022.06.01 - 2023.06.01" 
              status="failed"
            />
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function HistoryItem({ 
  title, 
  ticker, 
  dateRange, 
  status,
  active 
}: { 
  title: string; 
  ticker: string; 
  dateRange: string; 
  status: "completed" | "running" | "failed";
  active?: boolean;
}) {
  const statusConfig = {
    completed: { label: "已完成", color: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
    running: { label: "运行中", color: "bg-blue-500", text: "text-blue-700 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/30" },
    failed: { label: "失败", color: "bg-rose-500", text: "text-rose-700 dark:text-rose-400", bg: "bg-rose-100 dark:bg-rose-900/30" },
  };

  const config = statusConfig[status];

  return (
    <div className={cn(
      "p-4 rounded-2xl border transition-all cursor-pointer group",
      active 
        ? "bg-white dark:bg-slate-900 border-slate-900/10 dark:border-white/10 shadow-sm" 
        : "bg-transparent border-transparent hover:bg-white dark:hover:bg-slate-900/50 hover:border-slate-200 dark:hover:border-slate-800"
    )}>
      <div className="flex justify-between items-start mb-2">
        <span className="text-sm font-black text-slate-900 dark:text-white tracking-tight">{ticker}</span>
        <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-full", config.bg)}>
          <div className={cn("w-1.5 h-1.5 rounded-full", config.color, status === "running" && "animate-pulse")} />
          <span className={cn("text-[9px] font-bold uppercase tracking-wider", config.text)}>{config.label}</span>
        </div>
      </div>
      <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{title}</h4>
      <p className="text-[10px] text-slate-400 font-medium">{dateRange}</p>
    </div>
  );
}
