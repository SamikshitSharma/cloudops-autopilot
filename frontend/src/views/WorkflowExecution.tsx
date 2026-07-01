import React, { useState, useMemo } from "react";
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
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Info,
  Terminal,
  FileText,
  BadgeAlert,
  Sliders
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

interface PipelineStep {
  key: string;
  label: string;
  desc: string;
  icon: any;
  purpose: string;
  inputs: string;
  outputs: string;
  confidence: number;
}

const PIPELINE_STEPS: PipelineStep[] = [
  { 
    key: "executive", 
    label: "Executive", 
    desc: "Autonomous Orchestrator initialization",
    icon: Settings,
    purpose: "Evaluate Azure Monitor trigger conditions and set policy objectives.",
    inputs: "tenant_id: default, scenario: cost_remediation",
    outputs: "objective_id: obj-908, workflow_state: active",
    confidence: 98
  },
  { 
    key: "inventory", 
    label: "Inventory", 
    desc: "Asset resource discovery",
    icon: Database,
    purpose: "Scan subscription topology and index virtual compute and unattached disks.",
    inputs: "Azure Resource Manager (ARM) inventory APIs",
    outputs: "resource_list: [vm_targets, disk_targets]",
    confidence: 100
  },
  { 
    key: "telemetry", 
    label: "Telemetry", 
    desc: "Performance metric collection",
    icon: Activity,
    purpose: "Query CPU, memory, and network throughput thresholds over a 7-day baseline.",
    inputs: "Azure Monitor metrics, TCP connection stats",
    outputs: "metric_log: average_cpu < 2.5%, idle_intervals_detected",
    confidence: 96
  },
  { 
    key: "analysis", 
    label: "Analysis", 
    desc: "Cognitive reasoning analysis",
    icon: Cpu,
    purpose: "Analyze telemetry logs against target cost-efficiency profiles.",
    inputs: "metric_log: average_cpu < 2.5%",
    outputs: "state_decision: resource_underutilized",
    confidence: 94
  },
  { 
    key: "recommendation", 
    label: "Recommendation", 
    desc: "Cost reduction proposal",
    icon: FileCode,
    purpose: "Formulate stop/resize recommendations with concrete monthly savings projections.",
    inputs: "resource_id, state_decision: idle",
    outputs: "action: stop_vm, projected_savings: $50.00/mo",
    confidence: 95
  },
  { 
    key: "risk", 
    label: "Risk Profile", 
    desc: "Guardrails compliance check",
    icon: ShieldCheck,
    purpose: "Evaluate proposed actions against safety bounds and risk matrices.",
    inputs: "action: stop_vm, env: production",
    outputs: "risk_score: high, safety_clearance: requires_operator_signature",
    confidence: 97
  },
  { 
    key: "approval", 
    label: "Approval", 
    desc: "Operator token check",
    icon: Lock,
    purpose: "Cryptographic gate to verify human operator signature for execution payload.",
    inputs: "approval_token: null, state: pending",
    outputs: "signature: verified, token: dec-890",
    confidence: 100
  },
  { 
    key: "execution", 
    label: "Execution", 
    desc: "Cloud action dispatch",
    icon: Zap,
    purpose: "Deliver active REST payloads to the azure cloud provider to apply changes.",
    inputs: "action_payload: stopVM, targets: [vm-01]",
    outputs: "azure_api_response: 200_OK, status: stopped",
    confidence: 99
  },
  { 
    key: "audit", 
    label: "Audit ledger", 
    desc: "Immutable ledger logging",
    icon: CheckCircle2,
    purpose: "Record step metrics, actions, and signatures permanently in the audit ledger database.",
    inputs: "run_details, logs, operator_hash",
    outputs: "audit_ledger_record: audit-0988, status: locked",
    confidence: 100
  }
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
  const [selectedStageKey, setSelectedStageKey] = useState<string | null>("executive");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await triggerRun(selectedScenario, dryRun);
    } catch (err) {
      // Handled by hook
    }
  };

  const getStepStatus = (stepKey: string) => {
    if (!runDetails) return "pending";

    // 1. Executive
    if (stepKey === "executive") {
      return "completed";
    }

    // 2. Inventory
    if (stepKey === "inventory") {
      const step = runDetails.in_memory_state?.steps.find(s => s.step_name === "inventory_sweep");
      if (step) return step.status.toLowerCase() === "completed" || step.status.toLowerCase() === "success" ? "completed" : step.status.toLowerCase();
      return "pending";
    }

    // 3. Telemetry
    if (stepKey === "telemetry") {
      const step = runDetails.in_memory_state?.steps.find(s => s.step_name === "metric_analysis");
      if (step) return step.status.toLowerCase() === "completed" || step.status.toLowerCase() === "success" ? "completed" : step.status.toLowerCase();
      return "pending";
    }

    // 4. Analysis
    if (stepKey === "analysis") {
      const step = runDetails.in_memory_state?.steps.find(s => s.step_name === "decision_making");
      if (step) return step.status.toLowerCase() === "completed" || step.status.toLowerCase() === "success" ? "completed" : step.status.toLowerCase();
      return "pending";
    }

    // 5. Recommendation
    if (stepKey === "recommendation") {
      const step = runDetails.in_memory_state?.steps.find(s => s.step_name === "execution_planning");
      if (step) return step.status.toLowerCase() === "completed" || step.status.toLowerCase() === "success" ? "completed" : step.status.toLowerCase();
      return "pending";
    }

    // 6. Risk (Inferred from decision_making or execution_planning completion)
    if (stepKey === "risk") {
      const decisionStep = runDetails.in_memory_state?.steps.find(s => s.step_name === "execution_planning");
      if (decisionStep?.status.toLowerCase() === "completed" || decisionStep?.status.toLowerCase() === "success") {
        return "completed";
      }
      return "pending";
    }

    // 7. Approval
    if (stepKey === "approval") {
      if (runDetails.db_record.status === "blocked_on_approval") return "running";
      if (runDetails.db_record.status === "completed" || runDetails.db_record.status === "failed") return "completed";
      
      const planStep = runDetails.in_memory_state?.steps.find(s => s.step_name === "execution_planning");
      if (planStep?.status === "completed") {
        if (runDetails.db_record.status === "running") return "completed"; 
      }
      return "pending";
    }

    // 8. Execution
    if (stepKey === "execution") {
      const step = runDetails.in_memory_state?.steps.find(s => s.step_name === "remediation_execution");
      if (step) return step.status.toLowerCase() === "completed" || step.status.toLowerCase() === "success" ? "completed" : step.status.toLowerCase();
      if (runDetails.db_record.status === "blocked_on_approval") return "pending";
      return "pending";
    }

    // 9. Audit
    if (stepKey === "audit") {
      const step = runDetails.in_memory_state?.steps.find(s => s.step_name === "remediation_verification");
      if (step) return step.status.toLowerCase() === "completed" || step.status.toLowerCase() === "success" ? "completed" : step.status.toLowerCase();
      return "pending";
    }

    return "pending";
  };

  const selectedStage = useMemo(() => {
    return PIPELINE_STEPS.find(s => s.key === selectedStageKey) || PIPELINE_STEPS[0];
  }, [selectedStageKey]);

  return (
    <div className="space-y-6 fade-in-up">
      
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-xl font-extrabold text-foreground uppercase">Autonomous Orchestrator Swarm</h2>
          <p className="text-xs text-muted-foreground mt-1">Deploy, trigger, and inspect cognitive multi-agent orchestration pipelines.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left column: Setup & history (1 column) */}
        <div className="space-y-6">
          
          {/* Launch Swarm Card */}
          <div className="bg-card border border-border p-5 rounded">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-2 mb-4 uppercase tracking-wider">
              <Play className="h-4 w-4 text-primary" />
              Launch Scan
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                {SCENARIOS.map((scen) => (
                  <button
                    key={scen.id}
                    type="button"
                    onClick={() => setSelectedScenario(scen.id)}
                    className={`w-full p-3 rounded border text-left flex flex-col justify-between transition-all duration-150 ${
                      selectedScenario === scen.id
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border bg-secondary/10 hover:bg-secondary/40"
                    }`}
                  >
                    <span className={`text-[10px] font-extrabold uppercase tracking-wider font-mono ${selectedScenario === scen.id ? 'text-primary' : 'text-slate-300'}`}>
                      {scen.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground mt-1 leading-normal">{scen.desc}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded bg-secondary/10 border border-border mt-3">
                <input
                  id="dryRun"
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border bg-background text-primary focus:ring-0 cursor-pointer"
                />
                <label htmlFor="dryRun" className="text-[10px] font-bold text-foreground cursor-pointer uppercase tracking-wider select-none">
                  Dry Run Mode (Simulate)
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded bg-primary hover:bg-primary/95 text-primary-foreground text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50"
              >
                {isLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                Trigger Swarm
              </button>
              
              {error && (
                <div className="p-3 bg-danger/10 border border-danger/25 rounded">
                  <p className="text-[10px] text-danger font-mono font-bold leading-normal">{error}</p>
                </div>
              )}
            </form>
          </div>

          {/* Pipeline History Card */}
          <div className="bg-card border border-border p-5 rounded h-64 flex flex-col">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-2 mb-4 uppercase tracking-wider">
              <History className="h-4 w-4 text-muted-foreground" />
              Swarm History
            </h3>
            <div className="flex-grow overflow-y-auto space-y-2 custom-scrollbar pr-1">
              {runs.map((r) => (
                <button
                  key={r.id}
                  onClick={() => selectRun(r.id)}
                  className={`w-full text-left p-2.5 rounded border text-[10px] font-mono transition-colors flex items-center justify-between ${
                    r.id === activeRunId
                      ? "border-primary bg-primary/5 font-bold"
                      : "border-border bg-secondary/15 hover:bg-secondary/30"
                  }`}
                >
                  <div className="overflow-hidden mr-2">
                    <div className="font-bold text-foreground">{r.id.substring(0, 8)}</div>
                    <div className="text-[8px] text-muted-foreground mt-0.5 truncate uppercase">{(r as any).scenario_type || "Scenario"}</div>
                  </div>
                  <div>
                    {r.status === "running" && <RefreshCw className="h-3.5 w-3.5 text-primary animate-spin" />}
                    {r.status === "completed" && <Check className="h-3.5 w-3.5 text-success" />}
                    {r.status === "blocked_on_approval" && <Lock className="h-3.5 w-3.5 text-warning animate-pulse" />}
                    {r.status === "failed" && <X className="h-3.5 w-3.5 text-danger" />}
                  </div>
                </button>
              ))}
              {runs.length === 0 && (
                <p className="text-xs text-muted-foreground text-center mt-12 italic">No execution history found.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right column: Swarm visualization & inspector (3 columns) */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Swarm Node visualization card */}
          <div className="bg-card border border-border p-5 rounded min-h-[480px] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-border pb-3 mb-5">
                <div>
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Swarm Engine Visualization</h3>
                  {runDetails ? (
                    <p className="text-[9px] font-mono text-muted-foreground mt-0.5">
                      RUN_ID: <span className="text-primary font-bold">{runDetails.db_record.id}</span>
                    </p>
                  ) : (
                    <p className="text-[10px] text-muted-foreground mt-0.5">Select a run in history to trace node executions.</p>
                  )}
                </div>
                {runDetails && runDetails.db_record.status === "running" && (
                  <span className="px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary text-[8px] font-extrabold tracking-widest uppercase animate-pulse">
                    Executing Nodes
                  </span>
                )}
              </div>

              {/* Graphical Sequence Pipeline */}
              <div className="py-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-y-6 gap-x-2 relative">
                  {/* Grid path line */}
                  <div className="absolute top-5 left-4 right-4 h-0.5 bg-border z-0 hidden md:block" />
                  
                  {PIPELINE_STEPS.map((step) => {
                    const status = getStepStatus(step.key);
                    const Icon = step.icon;
                    const isSelected = selectedStageKey === step.key;

                    let bgStyle = "bg-card border-border text-muted-foreground";
                    let glowStyle = "";
                    if (status === "completed") {
                      bgStyle = "bg-primary border-primary text-primary-foreground";
                    } else if (status === "running") {
                      bgStyle = "bg-background border-primary text-primary";
                      glowStyle = "animate-pulse-ring";
                    } else if (status === "blocked") {
                      bgStyle = "bg-warning/20 border-warning text-warning";
                      glowStyle = "animate-approval-glow";
                    } else if (status === "failed") {
                      bgStyle = "bg-danger/25 border-danger text-danger";
                    }

                    return (
                      <div 
                        key={step.key} 
                        onClick={() => setSelectedStageKey(step.key)}
                        className="flex flex-col items-center z-10 cursor-pointer group"
                      >
                        <div className={`h-10 w-10 rounded border-2 flex items-center justify-center transition-all ${bgStyle} ${glowStyle} ${isSelected ? 'scale-110 ring-2 ring-primary/45' : 'hover:scale-105'}`}>
                          <Icon className="h-4.5 w-4.5" />
                        </div>
                        <span className="text-[9px] font-extrabold uppercase mt-2 font-mono text-center max-w-[80px] truncate leading-none">
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Selected node inspect summary details */}
            <div className="p-4 bg-secondary/10 border border-border rounded mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded bg-secondary text-foreground">
                    {React.createElement(selectedStage.icon, { className: "h-3.5 w-3.5 text-primary" })}
                  </span>
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">{selectedStage.label} Node Details</h4>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{selectedStage.purpose}</p>
                <div className="grid grid-cols-2 gap-4 text-[10px] font-mono mt-2 border-t border-border/50 pt-2">
                  <div>
                    <span className="text-[8px] text-muted-foreground uppercase block font-bold">Input Payload</span>
                    <span className="text-foreground truncate block mt-0.5">{selectedStage.inputs}</span>
                  </div>
                  <div>
                    <span className="text-[8px] text-muted-foreground uppercase block font-bold">Output Yield</span>
                    <span className="text-foreground truncate block mt-0.5">{selectedStage.outputs}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-card border border-border rounded flex flex-col justify-between">
                <div>
                  <span className="text-[8px] text-muted-foreground uppercase block font-bold">Node Confidence</span>
                  <span className="text-lg font-bold font-mono text-primary mt-1 block">{selectedStage.confidence}%</span>
                </div>
                <div className="mt-2">
                  <span className="text-[8px] text-muted-foreground uppercase block font-bold">Target State</span>
                  <span className={`inline-flex items-center gap-1 mt-1 text-[9px] font-bold uppercase font-mono px-2 py-0.5 rounded border ${
                    getStepStatus(selectedStage.key) === "completed" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                    getStepStatus(selectedStage.key) === "running" ? "bg-primary/10 text-primary border-primary/20 animate-pulse" :
                    "bg-secondary text-muted-foreground"
                  }`}>
                    {getStepStatus(selectedStage.key)}
                  </span>
                </div>
              </div>
            </div>

            {/* Logs standard output stream */}
            <div className="h-44 bg-black/90 border border-border rounded p-3 font-mono text-[10px] overflow-hidden flex flex-col scanline-effect relative mt-6">
              <div className="flex items-center justify-between border-b border-border/50 pb-1.5 mb-2">
                <span className="text-[8px] text-muted-foreground font-extrabold tracking-widest uppercase">System Swarm Console</span>
                <span className={`h-1.5 w-1.5 rounded-full ${runDetails?.db_record.status === "running" ? "bg-primary animate-pulse" : "bg-muted-foreground/30"}`} />
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
                {!runDetails ? (
                  <p className="text-muted-foreground italic">Awaiting execution data...</p>
                ) : (
                  <>
                    <p className="text-primary">{`> bootloader: swarmlink initialized.`}</p>
                    <p className="text-primary">{`> run: scenario_type = ${runDetails.in_memory_state?.scenario_name || "manual_sweep"}`}</p>
                    
                    {runDetails.audit_logs?.map((log, idx) => (
                      <div key={idx} className="flex gap-2 py-0.5 hover:bg-white/5 px-1 rounded transition-colors text-slate-300">
                        <span className="text-muted-foreground opacity-55 shrink-0">
                          {new Date(log.timestamp).toISOString().split('T')[1].substring(0,8)}
                        </span>
                        <span className="break-all">
                          <span className="text-primary font-bold mr-1">[{log.agent_name.replace('_agent', '').toUpperCase()}]</span>
                          {log.payload?.message || log.event_type}
                        </span>
                      </div>
                    ))}

                    {runDetails.db_record.status === "blocked_on_approval" && (
                      <div className="text-warning animate-pulse mt-2 border-l-2 border-warning pl-2">
                        {`> governance: target checks complete. action paused.`}<br/>
                        {`> governance: approval signature token signature pending.`}
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
