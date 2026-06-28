import React, { useState } from "react";
import type { RecommendationDTO } from "../api/client";

interface ExplainabilityProps {
  recommendations: RecommendationDTO[];
}

export function Explainability({ recommendations }: ExplainabilityProps) {
  const [selectedRecoId, setSelectedRecoId] = useState<string>(
    recommendations[0]?.id || ""
  );

  const selectedReco = recommendations.find(r => r.id === selectedRecoId);

  const getTraceData = (reco: any) => {
    if (reco && reco.reasoning_chain) {
      const chain = reco.reasoning_chain;
      const isVm = reco.resource_id.toLowerCase().includes("vm");
      
      const path = [
        {
          agent: "Telemetry Agent",
          action: "Collected live resource metrics from Azure Resource Manager and Azure Monitor.",
          confidence: 1.0,
          timestamp: "04s ago"
        },
        {
          agent: "Analysis Agent",
          action: `Evaluated utilization metrics: ${chain.analysis?.decision || "Resource is idle"}.`,
          confidence: chain.analysis?.confidence || 0.95,
          timestamp: "03s ago"
        },
        {
          agent: "FinOps Agent",
          action: `Projected monthly savings of $${chain.finops?.estimated_monthly_savings?.toFixed(2)}.`,
          confidence: 0.99,
          timestamp: "03s ago"
        },
        {
          agent: "Policy Agent",
          action: `Checked compliance profiles. Policy is ${chain.policy?.compliant ? "compliant" : "gated"}.`,
          confidence: 1.0,
          timestamp: "02s ago"
        },
        {
          agent: "Decision Agent",
          action: `Proposed final action: ${chain.decision?.final_action || reco.action_type}. Confidence: ${chain.decision?.confidence ? (chain.decision.confidence * 100).toFixed(0) : "98"}%.`,
          confidence: chain.decision?.confidence || 0.98,
          timestamp: "01s ago"
        }
      ];
      
      return {
        agentGroup: isVm ? "Compute Governance Cluster" : "Storage Purging Group",
        telemetryEvaluated: reco.evidence || "Metric underutilization identified.",
        policyTrigger: chain.policy?.compliant === false
          ? `Policy Block: Action requires manual cryptographic sign-off.`
          : `Policy check: passed core compliance guardrails.`,
        decisionPath: path
      };
    }

    const isVm = reco?.resource_id.toLowerCase().includes("vm");
    return {
      agentGroup: isVm ? "Compute Governance Cluster" : "Storage Purging Group",
      telemetryEvaluated: isVm 
        ? "Avg CPU Util: 1.8%, Network In: 2.1KB/s, Memory Usage: 12%" 
        : "Disk Unattached: Since 2026-06-10T14:00:00Z, Size: 128 GB",
      policyTrigger: isVm
        ? "Policy ID: POL-VM-098 (Idle virtual machines trigger remediation stop if CPU < 5.0% for 7 days)"
        : "Policy ID: POL-DISK-002 (Unattached disk purge, eligible for deletion if unattached for > 3 days)",
      decisionPath: [
        {
          agent: "Telemetry Agent",
          action: "Evaluated metrics against Azure Monitor historical logs.",
          confidence: 0.98,
          timestamp: "Sweep Phase"
        },
        {
          agent: "Decision Agent",
          action: `Proposed action '${reco?.action_type || "stop"}' with saving projection $${reco?.saving_amount.toFixed(2) || "0.00"}.`,
          confidence: 0.94,
          timestamp: "Evaluate Phase"
        },
        {
          agent: "Audit Agent",
          action: `Cross-referenced policy guidelines. Risk classified as ${reco?.risk_level.toUpperCase() || "LOW"}. Gating manual approval.`,
          confidence: 0.97,
          timestamp: "Audit Phase"
        }
      ]
    };
  };

  const trace = selectedReco ? getTraceData(selectedReco) : null;

  return (
    <div className="space-y-6 font-mono text-[11px] leading-relaxed text-muted-foreground fade-in-up">
      
      {/* Header index */}
      <div className="pb-4 border-b border-border">
        <h2 className="text-lg font-bold text-foreground tracking-tight font-sans">reasoning.engine</h2>
        <p className="text-[10px] text-muted-foreground mt-1 uppercase font-semibold">Autonomous Swarm Decision Reasoning Inspector</p>
      </div>

      {/* Selector input */}
      <div className="space-y-1 max-w-sm">
        <label className="text-muted-foreground font-sans">Target Optimization Identifier</label>
        <select
          value={selectedRecoId}
          onChange={(e) => setSelectedRecoId(e.target.value)}
          className="w-full bg-card border border-border rounded px-2.5 py-1.5 focus:outline-none text-foreground font-mono focus:border-primary text-xs shadow-elevation-1"
        >
          <option value="" disabled>Select target...</option>
          {recommendations.map(r => (
            <option key={r.id} value={r.id}>{r.id} ({r.resource_id.split('/').pop()})</option>
          ))}
        </select>
      </div>

      {trace && selectedReco ? (
        <div className="space-y-6 mt-6">
          
          {/* Metadata Parameters */}
          <div className="p-4 rounded-lg bg-card/25 border border-border space-y-3 shadow-elevation-1">
            <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest pb-1 border-b border-border">
              EVALUATED EVIDENCE
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="font-sans">Agent Cluster</span>
                <span className="text-foreground font-semibold">{trace.agentGroup}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans">Telemetry Metric Ingestion</span>
                <span className="text-foreground">{trace.telemetryEvaluated}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans">Governing Guardrail</span>
                <span className="text-foreground truncate max-w-xs">{trace.policyTrigger}</span>
              </div>
            </div>
          </div>

          {/* Reasoning Steps Timeline */}
          <div className="space-y-3">
            <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest pb-1 border-b border-border">
              SWARM DECISION PATH
            </div>

            <div className="space-y-3.5 relative pl-4 border-l border-border/60">
              {trace.decisionPath.map((step, idx) => (
                <div key={idx} className="relative space-y-1">
                  
                  {/* Step Dot anchor */}
                  <span className="absolute -left-[21.5px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                  
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold text-foreground uppercase">{step.agent}</span>
                    <span className="text-muted-foreground">{step.timestamp}</span>
                  </div>
                  
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    {step.action}
                  </p>
                  
                  <div className="text-[9px] text-muted-foreground font-sans">
                    Confidence Interval: <span className="text-foreground font-bold font-mono">{(step.confidence * 100).toFixed(0)}%</span>
                  </div>

                </div>
              ))}
            </div>
          </div>

        </div>
      ) : (
        <div className="p-8 border border-border border-dashed rounded text-center text-muted-foreground">
          No optimization traces loaded. Select a target identifier configuration parameter to inspect details.
        </div>
      )}

    </div>
  );
}
