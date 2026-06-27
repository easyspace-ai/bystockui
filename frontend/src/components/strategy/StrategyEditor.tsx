import * as React from "react";
import { ChevronDown, Terminal, Info } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function StrategyEditor() {
  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-slate-950 overflow-hidden">
      {/* Metadata Panel */}
      <section className="p-8 bg-white dark:bg-slate-950 border-b border-slate-200/50 dark:border-slate-800/50">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Strategy Name</label>
              <input 
                className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl px-4 py-3 focus:ring-1 focus:ring-blue-500 text-xl font-black tracking-tight text-slate-900 dark:text-white transition-all" 
                type="text" 
                defaultValue="Trend Following V2"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Base Strategy</label>
              <div className="w-full bg-slate-50 dark:bg-slate-900 px-4 py-3 rounded-xl text-slate-900 dark:text-white font-bold flex items-center justify-between cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                <span>MomentumProvider</span>
                <ChevronDown size={18} className="text-slate-400" />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Description</label>
            <textarea 
              className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl px-4 py-3 focus:ring-1 focus:ring-blue-500 text-sm text-slate-600 dark:text-slate-400 resize-none leading-relaxed transition-all" 
              rows={2}
              defaultValue="High-frequency trend following logic utilizing exponential moving average crossovers on the 5-minute timeframe."
            />
          </div>
        </div>
      </section>

      {/* Code Editor Area */}
      <section className="flex-1 flex flex-col bg-slate-950 text-slate-300 font-mono text-sm overflow-hidden relative">
        <div className="h-10 flex items-center px-4 bg-slate-900/80 border-b border-white/5 justify-between">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2 text-[10px] font-bold text-white/60 uppercase tracking-widest">
              <Terminal size={14} className="text-blue-400" />
              main.py
            </span>
            <span className="text-[10px] text-white/30 italic font-sans">Unsaved changes</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[9px] font-bold text-white/40 tracking-widest uppercase">UTF-8</span>
            <span className="text-[9px] font-bold text-white/40 tracking-widest uppercase">PYTHON 3.10</span>
          </div>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="flex min-h-full">
            {/* Line Numbers */}
            <div className="w-12 bg-slate-900/30 text-right pr-4 py-6 text-white/20 select-none text-[11px] leading-relaxed">
              {Array.from({ length: 25 }).map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
            
            {/* Syntax Highlighted Code */}
            <div className="flex-1 py-6 px-6 whitespace-pre leading-relaxed tracking-wide text-[13px]">
              <CodeLine><Keyword>import</Keyword> pandas <Keyword>as</Keyword> pd</CodeLine>
              <CodeLine><Keyword>from</Keyword> quant_core <Keyword>import</Keyword> BaseStrategy</CodeLine>
              <CodeLine />
              <CodeLine><Keyword>class</Keyword> <Func>TrendFollowingV2</Func>(BaseStrategy):</CodeLine>
              <CodeLine>    <Comment>"""</Comment></CodeLine>
              <CodeLine>    <Comment>Refined trend following logic with adaptive risk parameters.</Comment></CodeLine>
              <CodeLine>    <Comment>"""</Comment></CodeLine>
              <CodeLine>    <Keyword>def</Keyword> <Func>__init__</Func>(self, lookback=<Num>20</Num>, multiplier=<Num>2.5</Num>):</CodeLine>
              <CodeLine>        super().<Func>__init__</Func>()</CodeLine>
              <CodeLine>        self.lookback = lookback</CodeLine>
              <CodeLine>        self.multiplier = multiplier</CodeLine>
              <CodeLine>        self.set_benchmark(<Str>"SPY"</Str>)</CodeLine>
              <CodeLine />
              <CodeLine>    <Keyword>def</Keyword> <Func>on_data</Func>(self, data):</CodeLine>
              <CodeLine>        <Comment># Compute fast and slow EMA</Comment></CodeLine>
              <CodeLine>        fast_ema = data.close.ewm(span=self.lookback).mean()</CodeLine>
              <CodeLine>        slow_ema = data.close.ewm(span=self.lookback * <Num>2</Num>).mean()</CodeLine>
              <CodeLine />
              <CodeLine>        <Keyword>if</Keyword> fast_ema.iloc[-<Num>1</Num>] &gt; slow_ema.iloc[-<Num>1</Num>]:</CodeLine>
              <CodeLine>            <Keyword>if</Keyword> self.position.size &lt;= <Num>0</Num>:</CodeLine>
              <CodeLine>                self.order_target_percent(<Num>1.0</Num>)</CodeLine>
              <CodeLine>                self.log(<Str>"Entering Long position"</Str>)</CodeLine>
            </div>
          </div>
        </ScrollArea>
      </section>
    </div>
  );
}

function CodeLine({ children }: { children?: React.ReactNode }) {
  return <div className="min-h-[1.5rem]">{children}</div>;
}

function Keyword({ children }: { children: React.ReactNode }) {
  return <span className="text-blue-400 font-bold">{children}</span>;
}

function Func({ children }: { children: React.ReactNode }) {
  return <span className="text-emerald-400 font-semibold">{children}</span>;
}

function Str({ children }: { children: React.ReactNode }) {
  return <span className="text-amber-400">{children}</span>;
}

function Num({ children }: { children: React.ReactNode }) {
  return <span className="text-purple-400 font-bold">{children}</span>;
}

function Comment({ children }: { children: React.ReactNode }) {
  return <span className="text-slate-500 italic">{children}</span>;
}
