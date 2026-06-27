import * as React from "react";
import { Search, Download, Sliders, Brain, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function StockScreener() {
  const results = [
    { ticker: "AAPL", name: "Apple Inc.", price: "$189.42", change: "+4.12%", volRel: "2.4x", aiScore: "98/100", trend: "up", color: "bg-blue-500" },
    { ticker: "NVDA", name: "NVIDIA Corp", price: "$894.10", change: "+3.28%", volRel: "1.8x", aiScore: "94/100", trend: "up", color: "bg-emerald-500" },
    { ticker: "MSFT", name: "Microsoft", price: "$412.55", change: "+1.15%", volRel: "1.2x", aiScore: "88/100", trend: "up", color: "bg-slate-500" },
    { ticker: "TSLA", name: "Tesla, Inc.", price: "$175.22", change: "-2.14%", volRel: "3.8x", aiScore: "72/100", trend: "down", color: "bg-rose-500" },
    { ticker: "GOOGL", name: "Alphabet Inc.", price: "$142.65", change: "+0.88%", volRel: "1.2x", aiScore: "85/100", trend: "up", color: "bg-emerald-400" },
    { ticker: "META", name: "Meta Platforms", price: "$496.24", change: "+0.15%", volRel: "1.8x", aiScore: "82/100", trend: "up", color: "bg-emerald-500" },
  ];

  return (
    <ScrollArea className="flex-1 bg-white dark:bg-slate-950">
      <div className="max-w-6xl mx-auto p-8 space-y-8">
        {/* Hero Analysis CTA */}
        <section className="relative overflow-hidden rounded-3xl bg-slate-900 dark:bg-slate-900 p-10 flex items-center justify-between group shadow-2xl border border-white/5">
          <div className="relative z-10 space-y-4">
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase">AI Quant Screening</h1>
            <p className="text-slate-400 text-sm max-w-md leading-relaxed font-medium">
              Proprietary multi-factor analysis engine processing real-time order flow and institutional sentiment for Late Session momentum.
            </p>
          </div>
          <Button className="relative z-10 flex items-center gap-3 bg-white text-black hover:bg-slate-100 px-8 py-6 rounded-2xl font-black text-lg shadow-xl hover:scale-[1.02] transition-all active:scale-95 border-none">
            <Brain size={24} className="text-blue-500" fill="currentColor" />
            START ANALYSIS
          </Button>
          {/* Decorative element */}
          <div className="absolute right-0 top-0 w-1/2 h-full opacity-20 pointer-events-none bg-gradient-to-l from-blue-500/20 to-transparent"></div>
        </section>

        {/* Screening Conditions Grid */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3 uppercase tracking-tight">
              <Sliders size={20} className="text-blue-500" />
              Screening Parameters
            </h3>
            <div className="flex gap-2">
              <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-[10px] font-bold text-slate-500 uppercase tracking-wider">Technical factors: 12</span>
              <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fundamental factors: 4</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Volume & Liquidity */}
            <ParameterCard title="Volume & Liquidity">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Float Value (50~200B)</label>
                  <input className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs px-4 py-3 focus:ring-1 focus:ring-blue-500 transition-all font-bold" type="text" defaultValue="75B - 150B" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Volume Ratio ({">"}= 1.2)</label>
                  <div className="flex items-center gap-4">
                    <input className="flex-1 accent-blue-500 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full appearance-none cursor-pointer" type="range" defaultValue="75" />
                    <span className="text-[11px] font-mono font-black text-slate-900 dark:text-white">1.5x</span>
                  </div>
                </div>
              </div>
            </ParameterCard>

            {/* Price Action */}
            <ParameterCard title="Price Action">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Daily Change (3~5%)</label>
                  <div className="grid grid-cols-2 gap-3">
                    <input className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs px-4 py-3 font-bold" type="text" defaultValue="3.0" />
                    <input className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs px-4 py-3 font-bold" type="text" defaultValue="5.0" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Gap Percentage</label>
                  <input className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs px-4 py-3 font-bold" type="text" defaultValue="&gt; 0.5%" />
                </div>
              </div>
            </ParameterCard>

            {/* Trend Multipliers */}
            <ParameterCard title="Trend Multipliers">
              <div className="space-y-4">
                <ToggleItem label="Institutional Flow" active />
                <ToggleItem label="Sentiment (Social)" />
                <ToggleItem label="RSI Divergence" active />
              </div>
            </ParameterCard>
          </div>
        </section>

        {/* Screener Results Table */}
        <section className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/50 dark:border-slate-800/50 overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
            <h3 className="text-lg font-black tracking-tight uppercase">Screener Results <span className="text-slate-400 font-bold text-xs ml-2">(42 matches)</span></h3>
            <div className="flex gap-4">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="pl-10 pr-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs w-48 focus:ring-1 focus:ring-blue-500 transition-all" placeholder="Quick find..." type="text" />
              </div>
              <Button variant="outline" size="sm" className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-950 rounded-xl text-[10px] font-bold uppercase tracking-wider h-9 border-slate-200 dark:border-slate-800">
                <Download size={14} />
                Export
              </Button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-900/50 text-slate-500 font-bold text-[10px] uppercase tracking-widest">
                  <th className="px-6 py-4">Ticker</th>
                  <th className="px-6 py-4">Price</th>
                  <th className="px-6 py-4">Chg%</th>
                  <th className="px-6 py-4">Volume Rel</th>
                  <th className="px-6 py-4">AI Score</th>
                  <th className="px-6 py-4 text-right">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {results.map((item, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] text-white", item.color)}>
                          {item.ticker}
                        </div>
                        <div>
                          <div className="font-black text-slate-900 dark:text-white">{item.ticker}</div>
                          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{item.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-slate-700 dark:text-slate-300">{item.price}</td>
                    <td className={cn("px-6 py-4 font-black", item.change.startsWith("+") ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                      {item.change}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden min-w-[60px]">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${parseFloat(item.volRel) * 20}%` }} />
                        </div>
                        <span className="text-[10px] font-black text-slate-900 dark:text-white">{item.volRel}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-lg text-[10px] font-black tracking-widest border border-blue-100 dark:border-blue-800/50">
                        {item.aiScore}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        {item.trend === "up" ? (
                          <div className="flex items-end gap-0.5 h-6">
                            {[2, 4, 3, 5, 6, 8].map((h, j) => (
                              <div key={j} className="w-1 bg-emerald-500/40 rounded-t-sm" style={{ height: `${h * 3}px` }} />
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-start gap-0.5 h-6">
                            {[8, 6, 7, 5, 4, 2].map((h, j) => (
                              <div key={j} className="w-1 bg-rose-500/40 rounded-b-sm" style={{ height: `${h * 3}px` }} />
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-6 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex justify-center">
            <Button variant="ghost" className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-slate-900 dark:hover:text-white">
              Load 12 more results
            </Button>
          </div>
        </section>
      </div>
    </ScrollArea>
  );
}

function ParameterCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 space-y-4 shadow-sm">
      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">{title}</h4>
      {children}
    </div>
  );
}

function ToggleItem({ label, active }: { label: string; active?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{label}</span>
      <button className={cn(
        "w-10 h-5 rounded-full relative transition-all duration-300",
        active ? "bg-blue-500" : "bg-slate-200 dark:bg-slate-800"
      )}>
        <div className={cn(
          "absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300",
          active ? "right-1" : "left-1"
        )} />
      </button>
    </div>
  );
}
