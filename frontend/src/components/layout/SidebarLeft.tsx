import * as React from "react";
import { Plus, Bolt, BarChart3, Wallet, Lock } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function SidebarLeft() {
  return (
    <ScrollArea className="flex-1">
      <div className="p-6 flex flex-col gap-8">
        {/* Strategy Registry */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              Strategy Registry
            </h3>
            <button className="text-slate-400 hover:text-slate-900 transition-colors">
              <Plus size={14} />
            </button>
          </div>
          
          <div className="space-y-1">
            <StrategyItem 
              icon={<Bolt size={16} className="text-emerald-500" fill="currentColor" />} 
              label="Trend Following V2" 
              active 
            />
            <StrategyItem 
              icon={<BarChart3 size={16} className="text-slate-400" />} 
              label="Mean Reversion Alpha" 
            />
            <StrategyItem 
              icon={<Wallet size={16} className="text-slate-400" />} 
              label="Volatility Arb (HFT)" 
            />
          </div>
        </div>

        {/* Asset Universe */}
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-4">
            Asset Universe
          </h3>
          <div className="bg-slate-100/50 dark:bg-slate-800/30 rounded-xl p-3 space-y-3">
            <AssetItem pair="BTC / USD" change="+2.4%" />
            <AssetItem pair="ETH / USD" change="+1.8%" />
            <AssetItem pair="SOL / USD" locked />
          </div>
        </div>

        {/* Backtest JSON */}
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-4">
            Backtest JSON
          </h3>
          <div className="bg-slate-900 text-slate-300 p-4 rounded-xl font-mono text-[11px] leading-relaxed shadow-inner overflow-x-auto">
            <pre className="whitespace-pre-wrap">
{`{
  "lookback": 252,
  "vol_target": 0.15,
  "leverage": 1.5,
  "fees": 0.0002,
  "stop_loss": {
    "trailing": true,
    "delta": 0.04
  }
}`}
            </pre>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

function StrategyItem({ icon, label, active }: { icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <div className={cn(
      "p-3 rounded-xl flex items-center gap-3 cursor-pointer transition-all duration-200",
      active 
        ? "bg-white dark:bg-slate-800 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700" 
        : "hover:bg-slate-100 dark:hover:bg-slate-800/50"
    )}>
      {icon}
      <span className={cn("text-sm font-semibold", active ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400")}>
        {label}
      </span>
    </div>
  );
}

function AssetItem({ pair, change, locked }: { pair: string; change?: string; locked?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between text-xs", locked && "opacity-50")}>
      <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{pair}</span>
      {locked ? (
        <Lock size={10} className="text-slate-400" />
      ) : (
        <span className="text-emerald-600 dark:text-emerald-400 font-bold">{change}</span>
      )}
    </div>
  );
}
