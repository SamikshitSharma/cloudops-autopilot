import React, { useState } from "react";
import type { RunDTO, RunDetailsDTO, AuditLogDTO } from "../api/client";

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
  { id: "idle_vm", label: "remediation-cost-governance", desc: "Scan and turn off dev VMs idle for >7 days." },
  { id: "unused_disk", label: "unattached-disk-purge", desc: "Find and delete unattached storage blocks." },
  { id: "app_service_resize", label: "app-service-downscale", desc: "Scale down App Service plans with under 10% utilization." },
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
  const [dryRun, setDryRun] = useState(true);
  const [triggering, setTriggering] = useState(false);

  const handleExecute = async () => {
    setTriggering(true);
    try {
      await triggerRun(selectedScenario, dryRun);
    } catch (err) {
      console.error(err);
    } finally {
      setTriggering(false);
    }
  };

  const getLogMessage = (log: AuditLogDTO) => {
    if (log.payload && typeof log.payload === 'object') {
      if (log.payload.message) return log.payload.message;
      if (log.payload.tool_name) return `Executed tool '${log.payload.tool_name}'`;
      if (log.payload.scenario) return `Started sweep scenario '${log.payload.scenario}'`;
    }
    return `${log.event_type} event triggered`;
  };

  const steps = runDetails?.in_memory_state?.steps || [];
  const activeLogs = runDetails?.audit_logs || [];

  return (
    <div className="space-y-6 font-mono text-[11px] leading-relaxed text-muted-foreground fade-in-up">
      
      {/* Header index */}
      <div className="pb-4 border-b border-border">
        <h2 className="text-lg font-bold text-foreground tracking-tight font-sans">compile.workflow</h2>
        <p className="text-[10px] text-muted-foreground mt-1 uppercase font-semibold">Autopilot Orchestrator Runtime Pipeline Compiler</p>
      </div>

      {error && (
        <div className="p-3 border border-destructive/30 bg-destructive/10 rounded text-destructive font-bold">
          [ERROR COMPILING WORKFLOW]: {error}
        </div>
      )}

      {/* Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Column: Compiler Scenarios configuration */}
        <div className="space-y-4 border-r border-border/40 pr-0 lg:pr-6">
          <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest pb-1 border-b border-border">
            COMPILER PARAMETERS
          </div>

          {/* Scenario selector */}
          <div className="space-y-3 mt-3">
            <div className="space-y-1">
              <label className="text-muted-foreground font-sans">Active Target Scenario</label>
              <select
                value={selectedScenario}
                onChange={(e) => setSelectedScenario(e.target.value)}
                className="w-full bg-card border border-border rounded px-2.5 py-1.5 focus:outline-none text-foreground font-mono focus:border-primary text-xs shadow-elevation-1"
              >
                {SCENARIOS.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="text-[10px] text-muted-foreground leading-relaxed">
              {SCENARIOS.find(s => s.id === selectedScenario)?.desc}
            </div>

            {/* Dry run parameter toggle */}
            <div className="flex items-center justify-between py-1.5 border-b border-border/30">
              <span className="font-sans">Compilation Mode</span>
              <button
                onClick={() => setDryRun(!dryRun)}
                className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border transition-colors ${
                  dryRun 
                    ? "bg-secondary text-primary border-primary" 
                    : "bg-card border-border text-foreground hover:bg-secondary/40"
                }`}
              >
                {dryRun ? "DRY_RUN" : "LIVE_COMPILE"}
              </button>
            </div>

            {/* Execute compile trigger */}
            <button
              onClick={handleExecute}
              disabled={isLoading || triggering}
              className="w-full px-4 py-2 bg-foreground text-background font-bold text-center rounded hover:opacity-90 transition-opacity font-mono text-xs shadow-elevation-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {triggering || isLoading ? "[ COMPILING WORKFLOW... ]" : "[ RUN COMPILER PIPELINE ]"}
            </button>
          </div>

          {/* Compiler Run history ledger */}
          <div className="space-y-2 pt-4 border-t border-border/40">
            <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest pb-1">
              COMPILER RUN HISTORY
            </div>
            
            <div className="space-y-1 max-h-[140px] overflow-y-auto custom-scrollbar">
              {runs.map(r => (
                <button
                  key={r.id}
                  onClick={() => selectRun(r.id)}
                  className={`w-full text-left px-2.5 py-1.5 rounded border text-[10px] flex justify-between items-center transition-colors ${
                    activeRunId === r.id 
                      ? "bg-secondary border-primary text-foreground font-bold" 
                      : "bg-card/45 border-border hover:bg-secondary/35 text-muted-foreground"
                  }`}
                >
                  <span className="truncate max-w-[80px]">{r.id}</span>
                  <span className={`uppercase font-semibold text-[9px] ${
                    r.status === 'running' ? 'text-primary' : 
                    r.status === 'completed' ? 'text-success' : 'text-muted-foreground'
                  }`}>
                    {r.status}
                  </span>
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column: Execution steps flowchart + logs */}
        <div className="lg:col-span-2 space-y-4">
          
          <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest pb-1 border-b border-border">
            EXECUTION PIPELINE: {activeRunId || "idle"}
          </div>

          {activeRunId ? (
            <div className="space-y-4">
              
              {/* Vertical steps display */}
              <div className="border border-border p-4 rounded-lg bg-card/10 space-y-3.5 shadow-elevation-1">
                {steps.map((st, index) => {
                  const isCurrent = st.status === 'running';
                  const isDone = st.status === 'completed' || st.status === 'succeeded';
                  
                  return (
                    <div 
                      key={st.step_name}
                      className="flex items-center gap-3.5 text-[10px]"
                    >
                      {/* Step Progress Dot */}
                      <div className="flex flex-col items-center">
                        <div className={`h-4 w-4 rounded-full flex items-center justify-center font-bold text-[9px] border transition-colors ${
                          isCurrent ? 'bg-primary/20 border-primary text-primary animate-status-pulse' :
                          isDone ? 'bg-success/20 border-success text-success' : 'bg-secondary border-border text-muted-foreground'
                        }`}>
                          {index + 1}
                        </div>
                        {index < steps.length - 1 && (
                          <div className={`w-[1px] h-4 bg-border ${isDone ? 'bg-success/50' : ''}`} />
                        )}
                      </div>

                      {/* Step details */}
                      <div className="flex-1 flex justify-between">
                        <span className={`font-bold ${isCurrent ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                          {st.step_name.toUpperCase()}
                        </span>
                        <span className={`uppercase text-[9px] font-semibold ${
                          isCurrent ? 'text-primary animate-status-pulse' :
                          isDone ? 'text-success' : 'text-muted-foreground'
                        }`}>
                          {st.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Console Logs panel */}
              <div className="border border-border rounded-lg bg-card/15 overflow-hidden shadow-elevation-1">
                <div className="bg-card px-3 py-1.5 border-b border-border text-[9px] font-bold uppercase tracking-wide">
                  PIPELINE STDOUT CONSOLE
                </div>
                <div className="p-3 text-[10px] leading-relaxed overflow-y-auto max-h-[140px] bg-background/55 text-muted-foreground font-mono space-y-1 custom-scrollbar">
                  {activeLogs.map((log, idx) => (
                    <div key={idx}>
                      {log.timestamp ? `[${log.timestamp.split('T')[1]?.substring(0, 8)}] ` : ""}
                      <span className="text-foreground">[{log.agent_name.toUpperCase()}]</span> {getLogMessage(log)}
                    </div>
                  ))}
                  {activeLogs.length === 0 && (
                    <div className="text-center text-muted-foreground py-2">No console outputs streamed.</div>
                  )}
                </div>
              </div>

            </div>
          ) : (
            <div className="p-8 border border-border border-dashed rounded text-center text-muted-foreground">
              No active compiler execution runs found. Configure parameters on the left to trigger a pipeline compile sweep.
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
