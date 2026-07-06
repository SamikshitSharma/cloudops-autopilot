import { useMemo, useEffect } from "react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { ArrowRight, Sparkles, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useHealth, useWorkflowMetrics, useWorkflowHistory } from "@/hooks/overview";
import { cn } from "@/lib/utils";

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
  color: "hsl(var(--popover-foreground))",
} as const;

const getStatusStyles = (status: string) => {
  const normalized = status.toLowerCase().replace(/_/g, " ");
  if (normalized === "completed") {
    return "bg-success/10 text-success border-success/30";
  } else if (normalized === "running") {
    return "bg-info/10 text-info border-info/30";
  } else if (normalized === "failed") {
    return "bg-destructive/10 text-destructive border-destructive/30";
  } else if (normalized === "waiting approval" || normalized === "blocked on approval") {
    return "bg-warning/10 text-warning border-warning/30";
  } else {
    return "bg-muted/10 text-muted-foreground border-muted-foreground/30";
  }
};

const getStatusLabel = (status: string) => {
  const normalized = status.toLowerCase().replace(/_/g, " ");
  if (normalized === "blocked on approval") return "waiting approval";
  return normalized;
};

const KpiCardSkeleton = () => (
  <Card className="glass p-5 h-[112px]">
    <div className="space-y-2">
      <Skeleton className="h-4 w-24 bg-muted/60" />
      <Skeleton className="h-7 w-32 bg-muted/60" />
      <Skeleton className="h-4 w-40 bg-muted/60" />
    </div>
  </Card>
);

export default function Overview() {
  const { data: health, isLoading: isHealthLoading, isError: isHealthError, error: healthError } = useHealth();
  const { data: metrics, isLoading: isMetricsLoading, isError: isMetricsError, error: metricsError } = useWorkflowMetrics();
  const { data: history, isLoading: isHistoryLoading, isError: isHistoryError, error: historyError } = useWorkflowHistory();

  // Step 10: Error state notifications using sonner
  useEffect(() => {
    if (isHealthError) {
      toast.error("Failed to load system health status.");
      console.error(healthError);
    }
  }, [isHealthError, healthError]);

  useEffect(() => {
    if (isMetricsError) {
      toast.error("Failed to load workflow metrics summary.");
      console.error(metricsError);
    }
  }, [isMetricsError, metricsError]);

  useEffect(() => {
    if (isHistoryError) {
      toast.error("Failed to load workflow execution history.");
      console.error(historyError);
    }
  }, [isHistoryError, historyError]);

  // Step 5: Map backend values to KPIs
  const mappedKpis = useMemo(() => {
    if (!metrics) return [];
    
    const healthVal = health ? (health.success && health.data.status === "healthy" ? "Healthy" : "Degraded") : "Unknown";
    
    return [
      {
        id: "health",
        label: "System Health",
        value: healthVal,
        delta: 0,
        sparkline: [1, 1, 1, 1, 1],
        intent: healthVal === "Healthy" ? ("positive" as const) : ("negative" as const),
      },
      {
        id: "workflows",
        label: "Total Workflows",
        value: metrics.total_workflow_executions.toLocaleString(),
        delta: 0,
        sparkline: [1, 1, 1],
        intent: "neutral" as const,
      },
      {
        id: "success-rate",
        label: "Success Rate",
        value: `${metrics.success_rate.toFixed(1)}%`,
        delta: 0,
        sparkline: [metrics.success_rate, metrics.success_rate],
        intent: "positive" as const,
      },
      {
        id: "failure-rate",
        label: "Failure Rate",
        value: `${metrics.failure_rate.toFixed(1)}%`,
        delta: 0,
        sparkline: [metrics.failure_rate, metrics.failure_rate],
        intent: metrics.failure_rate > 0 ? ("negative" as const) : ("neutral" as const),
      },
      {
        id: "savings-month",
        label: "Savings This Month",
        value: `$${metrics.cost_saved_this_month.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo`,
        delta: 0,
        sparkline: [metrics.cost_saved_this_month, metrics.cost_saved_this_month],
        intent: "positive" as const,
      },
      {
        id: "savings-today",
        label: "Realized Savings Today",
        value: `$${metrics.cost_saved_today.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo`,
        delta: 0,
        sparkline: [metrics.cost_saved_today, metrics.cost_saved_today],
        intent: "positive" as const,
      },
      {
        id: "resources-managed",
        label: "Resources Managed",
        value: metrics.azure_resources_managed.toString(),
        delta: 0,
        sparkline: [metrics.azure_resources_managed, metrics.azure_resources_managed],
        intent: "neutral" as const,
      },
      {
        id: "regions",
        label: "Azure Regions",
        value: metrics.azure_regions.toString(),
        delta: 0,
        sparkline: [metrics.azure_regions, metrics.azure_regions],
        intent: "neutral" as const,
      },
      {
        id: "pending-approvals",
        label: "Pending Approvals",
        value: metrics.pending_approvals.toString(),
        delta: 0,
        sparkline: [metrics.pending_approvals, metrics.pending_approvals],
        intent: metrics.pending_approvals > 0 ? ("warning" as const) : ("neutral" as const),
      },
      {
        id: "optimized-today",
        label: "Optimized Today",
        value: metrics.resources_optimized_today.toString(),
        delta: 0,
        sparkline: [metrics.resources_optimized_today, metrics.resources_optimized_today],
        intent: "positive" as const,
      },
      {
        id: "active-agents",
        label: "Active Agents",
        value: metrics.active_agents.toString(),
        delta: 0,
        sparkline: [metrics.active_agents, metrics.active_agents],
        intent: "positive" as const,
      },
      {
        id: "policies-checked",
        label: "Policies Checked",
        value: metrics.policies_checked.toString(),
        delta: 0,
        sparkline: [metrics.policies_checked, metrics.policies_checked],
        intent: "neutral" as const,
      },
      {
        id: "azure-api-calls",
        label: "Azure API Calls Today",
        value: metrics.azure_api_calls_today.toLocaleString(),
        delta: 0,
        sparkline: [metrics.azure_api_calls_today, metrics.azure_api_calls_today],
        intent: "neutral" as const,
      },
      {
        id: "llm-requests",
        label: "LLM Requests",
        value: metrics.llm_requests.toLocaleString(),
        delta: 0,
        sparkline: [metrics.llm_requests, metrics.llm_requests],
        intent: "neutral" as const,
      },
      {
        id: "events-processed",
        label: "Events Processed",
        value: metrics.events_processed.toLocaleString(),
        delta: 0,
        sparkline: [metrics.events_processed, metrics.events_processed],
        intent: "neutral" as const,
      }
    ];
  }, [metrics, health]);

  // Map Azure API usage breakdown
  const chartData = useMemo(() => {
    if (!metrics || !metrics.azure_api_utilization_statistics) return [];
    return Object.entries(metrics.azure_api_utilization_statistics).map(([key, value]) => {
      const name = key
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
      return { name, count: value };
    });
  }, [metrics]);

  return (
    <div className="space-y-8 animate-in-up">
      {/* Hero */}
      <section className="glass relative overflow-hidden rounded-2xl p-6 md:p-10">
        <div className="absolute inset-0 grid-pattern opacity-30" aria-hidden />
        <div className="absolute inset-0 bg-gradient-glow" aria-hidden />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <Badge variant="outline" className="mb-4 gap-1.5 border-primary/40 text-primary">
              <Sparkles className="h-3 w-3" /> Autopilot is observing {metrics?.total_discovered_resources ?? 0} synchronized resources
            </Badge>
            <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Your <span className="text-gradient">governed cloud</span>, at a glance.
            </h2>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground md:text-base">
              A 9-stage AI agent pipeline observes synchronized Azure state, reasons over recorded evidence, and routes high-impact changes through human approval.
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

      {/* KPIs Grid */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isHealthLoading || isMetricsLoading ? (
          Array.from({ length: 15 }).map((_, i) => <KpiCardSkeleton key={i} />)
        ) : isMetricsError ? (
          <div className="col-span-full py-8 text-center text-destructive glass rounded-xl">
            Failed to load metrics.
          </div>
        ) : (
          mappedKpis.map((k) => <KpiCard key={k.id} kpi={k} />)
        )}
      </section>

      {/* Charts / Data Row */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Recent Workflows Table Card */}
        <Card className="glass p-5 xl:col-span-2 flex flex-col justify-between">
          <div className="w-full">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-display text-base font-semibold">Recent Workflow Runs</h3>
                <p className="text-xs text-muted-foreground">Latest orchestration activity and pipeline health</p>
              </div>
              <Badge variant="outline" className="uppercase font-semibold tracking-wider text-xs border-primary/45 text-primary">
                {health?.data?.cloud_mode || "MOCK"}
              </Badge>
            </div>
            {isHistoryLoading ? (
              <div className="space-y-2 py-4">
                <Skeleton className="h-8 w-full bg-muted/60" />
                <Skeleton className="h-8 w-full bg-muted/60" />
                <Skeleton className="h-8 w-full bg-muted/60" />
                <Skeleton className="h-8 w-full bg-muted/60" />
                <Skeleton className="h-8 w-full bg-muted/60" />
              </div>
            ) : isHistoryError ? (
              <div className="py-8 text-center text-destructive">
                Failed to load workflow history.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Workflow ID</TableHead>
                      <TableHead>Scenario</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Savings</TableHead>
                      <TableHead>Created Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                          No workflow executions found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      history.slice(0, 8).map((wf) => (
                        <TableRow key={wf.workflow_id}>
                          <TableCell className="font-mono text-xs font-semibold">{wf.workflow_id}</TableCell>
                          <TableCell className="max-w-[120px] truncate">{wf.scenario_name || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("text-[10px] px-2 py-0.5 border font-medium capitalize", getStatusStyles(wf.status))}>
                              {getStatusLabel(wf.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{wf.progress_percentage.toFixed(2)}%</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {wf.execution_mode}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{(wf.confidence * 100).toFixed(2)}%</TableCell>
                          <TableCell className="font-mono text-xs text-success">
                            ${wf.estimated_savings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(wf.created_at).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </Card>

        {/* Azure API Usage Card */}
        <Card className="glass p-5 flex flex-col justify-between">
          <div className="w-full">
            <div className="mb-4">
              <h3 className="font-display text-base font-semibold">Azure API Usage</h3>
              <p className="text-xs text-muted-foreground">Consolidated API call volume by operation</p>
            </div>
            {isMetricsLoading ? (
              <div className="h-64 flex flex-col justify-between py-2">
                <Skeleton className="h-10 w-full bg-muted/60" />
                <Skeleton className="h-10 w-full bg-muted/60" />
                <Skeleton className="h-10 w-full bg-muted/60" />
              </div>
            ) : isMetricsError ? (
              <div className="h-64 flex items-center justify-center text-destructive">
                Failed to load API utilization metrics.
              </div>
            ) : chartData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No utilization metrics available.
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted) / 0.4)" }} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}
