import * as React from "react";
import { Lightbulb, History, Zap, Circle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ScreenerSidebarRight() {
  return (
    <ScrollArea className="flex-1 bg-slate-50 dark:bg-slate-950 border-l border-slate-200/50 dark:border-slate-800/50">
      <div className="p-6 flex flex-col gap-8">
        {/* AI Screening Insights */}
        <section className="space-y-4">
          <h3 className="font-bold text-[10px] uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
            <Lightbulb size={14} className="text-blue-500" fill="currentColor" />
            AI Screening Insights
          </h3>
          <div className="space-y-3">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm space-y-2 border-l-4 border-emerald-500 border border-slate-200/50 dark:border-slate-800/50">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Top Ranked</span>
                <span className="text-[10px] font-mono text-slate-400">Just now</span>
              </div>
              <p className="text-xs leading-relaxed font-medium text-slate-700 dark:text-slate-300">
                AAPL shows significant institutional buy orders at the $188.50 level. Volume trend suggests late session breakout.
              </p>
              <div className="flex gap-2 pt-2">
                <span className="bg-slate-100 dark:bg-slate-800 text-[9px] font-bold text-slate-500 px-2 py-0.5 rounded uppercase tracking-wider">Bullish</span>
                <span className="bg-slate-100 dark:bg-slate-800 text-[9px] font-bold text-slate-500 px-2 py-0.5 rounded uppercase tracking-wider">High Vol</span>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm space-y-2 border border-slate-200/50 dark:border-slate-800/50">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sector Insight</span>
                <span className="text-[10px] font-mono text-slate-400">12m ago</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                Semiconductors exhibiting strong sector rotation pattern. Focus on NVDA and AMD for remaining session.
              </p>
            </div>
          </div>
        </section>

        {/* Recent Activity */}
        <section className="space-y-4">
          <h3 className="font-bold text-[10px] uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
            <History size={14} className="text-slate-400" />
            Recent Activity
          </h3>
          <div className="space-y-4">
            <ActivityItem 
              title="Value Scan Executed" 
              subtext="14 stocks filtered using 'Deep Value' strategy" 
            />
            <ActivityItem 
              title="Alert: Breakout Detected" 
              subtext="TSLA breached resistance at $175.40" 
            />
          </div>
        </section>

        {/* Real-time Alerts Panel */}
        <section className="mt-auto pt-8">
          <div className="bg-slate-900 text-white p-6 rounded-3xl relative overflow-hidden shadow-xl">
            <Zap size={64} className="absolute -right-4 -bottom-4 text-white opacity-5" />
            <h4 className="font-black text-sm mb-4 uppercase tracking-widest">Quant Signals</h4>
            <div className="space-y-3 relative z-10">
              <div className="text-[10px] flex items-center justify-between opacity-80 border-b border-white/10 pb-2">
                <span className="font-bold uppercase tracking-wider">Volatility Index</span>
                <span className="font-mono text-blue-400">16.42 (+1.2%)</span>
              </div>
              <div className="text-[10px] flex items-center justify-between opacity-80 border-b border-white/10 pb-2">
                <span className="font-bold uppercase tracking-wider">S&P 500 Sentiment</span>
                <span className="font-mono text-emerald-400">Extremely Greedy</span>
              </div>
            </div>
            <Button variant="outline" className="w-full mt-6 py-2 border-white/20 hover:bg-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest h-10 transition-all">
              Configure Notifications
            </Button>
          </div>
        </section>
      </div>
    </ScrollArea>
  );
}

function ActivityItem({ title, subtext }: { title: string; subtext: string }) {
  return (
    <div className="flex gap-3">
      <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mt-1.5 shrink-0"></div>
      <div>
        <p className="text-xs font-bold text-slate-900 dark:text-slate-200">{title}</p>
        <p className="text-[10px] text-slate-500 leading-relaxed">{subtext}</p>
      </div>
    </div>
  );
}
