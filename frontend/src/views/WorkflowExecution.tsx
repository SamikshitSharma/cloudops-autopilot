import React, { useState } from "react";
import { 
  Play, 
  Settings, 
  Check, 
  X, 
  Clock, 
  UserCheck, 
  HelpCircle, 
  ChevronRight, 
  MessageSquare,
  ShieldCheck
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
  { id: "app_service_resize", label: "Scale Down App Service Plans", desc: "Resize plans with under 10% average utilization." },
];

const WORKFLOW_STEPS = [
  { key: "inventory_sweep", label: "Sweep Inventory" },
  { key: "metric_analysis", label: "Metric Analysis" },
  { key: "decision_making", label: "Remediation Decision" },
  { key: "execution_planning", label: "Plan Creation" },
  { key: "remediation_execution", label: "Cloud Execution" },
  { key: "remediation_verification", label: "Outcome Verification" }
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

  // Helper to determine step visual style
  const getStepStatus = (stepKey: string) => {
    if (!runDetails) return "pending";

    // Check in-memory state steps first
    const backendSteps = runDetails.in_memory_state?.steps || [];
    const stepState = backendSteps.find(s => s.step_name === stepKey);
    
    if (stepState) {
      if (stepState.status.toLowerCase() === "completed" || stepState.status.toLowerCase() === "success") return "completed";
      if (stepState.status.toLowerCase() === "running") return "running";
      if (stepState.status.toLowerCase() === "failed") return "failed";
      if (stepState.status.toLowerCase() === "blocked" || stepState.status.toLowerCase() === "blocked_on_approval") return "blocked";
    }

    // Fallback: search audit logs
    const logs = runDetails.audit_logs || [];
    const stepLogs = logs.filter(l => l.step_name === stepKey);
    if (stepLogs.length > 0) {
      const hasCompleted = stepLogs.some(l => l.event_type === "ToolCompleted" || l.event_type === "WorkflowCompleted");
      const hasFailed = stepLogs.some(l => l.status === "failure");
      if (hasFailed) return "failed";
      if (hasCompleted) return "completed";
      return "running";
    }

    // Special case for global workflow run state
    if (runDetails.db_record.id === activeRunId && runDetails.db_record.status === "blocked_on_approval" && stepKey === "remediation_execution") {
      return "blocked";
    }

    return "pending";
  };

  return (
    <div className="space-y-8">
      {/* Trigger & Selection Container */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Scenario Launcher */}
        <div className="lg:col-span-2 p-6 bg-card border border-border rounded-xl space-y-6">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <h3 className="font-heading font-semibold text-base">Launch Autopilot Reasoning Sweep</h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted">Remediation Policy Scenario</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {SCENARIOS.map((scen) => (
                  <button
                    key={scen.id}
                    type="button"
                    onClick={() => setSelectedScenario(scen.id)}
                    className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      selectedScenario === scen.id
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:bg-muted/10 bg-card"
                    }`}
                  >
                    <span className="font-semibold text-sm text-foreground">{scen.label}</span>
                    <span className="text-xs text-muted mt-2 leading-snug">{scen.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Dry Run Checkbox */}
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/20 border border-border/50">
              <input
                id="dryRun"
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="h-4.5 w-4.5 rounded border-border text-primary focus:ring-primary"
              />
              <label htmlFor="dryRun" className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
                <ShieldCheck className="h-4.5 w-4.5 text-primary" />
                <div>
                  <span className="font-semibold text-foreground">Enable Dry-Run Sweep Mode</span>
                  <p className="text-xs text-muted">Agent reasoning executes fully, but state changes inside Azure will be simulated.</p>
                </div>
              </label>
            </div>

            {/* Submit Button */}
            <div className="flex items-center justify-between">
              {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
              <div />
              <button
                type="submit"
                disabled={isLoading}
                className="flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                <Play className="h-4 w-4" />
                <span>{isLoading ? "Running Sweep..." : "Start Autopilot reasoning"}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Previous Runs List */}
        <div className="p-6 bg-card border border-border rounded-xl flex flex-col h-full overflow-hidden">
          <h3 className="font-heading font-semibold text-base mb-4">Autopilot Run Log Registry</h3>
          <div className="flex-1 overflow-y-auto space-y-2 max-h-80 pr-1">
            {runs.length === 0 ? (
              <p className="text-sm text-muted text-center py-6">No historical runs available.</p>
            ) : (
              runs.map((r) => {
                const isActive = activeRunId === r.id || runDetails?.db_record.id === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => selectRun(r.id)}
                    className={`w-full p-3 rounded-lg border text-left text-xs transition-all flex items-center justify-between ${
                      isActive
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/20"
                    }`}
                  >
                    <div>
                      <span className="font-mono font-semibold text-foreground block truncate w-40">{r.id}</span>
                      <span className="text-muted block mt-1">
                        {new Date(r.started_at).toLocaleString()}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full font-bold uppercase ${
                      r.status === "completed"
                        ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                        : r.status === "failed"
                          ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                          : "bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse"
                    }`}>
                      {r.status}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Selected Run Visual Pipeline */}
      {runDetails && (
        <div className="p-6 bg-card border border-border rounded-xl space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-semibold text-base">Active Workflow Step Progress</h3>
            <span className="font-mono text-xs text-muted">Run ID: {runDetails.db_record.id}</span>
          </div>

          {/* Horizontal Step Train */}
          <div className="flex items-center justify-between overflow-x-auto py-4 min-w-[600px]">
            {WORKFLOW_STEPS.map((step, idx) => {
              const status = getStepStatus(step.key);
              return (
                <React.Fragment key={step.key}>
                  <div className="flex flex-col items-center space-y-2 relative z-10">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all ${
                      status === "completed"
                        ? "bg-emerald-500/10 border-emerald-500 text-emerald-500"
                        : status === "running"
                          ? "bg-primary/10 border-primary text-primary animate-pulse"
                          : status === "blocked"
                            ? "bg-amber-500/10 border-amber-500 text-amber-500 animate-pulse"
                            : status === "failed"
                              ? "bg-rose-500/10 border-rose-500 text-rose-500"
                              : "bg-muted/10 border-border text-muted-foreground"
                    }`}>
                      {status === "completed" && <Check className="h-5 w-5" />}
                      {status === "failed" && <X className="h-5 w-5" />}
                      {status === "running" && <Clock className="h-5 w-5" />}
                      {status === "blocked" && <UserCheck className="h-5 w-5" />}
                      {status === "pending" && <span className="text-xs font-bold">{idx + 1}</span>}
                    </div>
                    <span className="text-[11px] font-semibold text-center whitespace-nowrap text-foreground">
                      {step.label}
                    </span>
                  </div>
                  {idx < WORKFLOW_STEPS.length - 1 && (
                    <div className="flex-1 h-0.5 border-t border-dashed border-border mx-4" />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Agent Reasoning Traces */}
          <div className="pt-6 border-t border-border space-y-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <h4 className="font-heading font-semibold text-sm">Agent Collaboration Reasoning Timeline</h4>
            </div>

            <div className="space-y-4">
              {runDetails.audit_logs.length === 0 ? (
                <p className="text-xs text-muted italic">Scanning Azure subscriptions... reasoning traces will populate shortly.</p>
              ) : (
                runDetails.audit_logs
                  .filter(l => l.event_type.startsWith("Tool") || l.event_type.startsWith("Workflow"))
                  .map((log) => {
                    const isTelemetry = log.agent_name === "telemetry_agent";
                    const isDecision = log.agent_name === "decision_agent";
                    const isExecution = log.agent_name === "execution_agent";
                    
                    return (
                      <div key={log.id} className="flex gap-4 items-start p-4 bg-muted/20 border border-border rounded-lg">
                        <div className={`text-xs px-2.5 py-1 rounded-md font-bold uppercase ${
                          isTelemetry
                            ? "bg-cyan-500/10 text-cyan-500 border border-cyan-500/20"
                            : isDecision
                              ? "bg-indigo-500/10 text-indigo-500 border border-indigo-500/20"
                              : isExecution
                                ? "bg-pink-500/10 text-pink-500 border border-pink-500/20"
                                : "bg-slate-500/10 text-slate-500 border border-slate-500/20"
                        }`}>
                          {log.agent_name}
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-foreground font-mono">
                              Step: {log.step_name} ({log.event_type})
                            </span>
                            <span className="text-[10px] text-muted">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground font-mono leading-relaxed bg-black/5 dark:bg-black/20 p-2 rounded border border-border/40">
                            {JSON.stringify(log.payload, null, 2)}
                          </p>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
