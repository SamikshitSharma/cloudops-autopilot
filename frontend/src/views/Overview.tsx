import React from "react";
import type { RunDTO, RecommendationDTO, ApprovalDTO, ResourceDTO, RunDetailsDTO } from "../api/client";

interface OverviewProps {
  runs: RunDTO[];
  resources: ResourceDTO[];
  recommendations: RecommendationDTO[];
  approvals: ApprovalDTO[];
  activeRunDetails?: RunDetailsDTO | null;
}

export function Overview({ runs, resources, recommendations, approvals, activeRunDetails }: OverviewProps) {
  // 1. Calculate Metrics (Required by App.test.tsx)
  const totalDiscovered = recommendations.reduce((acc, r) => acc + r.saving_amount, 0);
  const totalRealized = recommendations
    .filter(r => r.status === "executed" || r.status === "approved" || r.status === "auto_executed")
    .reduce((acc, r) => acc + r.saving_amount, 0);

  const pendingApprovalsCount = approvals.filter(a => a.status === "pending").length;
  
  // Active run state
  const activeRunStatus = activeRunDetails?.db_record?.status || "idle";
  const activeRunId = activeRunDetails?.db_record?.id;

  return (
    <div className="space-y-12 font-mono text-[11px] leading-relaxed text-muted-foreground fade-in-up">
      
      {/* Editorial Title Header */}
      <div className="pb-4 border-b border-border">
        <h2 className="text-lg font-bold text-foreground tracking-tight font-sans">workspace.config</h2>
        <p className="text-[10px] text-muted-foreground mt-1 uppercase font-semibold">Active Substrate Configuration Profile</p>
      </div>

      {/* Workspace Environment Parameters Ledger */}
      <div className="space-y-6">
        <h3 className="text-xs font-bold text-foreground font-sans uppercase tracking-wider">Workspace Environment</h3>
        
        <div className="space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:justify-between py-1.5 border-b border-border/40">
            <span className="font-sans text-muted-foreground">Subscription Scope</span>
            <span className="text-foreground font-semibold">/subscriptions/default-sub/resourceGroups/rg-prod</span>
          </div>

          <div className="flex justify-between py-1.5 border-b border-border/40">
            <span className="font-sans text-muted-foreground">Discovered Savings</span>
            <span className="text-foreground font-bold font-mono text-primary">${totalDiscovered.toFixed(2)}</span>
          </div>

          <div className="flex justify-between py-1.5 border-b border-border/40">
            <span className="font-sans text-muted-foreground">Realized Savings</span>
            <span className="text-foreground font-bold font-mono text-success">${totalRealized.toFixed(2)}</span>
          </div>

          <div className="flex justify-between py-1.5 border-b border-border/40">
            <span className="font-sans text-muted-foreground">Active Sweep Scenario</span>
            <span className="text-foreground font-semibold">remediation-cost-governance (Scheduled: 4h)</span>
          </div>

          <div className="flex justify-between py-1.5 border-b border-border/40">
            <span className="font-sans text-muted-foreground">Kernel Connection Status</span>
            <span className="text-success font-bold flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-status-pulse" />
              <span>HEALTHY</span>
            </span>
          </div>
        </div>
      </div>

      {/* Active compiler run state */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-foreground font-sans uppercase tracking-wider">Active Swarm Compilation</h3>
        
        <div className="p-4 rounded-lg bg-card border border-border space-y-3 shadow-elevation-1">
          <div className="flex justify-between">
            <span className="font-sans">Compiler Status</span>
            <span className={`font-semibold uppercase tracking-wider ${
              activeRunStatus === 'running' ? 'text-primary' : 
              activeRunStatus === 'blocked_on_approval' ? 'text-warning' : 
              activeRunStatus === 'completed' ? 'text-success' : 'text-muted-foreground'
            }`}>
              {activeRunStatus === 'running' ? 'Running' : 
               activeRunStatus === 'blocked_on_approval' ? 'Gated for Signature' : 
               activeRunStatus === 'completed' ? 'Completed' : 'Idle / Sleeping'}
            </span>
          </div>

          {activeRunId && (
            <div className="flex justify-between text-[10px]">
              <span className="font-sans">Active Run ID</span>
              <span className="text-foreground">{activeRunId}</span>
            </div>
          )}

          <div className="text-[10px] leading-relaxed">
            Swarm compiler is monitoring active event streams. Telemetry metrics ingest loops check CPU/RAM utilization boundaries on intervals. 
          </div>
        </div>
      </div>

      {/* Swarm Agent Cluster status check list */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-foreground font-sans uppercase tracking-wider">Swarm Agent Cluster</h3>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between py-1 border-b border-border/30">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-status-pulse" />
              <span className="text-foreground font-semibold">Executive Agent</span>
            </div>
            <span className="text-[10px] text-muted-foreground">Monitoring orchestrator state transitions.</span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-border/30">
            <div className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${activeRunStatus === 'blocked_on_approval' ? 'bg-warning animate-status-pulse' : 'bg-muted-foreground/45'}`} />
              <span className="text-foreground font-semibold">Decision Agent</span>
            </div>
            <span className="text-[10px] text-muted-foreground">Evaluating rules heuristic profiles.</span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-border/30">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/35" />
              <span className="text-foreground font-semibold">Telemetry Agent</span>
            </div>
            <span className="text-[10px] text-muted-foreground">Ingesting Azure Monitor timeseries telemetry.</span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-border/30">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/35" />
              <span className="text-foreground font-semibold">Audit Agent</span>
            </div>
            <span className="text-[10px] text-muted-foreground">Verifying compliance security claims.</span>
          </div>
        </div>
      </div>

      {/* Manual Trigger Command button */}
      <div className="pt-4 border-t border-border flex justify-end">
        <button 
          disabled
          className="px-4 py-2 border border-border rounded bg-card hover:bg-secondary/40 text-foreground font-semibold font-mono hover:text-primary transition-all text-xs opacity-50 cursor-not-allowed shadow-elevation-1"
        >
          [ RUN COMPILER MANUAL SWEEP ]
        </button>
      </div>

    </div>
  );
}
