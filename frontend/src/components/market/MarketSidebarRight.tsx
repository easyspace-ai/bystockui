import * as React from "react";
import { RefreshCw, Map, AlertTriangle, Zap, Circle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MarketSidebarRight() {
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 border-l border-slate-200/50 dark:border-slate-800/50">
      <div className="p-6 flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/50 bg-white dark:bg-slate-900">
        <h2 className="text-sm font-black text-slate-900 dark:text-white tracking-tight uppercase">侧边摘要</h2>
        <button className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all text-slate-400">
          <RefreshCw size={14} />
        </button>
      </div>

      <ScrollArea className="flex-1 p-6">
        <div className="space-y-8">
          {/* Strategy Suggestions */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <Map size={14} className="text-blue-500" fill="currentColor" />
              MAPPING 策略建议
            </h3>
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border-l-4 border-blue-500 border border-slate-200/50 dark:border-slate-800/50">
                <h4 className="text-xs font-black text-slate-900 dark:text-white mb-2">科技成长股加速</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  半导体与新能源板块呈现强劲流动性流入态势，建议关注核心设备环节的α收益机会，适当增加成长仓位权重。
                </p>
              </div>
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-800/50">
                <h4 className="text-xs font-black text-slate-900 dark:text-white mb-2">大消费防御布局</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  白酒板块近期缩量调整，但基本面稳健。策略建议：分批布局绩优蓝筹，作为平抑波动的配置资产。
                </p>
              </div>
            </div>
          </section>

          {/* Current Risks */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <AlertTriangle size={14} className="text-rose-500" fill="currentColor" />
              HEADS UP 当前风险
            </h3>
            <div className="space-y-3">
              <div className="bg-rose-50/50 dark:bg-rose-900/10 p-4 rounded-2xl border border-rose-100/50 dark:border-rose-800/20 flex gap-3">
                <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center shrink-0">
                  <Zap size={14} className="text-rose-600 dark:text-rose-400" fill="currentColor" />
                </div>
                <div>
                  <h4 className="text-[11px] font-bold text-rose-700 dark:text-rose-400 mb-1 uppercase tracking-wider">流动性分化告警</h4>
                  <p className="text-[10px] text-rose-600/80 dark:text-rose-400/80 leading-relaxed">
                    尾盘小票流动性显著下降，警惕部分题材股高位回撤压力，严格执行止损纪律。
                  </p>
                </div>
              </div>
              <div className="bg-rose-50/50 dark:bg-rose-900/10 p-4 rounded-2xl border border-rose-100/50 dark:border-rose-800/20 flex gap-3">
                <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center shrink-0">
                  <Zap size={14} className="text-rose-600 dark:text-rose-400" fill="currentColor" />
                </div>
                <div>
                  <h4 className="text-[11px] font-bold text-rose-700 dark:text-rose-400 mb-1 uppercase tracking-wider">波动率极值</h4>
                  <p className="text-[10px] text-rose-600/80 dark:text-rose-400/80 leading-relaxed">
                    创业板波动率已触及近3个月高点，短线不宜盲目追涨。
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </ScrollArea>

      <div className="p-6 mt-auto">
        <div className="bg-slate-900 text-white p-6 rounded-3xl relative overflow-hidden shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">MARKET PULSE</h4>
            <span className="bg-rose-500 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest">LIVE</span>
          </div>
          <div className="space-y-4 relative z-10">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-[11px] font-bold opacity-70">上证指数</span>
              <div className="text-right">
                <div className="text-sm font-black tracking-tight">3,082.29</div>
                <div className="text-[10px] font-bold text-emerald-400">+0.48%</div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold opacity-70">深证成指</span>
              <div className="text-right">
                <div className="text-sm font-black tracking-tight">10,154.55</div>
                <div className="text-[10px] font-bold text-emerald-400">+1.12%</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
