import * as React from "react";
import { 
  Search, 
  Bell, 
  Layout, 
  ChevronLeft, 
  ChevronRight, 
  ArrowUpRight, 
  ArrowDownRight 
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function MarketPage() {
  const tabs = [
    { id: "gainers", label: "行业涨幅排名", active: true },
    { id: "capital", label: "行业资金排名" },
    { id: "csrc", label: "证监会行业" },
    { id: "concept", label: "概念板块" },
  ];

  const data = [
    { name: "半导体设备", change: "+4.82%", fiveDay: "+8.15%", twentyDay: "+12.40%", leader: "北方华创", leaderChange: "+7.12%" },
    { name: "白酒", change: "+2.35%", fiveDay: "-1.10%", twentyDay: "+4.55%", leader: "贵州茅台", leaderChange: "+2.15%" },
    { name: "创新药", change: "-1.12%", fiveDay: "-3.45%", twentyDay: "+2.10%", leader: "恒瑞医药", leaderChange: "+0.45%" },
    { name: "新能源车", change: "+3.15%", fiveDay: "+5.20%", twentyDay: "-0.85%", leader: "比亚迪", leaderChange: "+4.22%" },
    { name: "光伏设备", change: "-0.85%", fiveDay: "+2.15%", twentyDay: "-15.40%", leader: "隆基绿能", leaderChange: "-1.20%" },
  ];

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950">
      {/* Page Header */}
      <div className="px-8 py-6 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-xl sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-all">
            <Layout size={18} className="text-slate-500" />
          </button>
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <span>市场路由</span>
            <ChevronRight size={10} />
            <span>MARKET</span>
            <ChevronRight size={10} />
            <span className="text-slate-900 dark:text-white">行业排名</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="relative w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              className="w-full bg-slate-200/50 dark:bg-slate-800/50 border-none rounded-xl pl-10 pr-4 py-2 text-xs focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-500" 
              placeholder="搜索行业或代码..." 
              type="text"
            />
          </div>
          <button className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-all relative">
            <Bell size={18} className="text-slate-500" />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900" />
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-8 max-w-6xl mx-auto space-y-8">
          {/* Title Section */}
          <div className="flex items-end justify-between">
            <div className="space-y-2">
              <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">行业排名</h1>
              <p className="text-sm text-slate-500 font-medium tracking-tight">实时追踪全行业涨跌幅与资金流向动态</p>
            </div>
            
            <div className="flex p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={cn(
                    "px-4 py-2 text-[10px] font-bold rounded-lg transition-all uppercase tracking-wider",
                    tab.active 
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" 
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table Section */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="px-8 py-6 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">行业名称</th>
                  <th className="px-8 py-6 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">行业涨幅</th>
                  <th className="px-8 py-6 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">5日涨幅</th>
                  <th className="px-8 py-6 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">20日涨幅</th>
                  <th className="px-8 py-6 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">领涨股</th>
                  <th className="px-8 py-6 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">涨幅</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {data.map((row, idx) => (
                  <tr key={idx} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all cursor-pointer">
                    <td className="px-8 py-6">
                      <span className="text-sm font-black text-slate-900 dark:text-white tracking-tight">{row.name}</span>
                    </td>
                    <td className="px-8 py-6">
                      <div className={cn(
                        "flex items-center gap-1 text-sm font-black tracking-tight",
                        row.change.startsWith("+") ? "text-rose-500" : "text-emerald-500"
                      )}>
                        {row.change.startsWith("+") ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {row.change}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={cn(
                        "text-sm font-bold tracking-tight",
                        row.fiveDay.startsWith("+") ? "text-rose-500" : "text-emerald-500"
                      )}>{row.fiveDay}</span>
                    </td>
                    <td className="px-8 py-6">
                      <span className={cn(
                        "text-sm font-bold tracking-tight",
                        row.twentyDay.startsWith("+") ? "text-rose-500" : "text-emerald-500"
                      )}>{row.twentyDay}</span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">{row.leader}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={cn(
                        "text-sm font-black tracking-tight",
                        row.leaderChange.startsWith("+") ? "text-rose-500" : "text-emerald-500"
                      )}>{row.leaderChange}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination / Footer */}
            <div className="px-8 py-6 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">UPDATE: 2023-10-27 15:00:00 CST</span>
              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-all text-slate-400">
                  <ChevronLeft size={16} />
                </button>
                <button className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-all text-slate-400">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
