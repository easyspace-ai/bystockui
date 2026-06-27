import * as React from "react";
import { Plus, Clock, Zap, Bell, DollarSign } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function ScreenerSidebarLeft() {
  const [activeFilter, setActiveFilter] = React.useState("Late Session Selection");

  const filters = [
    { name: "Late Session Selection", icon: <Clock size={16} />, active: true },
    { name: "Monster Stock Scan", icon: <Zap size={16} /> },
    { name: "Breakout Alerts", icon: <Bell size={16} /> },
    { name: "Value Screen", icon: <DollarSign size={16} /> },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      <div className="p-6 pb-2">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white">Strategies</h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Saved Filters</p>
          </div>
          <button className="text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded uppercase tracking-wider hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
            New Strategy
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1 px-6">
        <div className="space-y-1 pb-6">
          {filters.map((filter) => (
            <button
              key={filter.name}
              onClick={() => setActiveFilter(filter.name)}
              className={cn(
                "w-full flex items-center gap-3 p-3 text-sm rounded-xl transition-all text-left group",
                activeFilter === filter.name
                  ? "bg-white dark:bg-slate-900 shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 text-slate-900 dark:text-white font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900/50"
              )}
            >
              <span className={cn(
                "shrink-0 transition-colors",
                activeFilter === filter.name ? "text-blue-500" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"
              )}>
                {filter.icon}
              </span>
              <span className="truncate">{filter.name}</span>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
