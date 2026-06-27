import * as React from "react";
import {
  Download,
  Rocket,
  TrendingUp,
  TrendingDown,
  Activity,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Circle
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

const data = [
  { name: '2023-Q1', value: 1.05, drawdown: 0 },
  { name: '2023-Q2', value: 1.12, drawdown: -0.02 },
  { name: '2023-Q3', value: 1.08, drawdown: -0.05 },
  { name: '2023-Q4', value: 1.18, drawdown: -0.01 },
  { name: '2024-Q1', value: 1.24, drawdown: 0 },
];

export function BacktestPage() {
  const trades = [
    { date: "2023-12-28 14:32", type: "buy", price: "1,720.50", amount: "860,250.00", fee: "430.12", pnl: "--", color: "text-slate-500" },
    { date: "2023-12-15 10:15", type: "sell", price: "1,685.20", amount: "842,600.00", fee: "421.30", pnl: "+2.45%", color: "text-emerald-600" },
    { date: "2023-11-20 09:35", type: "buy", price: "1,755.00", amount: "877,500.00", fee: "438.75", pnl: "--", color: "text-slate-500" },
  ];

  const heatmapData = [
    { month: "1月", value: "+4.2%", type: "pos" },
    { month: "2月", value: "+1.8%", type: "pos-dim" },
    { month: "3月", value: "-2.1%", type: "neg" },
    { month: "4月", value: "+5.5%", type: "pos" },
    { month: "5月", value: "+3.9%", type: "pos" },
    { month: "6月", value: "0.0%", type: "neutral" },
    { month: "7月", value: "+6.1%", type: "pos" },
    { month: "8月", value: "-4.2%", type: "neg" },
    { month: "9月", value: "+2.3%", type: "pos-dim" },
    { month: "10月", value: "+4.8%", type: "pos" },
    { month: "11月", value: "-1.5%", type: "neg" },
    { month: "12月", value: "+3.1%", type: "pos" },
  ];

  return (
    <ScrollArea className="flex-1 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-6xl mx-auto p-5 space-y-5">
        {/* Header Section - COMPACT */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">均线交叉增强策略 V2.1</h1>
              <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-widest">SUCCESS</span>
            </div>
            <div className="flex flex-wrap gap-4 text-[10px] font-medium text-slate-500">
              <span className="flex items-center gap-1.5">标的代码: <span className="text-slate-900 dark:text-white font-bold">600519.SH (贵州茅台)</span></span>
              <span className="flex items-center gap-1.5">测试区间: <span className="text-slate-900 dark:text-white font-bold">2023-01-01 至 2023-12-31</span></span>
              <span className="flex items-center gap-1.5">基准指数: <span className="text-slate-900 dark:text-white font-bold">沪深300</span></span>
            </div>
          </div>
          <div className="flex gap-1.5">
            <Button variant="outline" size="icon" className="h-8 w-8 bg-white dark:bg-slate-900 rounded-lg border-slate-200 dark:border-slate-800">
              <Download size={15} />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8 bg-white dark:bg-slate-900 rounded-lg border-slate-200 dark:border-slate-800">
              <Activity size={15} />
            </Button>
          </div>
        </div>

        {/* Metrics Grid - COMPACT */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard label="总收益" value="+32.40%" color="text-emerald-600 dark:text-emerald-400" />
          <MetricCard label="年化收益" value="+28.15%" color="text-emerald-600 dark:text-emerald-400" />
          <MetricCard label="最大回撤" value="-8.42%" color="text-rose-600 dark:text-rose-400" />
          <MetricCard label="夏普比率" value="1.84" color="text-slate-900 dark:text-white" />
          <MetricCard label="胜率" value="64.2%" color="text-slate-900 dark:text-white" />
          <MetricCard label="盈亏比" value="2.14" color="text-slate-900 dark:text-white" />
        </div>

        {/* Equity Curve Chart - COMPACT */}
        <section className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200/50 dark:border-slate-800/50 p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-[11px] font-bold tracking-widest uppercase text-slate-500">净值曲线 (Equity Curve)</h3>
            <div className="flex items-center gap-4 text-[9px] font-bold uppercase tracking-widest">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-0.5 bg-slate-900 dark:bg-white" />
                <span className="text-slate-500">策略净值</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-0.5 bg-slate-300 dark:bg-slate-700" />
                <span className="text-slate-500">基准指数</span>
              </div>
            </div>
          </div>

          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#000" stopOpacity={0.04}/>
                    <stop offset="95%" stopColor="#000" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fill: '#71717a', fontWeight: 500 }}
                  dy={8}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fill: '#71717a', fontWeight: 500 }}
                  domain={[0.9, 1.3]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '11px'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="currentColor"
                  className="text-slate-900 dark:text-white"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorValue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Heatmap & Stats Row - COMPACT */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Monthly Heatmap */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200/50 dark:border-slate-800/50 p-5">
            <h3 className="text-[11px] font-bold tracking-widest uppercase text-slate-500 mb-5">月度收益矩阵 (Monthly Return Heatmap)</h3>
            <div className="grid grid-cols-13 gap-0.5">
              <div className="text-[8px] font-bold text-slate-400 py-1.5">2023</div>
              {heatmapData.map((item, idx) => (
                <div key={idx} className="flex flex-col gap-0.5">
                  <div className="text-[7px] text-center font-bold text-slate-400 mb-0.5">{item.month}</div>
                  <div className={cn(
                    "h-8 flex items-center justify-center rounded-sm text-[8px] font-bold",
                    item.type === "pos" ? "bg-emerald-600 text-white" :
                    item.type === "pos-dim" ? "bg-emerald-200 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-400" :
                    item.type === "neg" ? "bg-rose-200 dark:bg-rose-900/40 text-rose-800 dark:text-rose-400" :
                    "bg-slate-100 dark:bg-slate-800 text-slate-500"
                  )}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trade Stats */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200/50 dark:border-slate-800/50 p-5">
            <h3 className="text-[11px] font-bold tracking-widest uppercase text-slate-500 mb-5">交易统计概览</h3>
            <div className="space-y-2.5">
              <StatRow label="交易总次数" value="142 次" />
              <StatRow label="平均每笔盈亏" value="+0.42%" color="text-emerald-600 dark:text-emerald-400" />
              <StatRow label="最大连续盈利次数" value="8 次" color="text-emerald-600 dark:text-emerald-400" />
              <StatRow label="最大持仓周期" value="18 交易日" />
              <StatRow label="资金换手率" value="1,240%" />
            </div>
          </div>
        </div>

        {/* Trade Details Table - COMPACT */}
        <section className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200/50 dark:border-slate-800/50 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/30 dark:bg-slate-900/30">
            <h3 className="text-[11px] font-bold tracking-widest uppercase text-slate-500">成交明细记录</h3>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">共 142 条记录</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-900/50 text-slate-500 font-bold text-[9px] uppercase tracking-widest">
                  <th className="px-4 py-2.5">成交时间</th>
                  <th className="px-4 py-2.5">类型</th>
                  <th className="px-4 py-2.5">价格</th>
                  <th className="px-4 py-2.5">成交额</th>
                  <th className="px-4 py-2.5">费用</th>
                  <th className="px-4 py-2.5 text-right">盈利</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {trades.map((trade, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer">
                    <td className="px-4 py-2.5 font-mono text-slate-500 text-[10px]">{trade.date}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest",
                        trade.type === "buy" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                      )}>
                        {trade.type === "buy" ? "买入" : "卖出"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-bold text-slate-700 dark:text-slate-300">{trade.price}</td>
                    <td className="px-4 py-2.5 font-bold text-slate-700 dark:text-slate-300">{trade.amount}</td>
                    <td className="px-4 py-2.5 text-slate-500">{trade.fee}</td>
                    <td className={cn("px-4 py-2.5 text-right font-bold", trade.color)}>
                      {trade.pnl}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </ScrollArea>
  );
}

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800 last:border-0 last:pb-0">
      <span className="text-[11px] text-slate-500 font-medium">{label}</span>
      <span className={cn("text-[11px] font-bold", color || "text-slate-900 dark:text-white")}>{value}</span>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-xl border border-slate-200/50 dark:border-slate-800/50 space-y-1 shadow-sm">
      <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.18em]">{label}</h4>
      <p className={cn("text-sm font-bold tracking-tight", color)}>{value}</p>
    </div>
  );
}
