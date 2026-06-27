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
  History
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
    <div className="space-y-8 animate-fadeIn">
      {/* Header Widget */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#22252d] pb-6">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-wide">AGENT WORKFLOW VISUALIZATION</h2>
          <p className="text-xs text-slate-400 mt-1">Configure policies, trigger sweeps, and monitor active agent collaboration sequences.</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
          <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
          <span>COGNITIVE ENGINE WORKSPACE</span>
        </div>
      </div>

      {/* Trigger & Selection Container */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Scenario Launcher */}
        <div className="lg:col-span-2 p-6 bg-[#111318] border border-[#22252d] rounded-xl space-y-6 shadow-xl">
          <div className="flex items-center gap-2 border-b border-[#22252d] pb-3">
            <Settings className="h-4.5 w-4.5 text-indigo-400" />
            <h3 className="font-heading font-extrabold text-xs uppercase tracking-wider text-slate-200">Launch Autopilot Reasoning Sweep</h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 font-mono">Select Active Remediation Scenario</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {SCENARIOS.map((scen) => (
                  <button
                    key={scen.id}
                    type="button"
                    onClick={() => setSelectedScenario(scen.id)}
                    className={`p-4.5 rounded-xl border text-left flex flex-col justify-between transition-all duration-200 ${
                      selectedScenario === scen.id
                        ? "border-indigo-500 bg-indigo-500/5 shadow-md shadow-indigo-500/5"
                        : "border-[#22252d] hover:bg-[#181b21] bg-[#111318]"
                    }`}
                  >
                    <span className="font-extrabold text-xs text-white uppercase tracking-wide">{scen.label}</span>
                    <span className="text-[10px] text-slate-400 mt-2 leading-relaxed font-medium">{scen.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Dry Run Checkbox */}
            <div className="flex items-center gap-3.5 p-4 rounded-xl bg-[#090b0f] border border-[#22252d]">
              <input
                id="dryRun"
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="h-4.5 w-4.5 rounded border-[#22252d] bg-[#111318] text-indigo-500 focus:ring-0 focus:outline-none cursor-pointer"
              />
              <label htmlFor="dryRun" className="flex items-center gap-2 text-xs cursor-pointer select-none">
                <ShieldCheck className="h-4.5 w-4.5 text-indigo-400" />
                <div>
                  <span className="font-extrabold text-slate-200 uppercase tracking-wider text-[10px] font-mono">Enable Dry-Run Evaluation Mode</span>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-normal">Agent reasoning execution completes in memory without altering cloud states.</p>
                </div>
              </label>
            </div>

            {/* Submit Button */}
            <div className="flex items-center justify-between pt-2">
              {error && <p className="text-xs text-rose-500 font-semibold font-mono">{error}</p>}
              <div />
              <button
                type="submit"
                disabled={isLoading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold uppercase text-xs transition-all disabled:opacity-50 shadow-lg shadow-indigo-600/15"
              >
                <Play className="h-3.5 w-3.5" />
                <span>{isLoading ? "Running Sweep..." : "Launch Autopilot Sweep"}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Previous Runs List */}
        <div className="p-6 bg-[#111318] border border-[#22252d] rounded-xl flex flex-col h-full overflow-hidden shadow-xl">
          <div className="flex items-center gap-2 border-b border-[#22252d] pb-3 mb-4">
            <History className="h-4.5 w-4.5 text-indigo-400" />
            <h3 className="font-heading font-extrabold text-xs uppercase tracking-wider text-slate-200">Historical Sweeps Log</h3>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 max-h-80 pr-1 custom-scrollbar">
            {runs.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8 italic font-mono">No sweeps logged.</p>
            ) : (
              runs.map((r) => {
                const isActive = activeRunId === r.id || runDetails?.db_record.id === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => selectRun(r.id)}
                    className={`w-full p-3 rounded-lg border text-left text-[10px] transition-all duration-200 flex items-center justify-between ${
                      isActive
                        ? "border-indigo-500 bg-indigo-500/5"
                        : "border-[#22252d] hover:bg-[#181b21] bg-[#111318]"
                    }`}
                  >
                    <div>
                      <span className="font-mono font-bold text-white block truncate w-36">{r.id}</span>
                      <span className="text-slate-500 block mt-1 font-mono">
                        {new Date(r.started_at).toLocaleString()}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase border ${
                      r.status === "completed"
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                        : r.status === "failed"
                          ? "bg-rose-500/15 text-rose-400 border-rose-500/25"
                          : "bg-amber-500/15 text-amber-400 border-amber-500/25 animate-pulse"
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
        <div className="p-6 bg-[#111318] border border-[#22252d] rounded-xl space-y-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-[#22252d] pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Active Workflow Step Progress</h3>
            <span className="font-mono text-[10px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded">Run ID: {runDetails.db_record.id}</span>
          </div>

          {/* Horizontal Step Train */}
          <div className="flex items-center justify-between overflow-x-auto py-6 min-w-[600px] bg-[#090b0f]/50 p-4 rounded-xl border border-[#22252d] custom-scrollbar">
            {WORKFLOW_STEPS.map((step, idx) => {
              const status = getStepStatus(step.key);
              return (
                <React.Fragment key={step.key}>
                  <div className="flex flex-col items-center space-y-2 relative z-10">
                    <div className={`h-11 w-11 rounded-full flex items-center justify-center border-2 transition-all duration-200 ${
                      status === "completed"
                        ? "bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/5"
                        : status === "running"
                          ? "bg-indigo-500/15 border-indigo-500 text-indigo-400 animate-pulse shadow-lg shadow-indigo-500/15"
                          : status === "blocked"
                            ? "bg-amber-500/15 border-amber-500 text-amber-400 animate-pulse shadow-lg shadow-amber-500/15"
                            : status === "failed"
                              ? "bg-rose-500/10 border-rose-500 text-rose-400 shadow-lg shadow-rose-500/5"
                              : "bg-[#181b21] border-[#22252d] text-slate-500"
                    }`}>
                      {status === "completed" && <Check className="h-4.5 w-4.5" />}
                      {status === "failed" && <X className="h-4.5 w-4.5" />}
                      {status === "running" && <Clock className="h-4.5 w-4.5" />}
                      {status === "blocked" && <UserCheck className="h-4.5 w-4.5" />}
                      {status === "pending" && <span className="text-[10px] font-mono font-bold">{idx + 1}</span>}
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-center whitespace-nowrap text-slate-300 font-mono">
                      {step.label}
                    </span>
                  </div>
                  {idx < WORKFLOW_STEPS.length - 1 && (
                    <div className="flex-1 h-0.5 border-t border-dashed border-[#22252d] mx-4" />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Agent Reasoning Traces */}
          <div className="pt-6 border-t border-[#22252d] space-y-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4.5 w-4.5 text-indigo-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">Agent Collaboration Reasoning Timeline</h4>
            </div>

            <div className="space-y-4">
              {runDetails.audit_logs.length === 0 ? (
                <p className="text-xs text-slate-500 italic font-mono pl-2">Scanning subscription... reasoning traces will populate.</p>
              ) : (
                runDetails.audit_logs
                  .filter(l => l.event_type.startsWith("Tool") || l.event_type.startsWith("Workflow"))
                  .map((log) => {
                    const isTelemetry = log.agent_name === "telemetry_agent";
                    const isDecision = log.agent_name === "decision_agent";
                    const isExecution = log.agent_name === "execution_agent";
                    
                    return (
                      <div key={log.id} className="flex gap-4 items-start p-4 bg-[#090b0f]/50 border border-[#22252d] rounded-xl hover:border-indigo-500/20 transition-all duration-200 shadow-sm">
                        <div className={`text-[9px] px-2.5 py-1 rounded-md font-bold uppercase tracking-widest font-mono shrink-0 border ${
                          isTelemetry
                            ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                            : isDecision
                              ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                              : isExecution
                                ? "bg-pink-500/10 text-pink-400 border-pink-500/20"
                                : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                        }`}>
                          {log.agent_name}
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-200 font-mono tracking-wider uppercase">
                              Step: {log.step_name} ({log.event_type})
                            </span>
                            <span className="text-[9px] text-slate-500 font-mono">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-xs text-emerald-400 font-mono leading-relaxed bg-[#090b0f] p-3.5 rounded-lg border border-[#1c1e24] overflow-x-auto">
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
