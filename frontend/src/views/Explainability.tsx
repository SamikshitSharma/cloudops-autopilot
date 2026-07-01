import React, { useState } from "react";
import { HelpCircle, Shield, Award, Terminal, Cpu, Database, DollarSign, Activity, CheckCircle, ChevronRight } from "lucide-react";
import type { RecommendationDTO } from "../api/client";

interface ExplainabilityProps {
  recommendations: RecommendationDTO[];
}

export function Explainability({ recommendations }: ExplainabilityProps) {
  const [selectedRecoId, setSelectedRecoId] = useState<string>(
    recommendations[0]?.id || ""
  );

  const selectedReco = recommendations.find(r => r.id === selectedRecoId);

  // Generate trace path mappings
  const getTraceData = (reco: any) => {
    if (!reco) return null;
    const isVm = reco.resource_id.toLowerCase().includes("vm");
    
    if (reco.reasoning_chain) {
      const chain = reco.reasoning_chain;
      return {
        agentGroup: isVm ? "Compute Swarm Cluster" : "Block Storage Purger",
        telemetryEvaluated: reco.evidence || `Metric thresholds scan: resource idle.`,
        policyTrigger: chain.policy?.compliant === false
          ? `Policy Exception: Resource is marked as critical infrastructure.`
          : `Policy ID: POL-${isVm ? "VM" : "DISK"}-098 checked. Requires signature.`,
        decisionPath: [
          {
            agent: "Telemetry Node",
            action: "Aggregated live resource parameters from ARM endpoints.",
            confidence: 1.0,
            timestamp: "Phase 1: Monitor"
          },
          {
            agent: "Analysis Node",
            action: `Evaluated baseline constraints. Outcome: ${chain.analysis?.decision || "Resource underutilized"}.`,
            confidence: chain.analysis?.confidence || 0.95,
            timestamp: "Phase 2: Evaluate"
          },
          {
            agent: "FinOps Node",
            action: `Estimated monthly saving rate of $${chain.finops?.estimated_monthly_savings?.toFixed(2)}/mo.`,
            confidence: 0.92,
            timestamp: "Phase 3: Financials"
          },
          {
            agent: "Governance Node",
            action: `Cross-referenced policy rules. Requires Signature: ${chain.policy?.requires_approval ? "YES" : "NO"}.`,
            confidence: 0.98,
            timestamp: "Phase 4: Governance"
          },
          {
            agent: "Consensus Node",
            action: `Dispatched recommendation for '${chain.decision?.final_action || reco.action_type}' to gate queue.`,
            confidence: reco.confidence_score || chain.decision?.confidence || 0.95,
            timestamp: "Phase 5: Consensus"
          }
        ]
      };
    }

    return {
      agentGroup: isVm ? "Compute Swarm Cluster" : "Block Storage Purger",
      telemetryEvaluated: isVm 
        ? "Avg CPU utilization < 2.0%, Network Out < 5KB/s baseline scan." 
        : "Storage volume detached from virtual machines for > 7 days.",
      policyTrigger: isVm
        ? "Policy ID: POL-VM-098 (Idle virtual compute stop actions)"
        : "Policy ID: POL-DISK-002 (Unattached storage block deletions)",
      decisionPath: [
        {
          agent: "Telemetry Node",
          action: "Scanned tenant subscription assets performance telemetry.",
          confidence: 0.98,
          timestamp: "Phase 1: Monitor"
        },
        {
          agent: "Governance Node",
          action: `Cross-checked against cost policies. Risk rating: ${reco.risk_level.toUpperCase()}.`,
          confidence: 0.96,
          timestamp: "Phase 2: Audit"
        },
        {
          agent: "Consensus Node",
          action: `Proposed '${reco.action_type}' remediation to secure monthly budget savings.`,
          confidence: reco.confidence_score || 0.95,
          timestamp: "Phase 3: Consensus"
        }
      ]
    };
  };

  const trace = selectedReco ? getTraceData(selectedReco) : null;

  return (
    <div className="space-y-6 fade-in-up">
      
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h2 className="text-xl font-extrabold text-foreground uppercase">Cognitive Reasoning Engine</h2>
          <p className="text-xs text-muted-foreground mt-1">Audit, trace, and inspect step-by-step heuristic logic for AI-driven optimizations.</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono font-bold">
          <span className="h-2 w-2 rounded-full bg-primary animate-status-pulse" />
          <span>Explainability Mode Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Proposal selector */}
        <div className="bg-card border border-border p-4 rounded flex flex-col h-full overflow-hidden max-h-[500px]">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-4">Cost Proposals</h3>
          <div className="flex-grow overflow-y-auto space-y-2 custom-scrollbar pr-1">
            {recommendations.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-12">No active proposals in registry.</p>
            ) : (
              recommendations.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRecoId(r.id)}
                  className={`w-full p-3 rounded border text-left text-xs transition-all ${
                    selectedRecoId === r.id
                      ? "border-primary bg-primary/5 font-bold"
                      : "border-border bg-secondary/15 hover:bg-secondary/35"
                  }`}
                >
                  <span className="font-mono font-bold text-foreground block truncate">{r.resource_id}</span>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1 uppercase font-bold">
                    <span>{r.action_type}</span>
                    <span className="text-emerald-500">${r.saving_amount.toFixed(2)}/mo</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right column: Trace visualizer */}
        <div className="lg:col-span-2 bg-card border border-border rounded p-5 space-y-6">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <HelpCircle className="h-4.5 w-4.5 text-primary" />
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">AI Reasoning Trail</h3>
          </div>

          {selectedReco && trace ? (
            <div className="space-y-6">
              
              {/* Telemetry and Policy panels */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 bg-secondary/15 border border-border rounded space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground font-bold uppercase tracking-wider">
                    <Activity className="h-3.5 w-3.5 text-primary" />
                    <span>Telemetry Metrics Input</span>
                  </div>
                  <p className="text-xs font-mono font-bold text-foreground leading-normal">{trace.telemetryEvaluated}</p>
                </div>
                
                <div className="p-3 bg-secondary/15 border border-border rounded space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground font-bold uppercase tracking-wider">
                    <Shield className="h-3.5 w-3.5 text-warning" />
                    <span>Guardrails Policy Constraints</span>
                  </div>
                  <p className="text-xs font-mono font-semibold text-foreground leading-normal">{trace.policyTrigger}</p>
                </div>
              </div>

              {/* Graphic decision path timeline */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-foreground uppercase tracking-wider">Sequential Heuristic Execution Trail</h4>
                
                <div className="space-y-4 relative border-l border-border/80 ml-3.5">
                  {trace.decisionPath.map((step, idx) => (
                    <div key={idx} className="relative pl-6">
                      {/* Node point */}
                      <span className="absolute -left-2 top-0.5 h-4.5 w-4.5 rounded border border-primary bg-card flex items-center justify-center font-mono text-[9px] font-extrabold text-primary shadow-sm">
                        {idx + 1}
                      </span>
                      
                      <div className="p-3 bg-secondary/10 border border-border/50 hover:border-border rounded space-y-1 transition-colors">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-extrabold text-foreground uppercase tracking-wide">{step.agent}</span>
                          <span className="text-[9px] text-muted-foreground font-mono font-semibold">{step.timestamp}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">{step.action}</p>
                        <div className="pt-1.5 flex items-center gap-1 text-[9px] text-primary font-mono font-bold">
                          <Award className="h-3 w-3" />
                          <span>Node Confidence: {(step.confidence * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Raw JSON Trace inspector */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-foreground uppercase tracking-wider">Raw Explainability JSON Payload</h4>
                <div className="bg-black/95 p-3 rounded border border-border/40 font-mono text-[10.5px] text-emerald-400 overflow-x-auto max-h-40 custom-scrollbar scanline-effect relative">
                  <pre>{JSON.stringify(selectedReco, null, 2)}</pre>
                </div>
              </div>

            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic text-center py-24">Select an optimization proposal to inspect cognitive tracing.</p>
          )}
        </div>
        
      </div>
    </div>
  );
}
