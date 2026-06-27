import React, { useState } from "react";
import { HelpCircle, Shield, Award, Terminal, Cpu } from "lucide-react";
import type { RecommendationDTO } from "../api/client";

interface ExplainabilityProps {
  recommendations: RecommendationDTO[];
}

export function Explainability({ recommendations }: ExplainabilityProps) {
  const [selectedRecoId, setSelectedRecoId] = useState<string>(
    recommendations[0]?.id || ""
  );

  const selectedReco = recommendations.find(r => r.id === selectedRecoId);

  // Generate a mock detailed trace based on recommendation properties
  const generateMockTrace = (reco: RecommendationDTO) => {
    const isVm = reco.resource_id.includes("vm");
    
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
          agent: "telemetry_agent",
          action: "Evaluated metrics against Azure Monitor historical logs.",
          confidence: 0.98,
          timestamp: "Phase 1: Sweep"
        },
        {
          agent: "decision_agent",
          action: `Proposed action '${reco.action_type}' with saving projection $${reco.saving_amount.toFixed(2)}.`,
          confidence: 0.94,
          timestamp: "Phase 2: Evaluate"
        },
        {
          agent: "audit_agent",
          action: `Cross-referenced policy guidelines. Risk classified as ${reco.risk_level.toUpperCase()}. Gating manual approval.`,
          confidence: 0.97,
          timestamp: "Phase 3: Audit"
        }
      ]
    };
  };

  const getTraceData = (reco: any) => {
    if (reco && reco.reasoning_chain) {
      const chain = reco.reasoning_chain;
      const isVm = reco.resource_id.toLowerCase().includes("vm");
      
      const path = [
        {
          agent: "Telemetry Agent",
          action: "Collected live resource metrics from Azure Resource Manager and Azure Monitor.",
          confidence: 1.0,
          timestamp: "Phase 1: Telemetry"
        },
        {
          agent: "Analysis Agent",
          action: `Analyzed telemetry against thresholds. Finding: ${chain.analysis?.decision || "Idle resource identified"}.`,
          confidence: chain.analysis?.confidence || 0.95,
          timestamp: "Phase 2: Analysis"
        },
        {
          agent: "FinOps Agent",
          action: `Estimated cost impact. Monthly savings: $${chain.finops?.estimated_monthly_savings?.toFixed(2)} under action '${reco.action_type}'.`,
          confidence: 0.90,
          timestamp: "Phase 3: FinOps"
        },
        {
          agent: "Policy Agent",
          action: `Checked governance rules. Compliant: ${chain.policy?.compliant ? "YES" : "NO"}, Requires Approval: ${chain.policy?.requires_approval ? "YES" : "NO"}.`,
          confidence: 0.98,
          timestamp: "Phase 4: Policy"
        },
        {
          agent: "Decision Agent",
          action: `Finalized recommendation path. Action: ${chain.decision?.final_action || reco.action_type}, Approved: ${chain.decision?.approved ? "YES" : "NO (Awaiting Gate)"}.`,
          confidence: reco.confidence_score || chain.decision?.confidence || 0.95,
          timestamp: "Phase 5: Decision"
        }
      ];

      return {
        agentGroup: isVm ? "Compute Governance Cluster" : "Storage Purging Group",
        telemetryEvaluated: reco.evidence || `Metric underutilization identified.`,
        policyTrigger: chain.policy?.compliant === false
          ? `Policy Alert: Protected resource check failed. Action blocked.`
          : `Policy ID: POL-${isVm ? "VM" : "DISK"}-098 checked. ${chain.policy?.requires_approval ? "Requires manual approval signature." : "Eligible for auto-execution."}`,
        decisionPath: path
      };
    }
    
    return reco ? generateMockTrace(reco) : null;
  };

  const trace = selectedReco ? getTraceData(selectedReco) : null;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Sidebar Selector */}
        <div className="p-6 bg-card border border-border rounded-xl flex flex-col h-full overflow-hidden">
          <h3 className="font-heading font-semibold text-base mb-4">Optimization Proposals</h3>
          <div className="flex-1 overflow-y-auto space-y-2 max-h-96 pr-1">
            {recommendations.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedRecoId(r.id)}
                className={`w-full p-3 rounded-lg border text-left text-xs transition-all ${
                  selectedRecoId === r.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/20"
                }`}
              >
                <span className="font-mono font-bold text-foreground block truncate">{r.resource_id}</span>
                <span className="text-muted block mt-1 capitalize">
                  Action: {r.action_type} | Savings: ${r.saving_amount}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Explainability Traces Details */}
        <div className="lg:col-span-2 p-6 bg-card border border-border rounded-xl space-y-6">
          <div className="flex items-center gap-2 mb-2 border-b border-border pb-4">
            <HelpCircle className="h-5 w-5 text-primary" />
            <h3 className="font-heading font-semibold text-base">Autopilot Reasoning Explainability Trace</h3>
          </div>

          {selectedReco && trace ? (
            <div className="space-y-6">
              
              {/* Context Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-muted/20 border border-border rounded-lg">
                  <div className="flex items-center gap-2 text-xs text-muted mb-1 font-semibold uppercase">
                    <Cpu className="h-4 w-4 text-primary" />
                    <span>Agent Telemetry Input</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{trace.telemetryEvaluated}</p>
                </div>
                
                <div className="p-4 bg-muted/20 border border-border rounded-lg">
                  <div className="flex items-center gap-2 text-xs text-muted mb-1 font-semibold uppercase">
                    <Shield className="h-4 w-4 text-amber-500" />
                    <span>Guardrails Policy Code</span>
                  </div>
                  <p className="text-xs font-semibold text-foreground leading-relaxed font-mono">{trace.policyTrigger}</p>
                </div>
              </div>

              {/* Reasoning Node Trail */}
              <div className="space-y-4">
                <h4 className="font-heading font-semibold text-sm">Remediation Decision Path</h4>
                <div className="space-y-4 relative before:absolute before:left-6 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                  {trace.decisionPath.map((step, idx) => (
                    <div key={idx} className="flex gap-4 items-start relative pl-1">
                      <div className="h-10 w-10 rounded-full bg-card border-2 border-primary flex items-center justify-center font-bold text-xs text-primary shrink-0 z-10">
                        {idx + 1}
                      </div>
                      <div className="flex-1 bg-muted/10 p-4 border border-border/80 rounded-lg space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-foreground capitalize font-mono">
                            {step.agent}
                          </span>
                          <span className="text-[10px] text-muted uppercase font-mono">{step.timestamp}</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{step.action}</p>
                        <div className="pt-2 flex items-center gap-1.5 text-[10px] text-primary font-mono font-bold">
                          <Award className="h-3 w-3" />
                          <span>Decision Confidence Score: {(step.confidence * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Raw JSON Trace Inspector */}
              <div className="space-y-2">
                <h4 className="font-heading font-semibold text-sm">Raw Trace JSON Payload</h4>
                <div className="bg-black/90 p-4 rounded-lg font-mono text-xs text-emerald-400 border border-border/10">
                  <pre className="overflow-x-auto">{JSON.stringify(selectedReco, null, 2)}</pre>
                </div>
              </div>

            </div>
          ) : (
            <p className="text-sm text-muted italic text-center py-20">Select a proposal from the left sidebar to view the explainability path.</p>
          )}
        </div>
        
      </div>
    </div>
  );
}
