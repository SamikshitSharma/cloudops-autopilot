import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import type { Kpi } from "@/lib/mock";

export function KpiCard({ kpi }: { kpi: Kpi }) {
  const positive = kpi.intent === "positive";
  const negative = kpi.intent === "negative";
  const deltaCls = positive ? "text-success" : negative ? "text-destructive" : "text-muted-foreground";
  const Arrow = kpi.delta >= 0 ? ArrowUpRight : ArrowDownRight;
  const data = kpi.sparkline.map((v, i) => ({ i, v }));

  return (
    <Card className="glass group relative overflow-hidden p-5 transition-all hover:-translate-y-0.5 hover:shadow-elegant">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-primary opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{kpi.label}</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{kpi.value}</p>
          <div className={cn("mt-1 inline-flex items-center gap-1 text-xs font-medium", deltaCls)}>
            <Arrow className="h-3 w-3" aria-hidden />
            {Math.abs(kpi.delta)}%<span className="text-muted-foreground"> vs last period</span>
          </div>
        </div>
        <div className="h-14 w-24 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`spark-${kpi.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={2} fill={`url(#spark-${kpi.id})`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}
