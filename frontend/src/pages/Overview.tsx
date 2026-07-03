import { KpiCard } from "@/components/dashboard/KpiCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { kpis, spendByService, utilizationSeries, events, recommendations, pipelineStages } from "@/lib/mock";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { ArrowRight, Sparkles, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { SeverityBadge } from "@/components/ui-ext/SeverityBadge";
import { PipelineTimeline } from "@/components/workflows/PipelineTimeline";

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
  color: "hsl(var(--popover-foreground))",
} as const;

export default function Overview() {
  return (
    <div className="space-y-8 animate-in-up">
      {/* Hero */}
      <section className="glass relative overflow-hidden rounded-2xl p-6 md:p-10">
        <div className="absolute inset-0 grid-pattern opacity-30" aria-hidden />
        <div className="absolute inset-0 bg-gradient-glow" aria-hidden />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <Badge variant="outline" className="mb-4 gap-1.5 border-primary/40 text-primary">
              <Sparkles className="h-3 w-3" /> Autopilot is actively optimizing 342 resources
            </Badge>
            <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Your <span className="text-gradient">autonomous cloud</span>, at a glance.
            </h2>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground md:text-base">
              A 9-stage AI agent pipeline continuously observes, reasons, and safely remediates across AWS, Azure, and GCP —
              with human-in-the-loop guardrails on every high-impact change.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="gap-2 bg-gradient-primary text-primary-foreground shadow-elegant hover:opacity-90">
              <Link to="/workflows"><Zap className="h-4 w-4" /> View live pipeline</Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/recommendations">Review recommendations <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => <KpiCard key={k.id} kpi={k} />)}
      </section>

      {/* Charts row */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="glass p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-semibold">Fleet Utilization · last 24h</h3>
              <p className="text-xs text-muted-foreground">CPU, memory, and network across all workloads</p>
            </div>
            <Badge variant="outline">Live</Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={utilizationSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="cpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="mem" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} interval={3} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "hsl(var(--primary))", strokeOpacity: 0.3 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="cpu" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#cpu)" />
                <Area type="monotone" dataKey="memory" stroke="hsl(var(--accent))" strokeWidth={2} fill="url(#mem)" />
                <Area type="monotone" dataKey="network" stroke="hsl(var(--info))" strokeWidth={2} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="glass p-5">
          <div className="mb-4">
            <h3 className="font-display text-base font-semibold">Spend by Service</h3>
            <p className="text-xs text-muted-foreground">Multi-cloud breakdown · MTD</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={spendByService} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted) / 0.4)" }} />
                <Bar dataKey="aws" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} />
                <Bar dataKey="azure" stackId="a" fill="hsl(var(--accent))" />
                <Bar dataKey="gcp" stackId="a" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      {/* Pipeline + activity */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="glass p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-semibold">Live Agent Pipeline</h3>
              <p className="text-xs text-muted-foreground">Run #P-2481 · triggered 2m ago</p>
            </div>
            <Button asChild variant="ghost" size="sm" className="gap-1 text-primary">
              <Link to="/workflows">Open workflow center <ArrowRight className="h-3.5 w-3.5" /></Link>
            </Button>
          </div>
          <PipelineTimeline stages={pipelineStages.slice(0, 6)} />
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="glass p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold">Top Recommendations</h3>
              <Button asChild variant="ghost" size="sm" className="text-primary"><Link to="/recommendations">All</Link></Button>
            </div>
            <ul className="space-y-2">
              {recommendations.slice(0, 3).map((r) => (
                <li key={r.id} className="rounded-md border border-border/60 bg-muted/20 p-3 hover:bg-muted/40">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-snug">{r.title}</p>
                    <SeverityBadge severity={r.severity} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{r.impact}</p>
                  {r.savings && <p className="mt-1 text-xs font-medium text-success">{r.savings}</p>}
                </li>
              ))}
            </ul>
          </Card>

          <Card className="glass p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold">Event Stream</h3>
              <Button asChild variant="ghost" size="sm" className="text-primary"><Link to="/events">Open</Link></Button>
            </div>
            <ul className="space-y-2 font-mono text-[11px]">
              {events.slice(0, 5).map((e) => (
                <li key={e.id} className="flex items-start gap-2">
                  <span className="text-muted-foreground">{e.ts}</span>
                  <SeverityBadge severity={e.severity} dotOnly />
                  <span className="text-primary">{e.topic}</span>
                  <span className="truncate text-foreground/80">{e.message}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>
    </div>
  );
}
