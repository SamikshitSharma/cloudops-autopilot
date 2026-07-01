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
  Lock,
  DollarSign,
  TrendingUp,
  Percent,
  CheckCircle,
  HelpCircle
} from "lucide-react";
import { 
  ResponsiveContainer, 
  AreaChart,
  Area,
  BarChart,
  Bar,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid
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
  // 1. Calculations & Metrics
  const totalDiscovered = recommendations.reduce((acc, r) => acc + r.saving_amount, 0);
  const totalRealized = recommendations
    .filter(r => r.status === "executed" || r.status === "approved" || r.status === "auto_executed")
    .reduce((acc, r) => acc + r.saving_amount, 0);

  const pendingApprovalsCount = approvals.filter(a => a.status === "pending").length;
  const runningWorkflowsCount = runs.filter(r => r.status === "running").length;
  
  const isRunning = activeRunDetails?.db_record?.status === "running";
  const activeLogs = activeRunDetails?.audit_logs || [];
  const latestLog = activeLogs.length > 0 ? activeLogs[activeLogs.length - 1] : null;

  const steps = activeRunDetails?.in_memory_state?.steps || [];
  const getStepStatus = (stepName: string) => {
    const step = steps.find(s => s.step_name === stepName);
    if (!step) return "pending";
    return step.status.toLowerCase();
  };

  const telemetryStatus = getStepStatus("metric_analysis");
  const policyStatus = getStepStatus("decision_making");
  const executionStatus = getStepStatus("remediation_execution");

  // Overall Confidence
  const averageConfidence = useMemo(() => {
    if (recommendations.length === 0) return 92; // default base level
    const total = recommendations.reduce((sum, r) => sum + (r.confidence_score || 0.95), 0);
    return Math.round((total / recommendations.length) * 100);
  }, [recommendations]);

  // Priority Insight
  const highestSavingsInsight = useMemo(() => {
    if (recommendations.length === 0) return null;
    return [...recommendations].sort((a, b) => b.saving_amount - a.saving_amount)[0];
  }, [recommendations]);

  // Savings Progression
  const realizedRecos = recommendations.filter(r => r.status === "executed" || r.status === "approved" || r.status === "auto_executed");
  const savingsTimelineData = useMemo(() => {
    let cumulative = 0;
    if (realizedRecos.length === 0) {
      return [
        { name: "W1", amount: 0 },
        { name: "W2", amount: 0 },
        { name: "W3", amount: 0 }
      ];
    }
    return realizedRecos.map((reco, idx) => {
      cumulative += reco.saving_amount;
      return { name: `S${idx + 1}`, amount: cumulative };
    });
  }, [realizedRecos]);

  // Cost distribution chart
  const resourceTypeCosts = useMemo(() => {
    const costMap: Record<string, number> = {};
    resources.forEach(r => {
      const parts = r.type.split('/');
      const typeLabel = parts[parts.length - 1] || "Other";
      costMap[typeLabel] = (costMap[typeLabel] || 0) + 120; // default estimated monthly cost base
    });
    return Object.entries(costMap).map(([name, value]) => ({ name, value }));
  }, [resources]);

  return (
    <div className="space-y-6 fade-in-up">
      
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-foreground uppercase">Executive Operations Center</h2>
          <p className="text-xs text-muted-foreground mt-1">Autonomous tenant intelligence, budget policies, and resource guardrails.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-card/85 rounded border border-border">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isRunning ? 'bg-primary' : 'bg-success'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isRunning ? 'bg-primary' : 'bg-success'}`}></span>
            </span>
            <span className="text-[10px] font-mono font-bold text-foreground uppercase tracking-wider">
              {isRunning ? "Autonomous Swarm Processing" : "Policies Compliant"}
            </span>
          </div>
        </div>
      </div>

      {/* Real-time agent node monitors */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Telemetry Node */}
        <div className={`glass-panel p-4 rounded border transition-colors ${telemetryStatus === 'running' ? 'border-primary/80 bg-primary/5' : 'border-border'}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-foreground">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider font-mono">Telemetry Collection</span>
            </div>
            {telemetryStatus === "running" && <span className="h-2 w-2 bg-primary rounded-full animate-status-pulse" />}
            {telemetryStatus === "completed" && <CheckCircle2 className="h-4 w-4 text-success" />}
          </div>
          <p className="text-[11px] text-muted-foreground font-mono leading-relaxed">
            {telemetryStatus === "running" ? "Polling monitor diagnostics..." : 
             telemetryStatus === "completed" ? "System telemetry aggregated successfully." : "Awaiting scan trigger..."}
          </p>
        </div>

        {/* Policy evaluation Node */}
        <div className={`glass-panel p-4 rounded transition-colors ${policyStatus === 'running' ? 'border-primary/80 bg-primary/5' : 'border-border'}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-foreground">
              <ShieldCheck className="h-4 w-4 text-warning" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider font-mono">Governance Audit</span>
            </div>
            {policyStatus === "running" && <span className="h-2 w-2 bg-warning rounded-full animate-status-pulse" />}
            {policyStatus === "completed" && <CheckCircle2 className="h-4 w-4 text-success" />}
          </div>
          <p className="text-[11px] text-muted-foreground font-mono leading-relaxed">
            {policyStatus === "running" ? "Checking asset compliance bounds..." : 
             policyStatus === "completed" ? "All resource guardrails evaluated." : "Awaiting telemetry input..."}
          </p>
        </div>

        {/* Action Dispatcher Node */}
        <div className={`glass-panel p-4 rounded transition-colors ${executionStatus === 'running' ? 'border-primary/80 bg-primary/5' : 'border-border'}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-foreground">
              <Zap className="h-4 w-4 text-success" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider font-mono">Action Dispatcher</span>
            </div>
            {executionStatus === "running" && <span className="h-2 w-2 bg-success rounded-full animate-status-pulse" />}
            {executionStatus === "completed" && <CheckCircle2 className="h-4 w-4 text-success" />}
          </div>
          <p className="text-[11px] text-muted-foreground font-mono leading-relaxed">
            {executionStatus === "running" ? "Executing target remediation API..." : 
             activeRunDetails?.db_record?.status === "blocked_on_approval" ? "Awaiting manual gate signature..." :
             "Awaiting final execution sequence..."}
          </p>
        </div>

      </div>

      {/* Stdout Console Bar */}
      <div className="w-full bg-black/95 border border-border rounded p-3 font-mono text-[11px] flex items-center gap-3 shadow-inner relative overflow-hidden scanline-effect min-h-[40px]">
        <Terminal className="h-4 w-4 text-primary" />
        <span className="text-primary font-bold">SWARM_OUT:</span>
        <span className={`text-slate-300 truncate flex-grow ${isRunning ? "animate-pulse" : ""}`}>
          {latestLog ? `[${latestLog.agent_name.toUpperCase()}] ${latestLog.payload?.message || latestLog.event_type}` : "Active sweeps completed. Autopilot is listening on azure events."}
        </span>
      </div>

      {/* Executive KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        
        {/* KPI 1 */}
        <div className="bg-card border border-border p-4 rounded shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1 h-full bg-primary" />
          <p className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Azure Assets Discoveries</p>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl font-bold font-mono tracking-tight">{resources.length}</span>
            <span className="text-[10px] text-muted-foreground font-mono">targets</span>
          </div>
          <p className="text-[9px] text-muted-foreground mt-1">Across discovered resource groups</p>
        </div>

        {/* KPI 2 (Discovered Savings) */}
        <div className="bg-card border border-border p-4 rounded shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1 h-full bg-indigo-500" />
          <p className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Discovered Savings</p>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-primary">${totalDiscovered.toFixed(2)}</span>
            <span className="text-[10px] text-primary font-mono">/mo</span>
          </div>
          <p className="text-[9px] text-muted-foreground mt-1">Potential MRR reductions</p>
        </div>

        {/* KPI 3 */}
        <div className="bg-card border border-border p-4 rounded shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1 h-full bg-emerald-500" />
          <p className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Secured Realized Savings</p>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-emerald-500">${totalRealized.toFixed(2)}</span>
            <span className="text-[10px] text-emerald-500 font-mono">/mo</span>
          </div>
          <p className="text-[9px] text-muted-foreground mt-1">From successfully executed actions</p>
        </div>

        {/* KPI 4 */}
        <div className="bg-card border border-border p-4 rounded shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1 h-full bg-warning" />
          <p className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Pending Gate Signatures</p>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl font-bold font-mono tracking-tight">{pendingApprovalsCount}</span>
            <span className="text-[10px] text-muted-foreground font-mono">gates</span>
          </div>
          <p className="text-[9px] text-muted-foreground mt-1">Requires Operator credentials</p>
        </div>

        {/* KPI 5 */}
        <div className="bg-card border border-border p-4 rounded shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1 h-full bg-purple-500" />
          <p className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Mean Swarm Confidence</p>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-primary">{averageConfidence}%</span>
            <span className="text-[10px] text-muted-foreground font-mono">score</span>
          </div>
          <p className="text-[9px] text-muted-foreground mt-1">Heuristics reliability index</p>
        </div>

      </div>

      {/* Visual Analytics sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Savings Progression Trend chart (2 columns) */}
        <div className="lg:col-span-2 bg-card border border-border rounded p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Cumulative Cost Savings Trend</h3>
            <p className="text-[10px] text-muted-foreground">Historical progression of realized monthly MRR reductions</p>
          </div>
          
          <div className="h-64 mt-4">
            {realizedRecos.length === 0 ? (
              <div className="h-full w-full flex flex-col items-center justify-center border border-dashed border-border rounded">
                <TrendingUp className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground italic font-mono">Awaiting execution data to render trend analytics.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={savingsTimelineData}>
                  <defs>
                    <linearGradient id="savingsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="hsl(var(--border) / 0.3)" strokeDasharray="3 3" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(val) => `$${val}`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "4px", fontSize: "11px" }}
                    itemStyle={{ color: "hsl(var(--foreground))", fontWeight: "bold" }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#savingsGrad)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Priority Insight & Platform Health (1 column) */}
        <div className="space-y-6 flex flex-col">
          
          {/* Priority Insight card */}
          <div className="bg-card border border-border rounded p-5 flex-1 flex flex-col justify-between">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Highest Optimization Opportunity</h3>
            
            {highestSavingsInsight ? (
              <div className="space-y-3 mt-4">
                <div className="p-3 bg-secondary/20 border border-border rounded">
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded border border-primary/20 bg-primary/10 text-primary text-[9px] uppercase font-bold tracking-wider font-mono">
                      {highestSavingsInsight.action_type}
                    </span>
                    <span className="text-emerald-500 font-mono font-bold text-sm">+${highestSavingsInsight.saving_amount.toFixed(2)}/mo</span>
                  </div>
                  <p className="font-mono text-xs text-foreground truncate">{highestSavingsInsight.resource_id}</p>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed italic">{highestSavingsInsight.rationale}</p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic mt-4">Zero optimization opportunities pending.</p>
            )}
          </div>

          {/* Platform Health Check card */}
          <div className="bg-card border border-border rounded p-5">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-4">Autonomous Subsystems Status</h3>
            <div className="grid grid-cols-2 gap-3 text-[10px]">
              <div className="flex items-center justify-between p-2 rounded bg-secondary/10 border border-border">
                <span className="text-muted-foreground font-semibold">Orchestrator</span>
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-secondary/10 border border-border">
                <span className="text-muted-foreground font-semibold">Policy Engine</span>
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-secondary/10 border border-border">
                <span className="text-muted-foreground font-semibold">Azure Monitor</span>
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-secondary/10 border border-border">
                <span className="text-muted-foreground font-semibold">Audit Store</span>
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Sweeps timeline view */}
      <div className="bg-card border border-border rounded p-5">
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-4">Recent Orchestrator Swarms</h3>
        
        {runs.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No sweeps recorded.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {runs.slice(0, 4).map((run) => (
              <div key={run.id} className="p-3 bg-secondary/10 border border-border rounded flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-foreground">{run.id.substring(0, 8)}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase font-mono border ${
                    run.status === "running" ? "bg-primary/10 text-primary border-primary/20 animate-pulse" :
                    run.status === "completed" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                    run.status === "blocked_on_approval" ? "bg-warning/10 text-warning border-warning/20" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {run.status.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                  <span>Started:</span>
                  <span className="font-mono">{new Date(run.started_at).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
