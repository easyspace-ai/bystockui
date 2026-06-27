import * as React from "react";
import { 
  Sparkles, 
  AlertTriangle, 
  TrendingUp, 
  ShieldCheck, 
  Zap, 
  Info,
  Activity,
  BarChart3
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function BacktestSidebarRight() {
  return (
    <ScrollArea className="flex-1 bg-slate-50 dark:bg-slate-950 border-l border-slate-200/50 dark:border-slate-800/50">
      <div className="p-6 flex flex-col gap-8">
        {/* AI Strategy Review */}
        <section className="space-y-4">
          <h3 className="font-bold text-[10px] uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
            <Sparkles size={14} className="text-blue-500" fill="currentColor" />
            AI 策略点评
          </h3>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200/50 dark:border-slate-800/50 space-y-4">
            <p className="text-xs leading-relaxed font-medium text-slate-700 dark:text-slate-300">
              基于本次回测数据，该策略表现出极强的 <span className="text-blue-600 dark:text-blue-400 font-bold">趋势跟踪能力</span>。在 Q2-Q4 的震荡上行行情中捕捉到了核心波段。
            </p>
            <div className="space-y-3">
              <ReviewPoint 
                icon={<ShieldCheck size={14} className="text-emerald-500" />} 
                text="收益稳定性优于 85% 的同类双均线配置。" 
              />
              <ReviewPoint 
                icon={<TrendingUp size={14} className="text-emerald-500" />} 
                text="夏普比率 2.14 显示其风险收益比极佳。" 
              />
            </div>
          </div>
        </section>

        {/* Risk Analysis */}
        <section className="space-y-4">
          <h3 className="font-bold text-[10px] uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
            <AlertTriangle size={14} className="text-rose-500" />
            当前风险分析
          </h3>
          <div className="space-y-4">
            {/* Overfitting Warning */}
            <div className="bg-rose-50/50 dark:bg-rose-900/10 p-4 rounded-2xl border-l-4 border-rose-500 border border-slate-200/50 dark:border-slate-800/50">
              <h4 className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest mb-2">过拟合警示</h4>
              <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                参数“MA20/MA60”在历史数据中表现过于完美，建议进行蒙特卡洛模拟以验证鲁棒性。
              </p>
            </div>

            {/* Liquidity Correlation */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-800/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">市场流动性相关性</span>
                <span className="text-[10px] font-mono text-slate-400">0.74</span>
              </div>
              <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: '74%' }} />
              </div>
              <p className="text-[10px] text-slate-500 italic leading-relaxed">
                策略与沪深300的相关系数为 0.74，需注意系统性风险。
              </p>
            </div>
          </div>
        </section>

        {/* Engine Info */}
        <section className="mt-auto pt-8">
          <div className="bg-slate-900 text-white p-6 rounded-3xl relative overflow-hidden shadow-xl">
            <Zap size={64} className="absolute -right-4 -bottom-4 text-white opacity-5" />
            <div className="relative z-10 text-center space-y-2">
              <h4 className="font-black text-xs uppercase tracking-widest">Quant Pro AI Engine</h4>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Version 2.0 Stable</p>
              <p className="text-[9px] text-slate-500 pt-2">提供智能风控与归因支持</p>
            </div>
          </div>
        </section>
      </div>
    </ScrollArea>
  );
}

function ReviewPoint({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">{text}</p>
    </div>
  );
}
