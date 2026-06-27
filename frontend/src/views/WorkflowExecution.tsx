import React, { useState } from "react";
import { 
  Play, 
  Settings, 
  Check, 
  X, 
  Clock, 
  UserCheck, 
  MessageSquare,
  ShieldCheck,
  ChevronRight,
  Database,
  History,
  Cpu,
  RefreshCw,
  Search,
  Activity,
  FileCode,
  Lock,
  Zap,
  CheckCircle2
} from "lucide-react";
import type { RunDTO, RunDetailsDTO } from "../api/client";

interface WorkflowExecutionProps {
  runs: RunDTO[];
  activeRunId: string | null;
  runDetails: RunDetailsDTO | null;
  isLoading: boolean;
  error: string | null;
  triggerRun: (scenario: string, dryRun: boolean) => Promise<string>;
  selectRun: (runId: string) => void;
}

const SCENARIOS = [
  { id: "idle_vm", label: "Stop Idle VMs", desc: "Scan and turn off dev VMs idle for >7 days." },
  { id: "unused_disk", label: "Purge Unattached Disks", desc: "Find and delete unattached storage blocks." },
  { id: "app_service_resize", label: "Scale Down App Service", desc: "Resize plans with under 10% average utilization." },
];

const WORKFLOW_STEPS = [
  { key: "inventory_sweep", label: "Inventory Sweep", icon: Search },
  { key: "metric_analysis", label: "Telemetry Collection", icon: Activity },
  { key: "decision_making", label: "Agent Reasoning", icon: Cpu },
  { key: "execution_planning", label: "Plan Generation", icon: FileCode },
  { key: "approval", label: "Human Approval", icon: Lock },
  { key: "remediation_execution", label: "Cloud Execution", icon: Zap },
  { key: "remediation_verification", label: "Verification", icon: CheckCircle2 }
];

export function WorkflowExecution({
  runs,
  activeRunId,
  runDetails,
  isLoading,
  error,
  triggerRun,
  selectRun
}: WorkflowExecutionProps) {
  const [selectedScenario, setSelectedScenario] = useState("idle_vm");
  const [dryRun, setDryRun] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await triggerRun(selectedScenario, dryRun);
    } catch (err) {
      // Handled by hook
    }
  };

  // Helper to determine step visual style based on backend state
  const getStepStatus = (stepKey: string) => {
    if (!runDetails) return "pending";

    // MOCKING the "Approval" step which is implied by blocked_on_approval status
    if (stepKey === "approval") {
      if (runDetails.db_record.status === "blocked_on_approval") return "running";
      if (runDetails.db_record.status === "completed" || runDetails.db_record.status === "failed") return "completed";
      // If we haven't reached execution planning, approval is pending
      const planStep = runDetails.in_memory_state?.steps.find(s => s.step_name === "execution_planning");
      if (planStep?.status === "completed") {
        if (runDetails.db_record.status === "running") return "completed"; // Approved
      }
      return "pending";
    }

    const backendSteps = runDetails.in_memory_state?.steps || [];
    const stepState = backendSteps.find(s => s.step_name === stepKey);
    
    if (stepState) {
      if (stepState.status.toLowerCase() === "completed" || stepState.status.toLowerCase() === "success") return "completed";
      if (stepState.status.toLowerCase() === "running") return "running";
      if (stepState.status.toLowerCase() === "failed") return "failed";
      if (stepState.status.toLowerCase() === "blocked" || stepState.status.toLowerCase() === "blocked_on_approval") return "blocked";
    }

    // Special case fallback for global execution
    if (runDetails.db_record.id === activeRunId && runDetails.db_record.status === "blocked_on_approval" && stepKey === "remediation_execution") {
      return "pending";
    }
    
    // Check logs if stepState isn't explicit
    const logs = runDetails.audit_logs || [];
    const stepLogs = logs.filter(l => l.step_name === stepKey);
    if (stepLogs.length > 0) {
      if (stepLogs.some(l => l.status === "failure")) return "failed";
      if (stepLogs.some(l => l.event_type === "ToolCompleted" || l.event_type === "WorkflowCompleted")) return "completed";
      return "running";
    }

    return "pending";
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Execution Pipeline</h2>
          <p className="text-sm text-muted-foreground mt-1">Multi-agent orchestration workflows and execution traces.</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-primary font-mono bg-primary/10 px-3 py-1.5 rounded-md border border-primary/20">
          <Cpu className="h-3.5 w-3.5 animate-pulse" />
          <span>SWARM ORCHESTRATOR ONLINE</span>
        </div>
      </div>

      {/* Main Grid Container */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Run Configuration */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel p-5 rounded-xl border border-border">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
              <Play className="h-4 w-4 text-primary" />
              Launch Sweep
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                {SCENARIOS.map((scen) => (
                  <button
                    key={scen.id}
                    type="button"
                    onClick={() => setSelectedScenario(scen.id)}
                    className={`w-full p-3 rounded-lg border text-left flex flex-col justify-between transition-all duration-200 ${
                      selectedScenario === scen.id
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-border bg-card hover:bg-muted"
                    }`}
                  >
                    <span className={`text-xs font-bold uppercase tracking-wider ${selectedScenario === scen.id ? 'text-primary' : 'text-foreground'}`}>
                      {scen.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground mt-1">{scen.desc}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border mt-4">
                <input
                  id="dryRun"
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                  className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <label htmlFor="dryRun" className="text-xs font-medium text-foreground cursor-pointer flex-1">
                  Dry Run Mode (Simulate Only)
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
              >
                {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
                Execute Pipeline
              </button>
              
              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                  <p className="text-[11px] text-destructive font-mono font-medium">{error}</p>
                </div>
              )}
            </form>
          </div>

          {/* Historical Runs */}
          <div className="glass-panel p-5 rounded-xl border border-border h-[280px] flex flex-col">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
              <History className="h-4 w-4 text-muted-foreground" />
              Pipeline History
            </h3>
            <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
              {runs.map((r) => (
                <button
                  key={r.id}
                  onClick={() => selectRun(r.id)}
                  className={`w-full text-left p-3 rounded-lg border text-xs transition-colors flex items-center justify-between ${
                    r.id === activeRunId
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:bg-muted"
                  }`}
                >
                  <div>
                    <div className="font-mono font-bold text-foreground">{r.id.substring(0, 8)}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{(r as any).scenario_type || "Unknown"}</div>
                  </div>
                  <div>
                    {r.status === "running" && <RefreshCw className="h-4 w-4 text-primary animate-spin" />}
                    {r.status === "completed" && <Check className="h-4 w-4 text-emerald-500" />}
                    {r.status === "blocked_on_approval" && <Lock className="h-4 w-4 text-amber-500" />}
                    {r.status === "failed" && <X className="h-4 w-4 text-destructive" />}
                  </div>
                </button>
              ))}
              {runs.length === 0 && (
                <p className="text-xs text-muted-foreground text-center mt-8">No historical executions found.</p>
              )}
            </div>
          </div>
        </div>

        {/* Live Visualization */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel rounded-xl border border-border p-6 min-h-[620px] flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-bold text-foreground">Live Telemetry & Orchestration</h3>
                {runDetails ? (
                  <p className="text-xs text-muted-foreground mt-1 font-mono">
                    Tracking Run: <span className="text-primary">{runDetails.db_record.id}</span>
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">Select or launch a sweep to monitor agent activity.</p>
                )}
              </div>
              {runDetails && runDetails.db_record.status === "running" && (
                <div className="px-3 py-1 bg-primary/20 text-primary border border-primary/30 rounded text-[10px] font-bold font-mono tracking-widest uppercase animate-pulse">
                  Processing
                </div>
              )}
            </div>

            {/* Visual Pipeline */}
            <div className="mb-10">
              <div className="flex justify-between relative">
                {/* Background Track Line */}
                <div className="absolute top-6 left-6 right-6 h-0.5 bg-muted z-0"></div>
                
                {/* Active Progress Line */}
                <div className="absolute top-6 left-6 h-0.5 bg-primary z-0 transition-all duration-700 ease-in-out" 
                     style={{ 
                       width: runDetails ? 
                         `${(WORKFLOW_STEPS.findIndex(s => getStepStatus(s.key) === "running" || getStepStatus(s.key) === "pending") === -1 
                            ? WORKFLOW_STEPS.length - 1 
                            : Math.max(0, WORKFLOW_STEPS.findIndex(s => getStepStatus(s.key) === "running" || getStepStatus(s.key) === "pending") - 1)) * (100 / (WORKFLOW_STEPS.length - 1))}%` 
                         : '0%' 
                     }}>
                </div>

                {/* Pipeline Nodes */}
                {WORKFLOW_STEPS.map((step, index) => {
                  const status = getStepStatus(step.key);
                  const Icon = step.icon;
                  
                  let bgColor = "bg-card";
                  let borderColor = "border-border";
                  let iconColor = "text-muted-foreground";
                  let animationClass = "";

                  if (status === "completed") {
                    bgColor = "bg-primary";
                    borderColor = "border-primary";
                    iconColor = "text-primary-foreground";
                  } else if (status === "running") {
                    bgColor = "bg-background";
                    borderColor = "border-primary";
                    iconColor = "text-primary";
                    animationClass = "animate-pulse-ring"; // from our custom CSS
                  } else if (status === "blocked") {
                    bgColor = "bg-amber-500/20";
                    borderColor = "border-amber-500";
                    iconColor = "text-amber-500";
                    animationClass = "animate-pulse";
                  } else if (status === "failed") {
                    bgColor = "bg-destructive/20";
                    borderColor = "border-destructive";
                    iconColor = "text-destructive";
                  }

                  return (
                    <div key={step.key} className="flex flex-col items-center z-10 relative group w-14">
                      <div className={`h-12 w-12 rounded-xl border-2 flex items-center justify-center transition-all duration-300 ${bgColor} ${borderColor} ${animationClass}`}>
                        <Icon className={`h-5 w-5 ${iconColor}`} />
                      </div>
                      
                      {/* Tooltip on hover */}
                      <div className="absolute -bottom-8 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-card border border-border px-2 py-1 rounded text-[10px] font-medium z-20 pointer-events-none">
                        {step.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Agent Memory / Logs Stream */}
            <div className="flex-1 bg-black/60 border border-border rounded-xl p-4 font-mono overflow-hidden flex flex-col scanline-effect relative">
              <div className="flex items-center justify-between mb-3 border-b border-border/50 pb-2">
                <span className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">Agent STDOUT</span>
                <span className="flex h-2 w-2 relative">
                  {runDetails?.db_record.status === "running" && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${runDetails?.db_record.status === "running" ? "bg-emerald-500" : "bg-muted-foreground"}`}></span>
                </span>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 text-[11px]">
                {!runDetails ? (
                  <div className="text-muted-foreground italic mt-4">Awaiting execution context...</div>
                ) : (
                  <>
                    <div className="text-primary">{`> Initializing Orchestrator Agent...`}</div>
                    <div className="text-primary">{`> Loading scenario: ${runDetails.in_memory_state?.scenario_name || "Unknown"}`}</div>
                    <div className="text-primary">{`> Binding target subscriptions...`}</div>
                    
                    {runDetails.audit_logs?.map((log, idx) => (
                      <div key={idx} className={`flex gap-3 py-0.5 hover:bg-white/5 px-1 rounded transition-colors ${
                        log.status === "failure" ? "text-destructive" :
                        log.event_type === "AgentAction" ? "text-amber-400" :
                        "text-emerald-400"
                      }`}>
                        <span className="text-muted-foreground shrink-0 w-[60px] opacity-50">
                          {new Date(log.timestamp).toISOString().split('T')[1].substring(0,8)}
                        </span>
                        <span className="break-all">
                          {log.event_type === "AgentAction" && <span className="text-primary font-bold mr-2">[AGENT]</span>}
                          {log.event_type === "ToolStarted" && <span className="text-muted-foreground mr-2">[CALL]</span>}
                          {log.event_type === "ToolCompleted" && <span className="text-emerald-500 mr-2">[RETURN]</span>}
                          {log.payload?.message || log.event_type}
                          {log.status === "failure" && log.payload?.details && ` - Error: ${log.payload.details}`}
                        </span>
                      </div>
                    ))}
                    
                    {runDetails.db_record.status === "blocked_on_approval" && (
                      <div className="text-amber-400 animate-pulse mt-4 border-l-2 border-amber-400 pl-2">
                        {`> WARN: Execution paused.`}<br/>
                        {`> Awaiting cryptographically signed operator approval.`}<br/>
                        {`> Navigate to Approval Center.`}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
