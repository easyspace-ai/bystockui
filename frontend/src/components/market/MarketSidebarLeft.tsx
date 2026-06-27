import * as React from "react";
import { 
  Plus, 
  Newspaper, 
  Globe, 
  TrendingUp, 
  BarChart2, 
  ArrowRightLeft, 
  ListOrdered,
  Lightbulb,
  ShieldAlert
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MarketSidebarLeft() {
  const menuItems = [
    { icon: <Newspaper size={16} />, label: "市场快讯" },
    { icon: <Globe size={16} />, label: "全球股指" },
    { icon: <TrendingUp size={16} />, label: "重大指数" },
    { icon: <BarChart2 size={16} />, label: "行业排名", active: true },
    { icon: <ArrowRightLeft size={16} />, label: "个股资金流向" },
    { icon: <ListOrdered size={16} />, label: "龙虎榜" },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      <div className="p-6 pb-2">
        <div className="mb-6">
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">九立米投研平台</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">QUANT PRO PRISM</p>
          <p className="text-[10px] text-slate-400 italic mt-0.5">量化九章，立米而见</p>
        </div>

        <Button className="w-full py-6 bg-black dark:bg-white text-white dark:text-black hover:opacity-90 rounded-xl font-black text-xs uppercase tracking-[0.2em] gap-2 shadow-xl shadow-slate-200 dark:shadow-none mb-8">
          <Plus size={16} />
          NEW ANALYSIS
        </Button>

        <div className="space-y-1">
          <h3 className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">市场行情</h3>
          {menuItems.map((item, idx) => (
            <button
              key={idx}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all",
                item.active 
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm" 
                  : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900/50"
              )}
            >
              <span className={item.active ? "text-blue-500" : "text-slate-400"}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto p-6 space-y-1 border-t border-slate-200/50 dark:border-slate-800/50">
        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900/50 transition-all">
          <Lightbulb size={16} className="text-slate-400" />
          AI Insights
        </button>
        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900/50 transition-all">
          <ShieldAlert size={16} className="text-slate-400" />
          Risk Monitor
        </button>
      </div>
    </div>
  );
}
