import { ShieldCheck } from "lucide-react";

export function DashboardMetrics() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <MetricCard 
        label="Total Return" 
        value="214.8%" 
        subValue="+12.4% vs Bench" 
        trend="up" 
      />
      <MetricCard 
        label="Sharpe Ratio" 
        value="2.84" 
        subValue="Premium Alpha" 
        highlight 
      />
      <MetricCard 
        label="Max Drawdown" 
        value="-8.22%" 
        subValue="Q3 2023 Recovery" 
        trend="down" 
      />
    </div>
  );
}

function MetricCard({ 
  label, 
  value, 
  subValue, 
  trend, 
  highlight 
}: { 
  label: string; 
  value: string; 
  subValue: string; 
  trend?: "up" | "down";
  highlight?: boolean;
}) {
  return (
    <div className={`p-8 rounded-3xl shadow-sm border flex flex-col gap-3 transition-all duration-300 hover:shadow-md ${
      highlight 
        ? "bg-white dark:bg-slate-900 border-l-8 border-l-black dark:border-l-white border-slate-200/50 dark:border-slate-800/50" 
        : "bg-white dark:bg-slate-900 border-slate-200/50 dark:border-slate-800/50"
    }`}>
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </span>
      <div className="flex flex-col gap-1">
        <span className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white">
          {value}
        </span>
        <div className="flex items-center gap-2">
          {highlight ? (
            <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
              {subValue}
            </span>
          ) : (
            <span className={`text-[10px] font-bold uppercase tracking-wider ${
              trend === "up" ? "text-emerald-600 dark:text-emerald-400" : 
              trend === "down" ? "text-rose-600 dark:text-rose-400" : "text-slate-500"
            }`}>
              {subValue}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function TradeDistribution() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-slate-50 dark:bg-slate-900/50 p-8 rounded-3xl border border-slate-200/50 dark:border-slate-800/50">
        <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-6">
          Trade Distribution
        </h4>
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm font-bold">
              <span className="text-slate-600 dark:text-slate-400">Winning Trades</span>
              <span className="text-emerald-600 dark:text-emerald-400">68%</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
              <div className="bg-emerald-500 h-full w-[68%] rounded-full" />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="flex justify-between items-center text-sm font-bold border-t border-slate-200 dark:border-slate-800 pt-4">
              <span className="text-slate-600 dark:text-slate-400">Profit Factor</span>
              <span className="text-slate-900 dark:text-white">2.44</span>
            </div>
            <div className="flex justify-between items-center text-sm font-bold border-t border-slate-200 dark:border-slate-800 pt-4">
              <span className="text-slate-600 dark:text-slate-400">Recovery Factor</span>
              <span className="text-slate-900 dark:text-white">14.1</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-50 dark:bg-slate-900/50 p-8 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 flex flex-col justify-center items-center text-center gap-4">
        <div className="bg-black dark:bg-white p-3 rounded-2xl shadow-lg">
          <ShieldCheck size={32} className="text-white dark:text-black" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
            Robustness Score: High
          </h4>
          <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-[240px]">
            The strategy exhibits low sensitivity to parameter drift across Monte Carlo simulations.
          </p>
        </div>
      </div>
    </div>
  );
}
