import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import { Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const data = [
  { name: "Jan", value: 100, bench: 100 },
  { name: "Feb", value: 120, bench: 105 },
  { name: "Mar", value: 115, bench: 108 },
  { name: "Apr", value: 140, bench: 110 },
  { name: "May", value: 160, bench: 115 },
  { name: "Jun", value: 155, bench: 118 },
  { name: "Jul", value: 180, bench: 122 },
  { name: "Aug", value: 210, bench: 125 },
  { name: "Sep", value: 200, bench: 128 },
  { name: "Oct", value: 230, bench: 132 },
  { name: "Nov", value: 250, bench: 135 },
  { name: "Dec", value: 314, bench: 140 },
];

export function MainChart() {
  return (
    <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-200/50 dark:border-slate-800/50 flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Performance Yield Curve
          </h2>
          <p className="text-sm text-slate-500 font-medium">
            Benchmark: S&P 500 Total Return Index
          </p>
        </div>
        <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <Button variant="ghost" size="sm" className="text-[10px] font-bold uppercase h-8 px-4">1Y</Button>
          <Button variant="secondary" size="sm" className="text-[10px] font-bold uppercase h-8 px-4 bg-white dark:bg-slate-700 shadow-sm">All Time</Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Maximize2 size={14} />
          </Button>
        </div>
      </div>

      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#000" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#000" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fontWeight: 600, fill: "#94a3b8" }}
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fontWeight: 600, fill: "#94a3b8" }}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip 
              contentStyle={{ 
                borderRadius: "12px", 
                border: "none", 
                boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                fontSize: "12px",
                fontWeight: "600"
              }} 
            />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke="#000" 
              strokeWidth={3} 
              fillOpacity={1} 
              fill="url(#colorValue)" 
              animationDuration={2000}
            />
            <Line 
              type="monotone" 
              dataKey="bench" 
              stroke="#94a3b8" 
              strokeWidth={2} 
              strokeDasharray="5 5" 
              dot={false} 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
