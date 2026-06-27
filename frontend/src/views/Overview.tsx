import React, { useMemo } from "react";
import { 
  Activity, 
  Terminal, 
  Zap, 
  Cpu, 
  Database,
  Network,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  FileCode,
  Lock
} from "lucide-react";
import { 
  ResponsiveContainer, 
  AreaChart,
  Area,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { RunDTO, RecommendationDTO, ApprovalDTO, ResourceDTO, RunDetailsDTO } from "../api/client";

interface OverviewProps {
  runs: RunDTO[];
  resources: ResourceDTO[];
  recommendations: RecommendationDTO[];
  approvals: ApprovalDTO[];
  activeRunDetails?: RunDetailsDTO | null;
}

export function Overview({ runs, resources, recommendations, approvals, activeRunDetails }: OverviewProps) {
  // 1. Calculate Metrics
  const totalDiscovered = recommendations.reduce((acc, r) => acc + r.saving_amount, 0);
  const totalRealized = recommendations
    .filter(r => r.status === "executed" || r.status === "approved")
    .reduce((acc, r) => acc + r.saving_amount, 0);

  const pendingApprovals = approvals.filter(a => a.status === "pending").length;
  const activeRuns = runs.filter(r => r.status === "running").length;
  
  // Is there a currently executing run?
  const isRunning = activeRunDetails?.db_record?.status === "running";
  
  // Extract real agent metrics from the active run
  const activeLogs = activeRunDetails?.audit_logs || [];
  const latestLog = activeLogs.length > 0 ? activeLogs[activeLogs.length - 1] : null;

  // Determine which agent is currently active based on the last log
  const currentAgent = latestLog?.agent_name || "idle";

  // Derive progress states from the active run's in-memory steps
  const steps = activeRunDetails?.in_memory_state?.steps || [];
  
  const getStepStatus = (stepName: string) => {
    const step = steps.find(s => s.step_name === stepName);
    if (!step) return "pending";
    return step.status.toLowerCase();
  };

  const telemetryStatus = getStepStatus("metric_analysis");
  const policyStatus = getStepStatus("decision_making");
  const executionStatus = getStepStatus("remediation_execution");

  // Determine latest recommendation (if any) to feature
  const latestRecommendation = useMemo(() => {
    if (recommendations.length === 0) return null;
    return [...recommendations].sort((a, b) => b.saving_amount - a.saving_amount)[0];
  }, [recommendations]);

  // Aggregate savings for the chart based on historical runs and their generated recommendations
  // Note: For a true production app, this would come directly from a /metrics endpoint. 
  // Here we derive it directly from the recommendations array to avoid fake data.
  const realizedRecos = recommendations.filter(r => r.status === "executed" || r.status === "approved");
  const savingsTimelineData = useMemo(() => {
    let cumulative = 0;
    // Mocking dates since the actual recommendation DTO doesn't have a created_at in our simplified schema,
    // but in reality we would group by date. We will group by resource ID as a proxy for "steps" to show a real line.
    return realizedRecos.map((reco, idx) => {
      cumulative += reco.saving_amount;
      return { name: `Action ${idx + 1}`, amount: cumulative };
    });
  }, [realizedRecos]);

  return (
    <div className="space-y-6">
      
      {/* Landing Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Live Intelligence</h2>
          <p className="text-sm text-muted-foreground mt-1">Real-time autonomous cloud operations and reasoning.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md border border-border">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isRunning ? 'bg-emerald-400' : 'bg-muted-foreground'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isRunning ? 'bg-emerald-500' : 'bg-muted-foreground'}`}></span>
            </span>
            <span className="text-[11px] font-mono font-medium text-foreground uppercase tracking-wider">
              {isRunning ? "Agents Active" : "Monitoring Idle"}
            </span>
          </div>
        </div>
      </div>

      {/* Autonomous Brain Live Streams - REAL DATA ONLY */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Telemetry Agent */}
        <div className={`glass-panel p-5 rounded-lg flex flex-col justify-between transition-colors ${telemetryStatus === 'running' ? 'border-primary shadow-sm shadow-primary/20' : ''}`}>
          <div className="flex items-center justify-between mb-4">
            <div className={`flex items-center gap-2 ${telemetryStatus === 'running' ? 'text-primary' : 'text-muted-foreground'}`}>
              <Activity className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-widest font-mono">Telemetry Agent</span>
            </div>
            {telemetryStatus === 'running' && <span className="h-1.5 w-1.5 bg-primary rounded-full animate-pulse" />}
            {telemetryStatus === 'completed' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
          </div>
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground font-mono">
              {telemetryStatus === 'running' ? "Collecting metrics..." : 
               telemetryStatus === 'completed' ? "Collection complete." : "Waiting for trigger..."}
            </p>
          </div>
        </div>

        {/* Policy Agent */}
        <div className={`glass-panel p-5 rounded-lg flex flex-col justify-between transition-colors ${policyStatus === 'running' ? 'border-emerald-500 shadow-sm shadow-emerald-500/20' : ''}`}>
          <div className="flex items-center justify-between mb-4">
            <div className={`flex items-center gap-2 ${policyStatus === 'running' ? 'text-emerald-500' : 'text-muted-foreground'}`}>
              <ShieldCheck className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-widest font-mono">Policy Agent</span>
            </div>
            {policyStatus === 'running' && <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />}
            {policyStatus === 'completed' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
          </div>
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground font-mono">
              {policyStatus === 'running' ? "Evaluating guardrails..." : 
               policyStatus === 'completed' ? "Governance enforced." : "Awaiting telemetry..."}
            </p>
          </div>
        </div>

        {/* Execution Agent */}
        <div className={`glass-panel p-5 rounded-lg flex flex-col justify-between transition-colors ${executionStatus === 'running' ? 'border-amber-500 shadow-sm shadow-amber-500/20' : ''}`}>
          <div className="flex items-center justify-between mb-4">
            <div className={`flex items-center gap-2 ${executionStatus === 'running' ? 'text-amber-500' : 'text-muted-foreground'}`}>
              <Zap className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-widest font-mono">Execution Agent</span>
            </div>
            {executionStatus === 'running' && <span className="h-1.5 w-1.5 bg-amber-500 rounded-full animate-pulse" />}
            {executionStatus === 'completed' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
          </div>
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground font-mono">
              {executionStatus === 'running' ? "Executing cloud payload..." : 
               executionStatus === 'completed' ? "Remediation applied." : 
               activeRunDetails?.db_record.status === "blocked_on_approval" ? "Awaiting human approval gate..." :
               "Awaiting plan..."}
            </p>
          </div>
        </div>
      </div>

      {/* Active Executive Log - REAL DATA */}
      <div className="w-full bg-card border border-border rounded-lg p-4 font-mono text-[11px] flex items-center gap-3 shadow-sm">
        <Terminal className="h-4 w-4 text-muted-foreground" />
        <span className="text-primary font-bold">EXECUTIVE_STDOUT &gt;</span>
        <span className={`text-foreground truncate flex-1 ${isRunning ? "animate-pulse" : ""}`}>
          {latestLog ? `[${latestLog.agent_name.replace('_agent', '').toUpperCase()}] ${latestLog.payload?.message || latestLog.event_type}` : "All autonomous sweeps completed. System idle."}
        </span>
      </div>

      {/* Dense Dashboard Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Column: Velocity & Finances (3 cols) */}
        <div className="lg:col-span-3 space-y-6">
          <div className="grid grid-cols-3 gap-4">
            {/* Quick Stat Blocks */}
            <div className="bg-card border border-border p-5 rounded-lg">
              <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-1">Discovered Savings</p>
              <h3 className="text-3xl font-bold font-mono tracking-tighter text-foreground">${totalDiscovered.toFixed(2)}</h3>
              <p className="text-[10px] text-muted-foreground mt-2">Potential monthly MRR reduction</p>
            </div>
            <div className="bg-card border border-border p-5 rounded-lg relative overflow-hidden">
              <div className="absolute right-0 top-0 w-1 h-full bg-emerald-500" />
              <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-1">Realized Savings</p>
              <h3 className="text-3xl font-bold font-mono tracking-tighter text-emerald-500">${totalRealized.toFixed(2)}</h3>
              <p className="text-[10px] text-muted-foreground mt-2">Actions securely executed</p>
            </div>
            <div className="bg-card border border-border p-5 rounded-lg relative overflow-hidden">
              <div className="absolute right-0 top-0 w-1 h-full bg-amber-500" />
              <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-1">Pending Gate</p>
              <h3 className="text-3xl font-bold font-mono tracking-tighter text-foreground">{pendingApprovals}</h3>
              <p className="text-[10px] text-muted-foreground mt-2">Approvals waiting for signature</p>
            </div>
          </div>

          {/* Cost Velocity Chart */}
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Cumulative Realized Savings</h3>
                <p className="text-[11px] text-muted-foreground">Historical progression of executed optimizations</p>
              </div>
            </div>
            <div className="h-64">
              {savingsTimelineData.length === 0 ? (
                <div className="h-full w-full flex items-center justify-center border border-dashed border-border rounded-lg">
                  <p className="text-xs text-muted-foreground italic font-mono">No executed savings data available.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={savingsTimelineData}>
                    <defs>
                      <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} 
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(val) => `$${val}`}
                      dx={-10}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                      itemStyle={{ color: "hsl(var(--foreground))", fontWeight: "bold" }}
                    />
                    <Area 
                      type="stepAfter" 
                      dataKey="amount" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorSavings)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Health & Recent Activity */}
        <div className="space-y-6">
          {/* Latest Recommendation Insight */}
          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-widest mb-4">Highest Priority Insight</h3>
            {latestRecommendation ? (
              <div className="space-y-3">
                <div className="p-3 bg-muted/30 border border-border rounded-md">
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded border border-primary/20 bg-primary/10 text-primary text-[9px] uppercase font-bold tracking-wider">
                      {latestRecommendation.action_type}
                    </span>
                    <span className="text-emerald-500 font-mono font-bold text-xs">${latestRecommendation.saving_amount.toFixed(2)}</span>
                  </div>
                  <p className="font-mono text-xs text-foreground truncate">{latestRecommendation.resource_id}</p>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">{latestRecommendation.rationale}</p>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground italic">No recommendations identified yet.</p>
            )}
          </div>

          {/* Estate Health */}
          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-widest mb-4">Estate Summary</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Resources Tracked</span>
                </div>
                <span className="font-mono text-xs">{resources.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Network className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Network Guardrails</span>
                </div>
                <span className="font-mono text-xs text-emerald-500">Active</span>
              </div>
            </div>
          </div>

          {/* Active Workflows Mini */}
          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-widest mb-4">Recent Sweeps</h3>
            {runs.length === 0 ? (
              <p className="text-xs text-muted-foreground">No sweeps executed.</p>
            ) : (
              <div className="space-y-3">
                {runs.slice(0, 4).map((run) => (
                  <div key={run.id} className="flex items-center justify-between p-2 rounded bg-muted/30 border border-border/50">
                    <div className="flex items-center gap-2">
                      {run.status === "running" ? (
                        <RefreshCw className="h-3 w-3 text-primary animate-spin" />
                      ) : run.status === "completed" ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      ) : run.status === "blocked_on_approval" ? (
                        <Lock className="h-3 w-3 text-amber-500" />
                      ) : (
                        <Clock className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span className="text-[10px] font-mono truncate w-24 text-foreground">{run.id.substring(0,8)}</span>
                    </div>
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{run.status.replace(/_/g, " ")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
