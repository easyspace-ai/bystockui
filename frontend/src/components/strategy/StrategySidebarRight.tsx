import * as React from "react";
import { Sparkles, X, Wand2, Send, Circle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function StrategySidebarRight() {
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 border-l border-slate-200/50 dark:border-slate-800/50">
      <div className="p-4 flex items-center justify-between bg-white dark:bg-slate-900 border-b border-slate-200/50 dark:border-slate-800/50">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-blue-500" fill="currentColor" />
          <h2 className="font-bold text-sm text-slate-900 dark:text-white">AI Assistant</h2>
        </div>
        <button className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors">
          <X size={16} className="text-slate-500" />
        </button>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6">
          {/* AI Feedback Card */}
          <div className="bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl p-4 border border-blue-100/50 dark:border-blue-800/20">
            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest block mb-2">Optimization Suggestion</span>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-snug mb-4">
              Your <code className="bg-white dark:bg-slate-800 px-1 rounded border border-slate-200 dark:border-slate-700 font-mono text-[11px]">on_data</code> method is recalculating EMA on every tick. Consider using a sliding window for performance.
            </p>
            <Button variant="outline" size="sm" className="w-full bg-white dark:bg-slate-800 text-[10px] font-bold uppercase tracking-wider h-9 gap-2 border-slate-200 dark:border-slate-700">
              <Wand2 size={12} />
              Apply Refactor
            </Button>
          </div>

          {/* Market Intelligence */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200/50 dark:border-slate-800/50">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-4">Live Risk Context</span>
            <div className="flex items-center justify-between mb-4">
              <div className="flex flex-col">
                <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">14.2%</span>
                <span className="text-[10px] text-slate-500 font-medium">Current Volatility</span>
              </div>
              <div className="w-12 h-12 rounded-full border-2 border-slate-200 dark:border-slate-800 border-t-blue-500 flex items-center justify-center">
                <span className="text-[10px] font-bold text-slate-900 dark:text-white">L-R</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 italic leading-relaxed">
              Market regime detected as 'Mean Reverting'. Momentum strategies may underperform.
            </p>
          </div>

          {/* Activity Log */}
          <div className="space-y-4">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Activity Log</span>
            <div className="space-y-4">
              <LogItem time="14:22" text="Auto-save completed" subtext="Revision 8292-X" />
              <LogItem time="14:10" text="Backtest finished" subtext="SR: 1.42 | DD: -4.2%" highlight />
              <LogItem time="12:05" text="Code refactored" subtext="Manual update by user" muted />
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Assistant Input */}
      <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200/50 dark:border-slate-800/50">
        <div className="relative">
          <input 
            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl pl-4 pr-10 py-3 text-xs focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500" 
            placeholder="Ask AI to optimize..." 
            type="text"
          />
          <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all">
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function LogItem({ 
  time, 
  text, 
  subtext, 
  highlight, 
  muted 
}: { 
  time: string; 
  text: string; 
  subtext?: string; 
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={cn("flex gap-3 text-xs", muted && "opacity-50")}>
      <span className="text-[10px] text-slate-400 font-mono mt-0.5 shrink-0">{time}</span>
      <div className="flex flex-col gap-0.5">
        <p className="text-slate-900 dark:text-slate-200 font-semibold">{text}</p>
        {subtext && (
          <p className={cn(
            "text-[10px]",
            highlight ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-slate-500"
          )}>
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
}
