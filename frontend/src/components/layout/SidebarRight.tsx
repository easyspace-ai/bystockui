import { Sparkles, Share2, Circle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function SidebarRight() {
  return (
    <ScrollArea className="flex-1">
      <div className="p-6 flex flex-col gap-8">
        {/* AI Insights Panel */}
        <div className="bg-black dark:bg-white text-white dark:text-black p-6 rounded-2xl shadow-xl flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-blue-400" fill="currentColor" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">
              AI Insight Engine
            </span>
          </div>
          <p className="text-sm leading-relaxed font-medium">
            The current strategy outperforms during low-volatility regimes but faces significant friction during 
            <span className="text-blue-400 font-bold ml-1">VIX spikes &gt; 25.</span>
          </p>
          <Button variant="secondary" size="sm" className="w-full bg-white/10 hover:bg-white/20 border-none text-white dark:text-black text-[10px] font-bold uppercase tracking-wider h-9">
            Request Optimization Plan
          </Button>
        </div>

        {/* System Logs */}
        <div className="flex flex-col gap-4">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
            System Logs
          </h3>
          <div className="space-y-4 font-mono text-[10px]">
            <LogItem time="14:22:01" text="Fetching OHLCV data for BTC/USD..." />
            <LogItem time="14:22:05" text="Initializing 15,000 simulations..." />
            <LogItem time="14:22:12" text="Backtest complete. Sharpe Ratio: 2.84" highlight />
            <LogItem time="14:23:45" text="Storing results to secure cloud..." />
            <LogItem time="14:24:00" text="Cache cleared. Idle." />
          </div>
        </div>

        {/* Footer Interaction */}
        <div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-[10px] mb-6">
            <span className="text-slate-500 font-bold uppercase tracking-wider">Engine Status</span>
            <span className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
              <Circle size={8} fill="currentColor" />
              OPERATIONAL
            </span>
          </div>
          <Button variant="outline" className="w-full rounded-xl font-bold text-[10px] uppercase tracking-wider gap-2 h-11 border-slate-200 dark:border-slate-700">
            <Share2 size={14} />
            Export Report (PDF)
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
}

function LogItem({ time, text, highlight }: { time: string; text: string; highlight?: boolean }) {
  return (
    <div className="flex gap-3 group">
      <span className="text-slate-400 shrink-0">[{time}]</span>
      <span className={highlight ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-slate-600 dark:text-slate-400"}>
        {text}
      </span>
    </div>
  );
}
