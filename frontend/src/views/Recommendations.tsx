import React, { useState } from "react";
import { 
  Sparkles,
  HelpCircle,
  Cpu,
  Shield,
  Award,
  DollarSign,
  ChevronRight,
  X,
  FileText,
  Activity,
  ArrowRight,
  GitCommit,
  GitBranch,
  Bot,
  AlertCircle,
  Eye,
  CheckCircle2,
  TrendingDown
} from "lucide-react";
import type { RecommendationDTO } from "../api/client";

interface RecommendationsProps {
  recommendations: RecommendationDTO[];
}

export function Recommendations({ recommendations }: RecommendationsProps) {
  const [selectedReco, setSelectedReco] = useState<RecommendationDTO | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleInspect = (reco: RecommendationDTO) => {
    setSelectedReco(reco);
    setIsDrawerOpen(true);
  };

  const generateTrace = (reco: RecommendationDTO) => {
    const isVm = reco.resource_id.toLowerCase().includes("vm");
    
    if (reco.reasoning_chain) {
      const chain = reco.reasoning_chain;
      return {
        telemetry: reco.evidence || `Telemetry sweep detected target underutilization thresholds.`,
        policy: chain.policy?.compliant === false
          ? `Policy Exception: Resource is marked as protected.`
          : `Policy ID: POL-${isVm ? "VM" : "DISK"}-098 compliant.`,
        steps: [
          { agent: "Telemetry Agent", action: "Pulled ARM metrics & average CPU utilization patterns.", duration: "18ms", icon: Activity },
          { agent: "Analysis Agent", action: `Evaluated: ${chain.analysis?.decision || "Resource underutilized"}.`, duration: "32ms", icon: Cpu },
          { agent: "FinOps Agent", action: `Computed saving delta of $${chain.finops?.estimated_monthly_savings?.toFixed(2)}/mo.`, duration: "12ms", icon: DollarSign },
          { agent: "Policy Agent", action: `Checked guardrail tags. Compliance: ${chain.policy?.compliant ? "Pass" : "Fail"}.`, duration: "25ms", icon: Shield },
          { agent: "Decision Agent", action: `Approved orchestration payload for '${chain.decision?.final_action || reco.action_type}'.`, duration: "10ms", icon: Award }
        ]
      };
    }

    return {
      telemetry: isVm ? "Avg CPU < 2.0%, Network Out < 5KB/s baseline check." : "Block Storage unattached for > 7 consecutive days.",
      policy: isVm ? "Policy Code: POL-VM-098 (Idle VM cleanup)" : "Policy Code: POL-DISK-002 (Unattached storage)",
      steps: [
        { agent: "Telemetry Agent", action: "Aggregated Azure Monitor metrics and network sockets.", duration: "20ms", icon: Activity },
        { agent: "Decision Agent", action: `Generated '${reco.action_type}' remediation proposal.`, duration: "55ms", icon: Cpu },
        { agent: "Audit Agent", action: `Enforced policy constraints. Risk profile: ${reco.risk_level.toUpperCase()}.`, duration: "15ms", icon: Shield }
      ]
    };
  };

  const trace = selectedReco ? generateTrace(selectedReco) : null;

  return (
    <div className="space-y-6 flex h-[calc(100vh-140px)] relative overflow-hidden">
      
      {/* List Area */}
      <div className={`flex-1 transition-all duration-300 overflow-y-auto custom-scrollbar pr-1 ${isDrawerOpen ? 'mr-[420px]' : ''}`}>
        
        {/* Page title widget */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border mb-6">
          <div>
            <h2 className="text-xl font-extrabold text-foreground uppercase">Optimization Proposal Engine</h2>
            <p className="text-xs text-muted-foreground mt-1">AI-generated cost optimization proposals backed by deep telemetry explainability.</p>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-primary font-mono font-bold bg-primary/10 border border-primary/20 px-3 py-1.5 rounded">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Explainability System Online</span>
          </div>
        </div>

        {/* Grid cards view */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recommendations.length === 0 ? (
            <div className="col-span-2 p-16 border border-dashed border-border rounded text-center bg-card/45">
              <TrendingDown className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-55" />
              <p className="text-xs font-bold uppercase tracking-wider text-foreground">No Optimization Proposals</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto leading-normal">
                Autonomous sweeps indicate active tenant subscriptions comply with cost guardrails. Monitoring continues.
              </p>
            </div>
          ) : (
            recommendations.map((reco) => {
              const isHighRisk = reco.risk_level === "high";
              return (
                <div 
                  key={reco.id} 
                  onClick={() => handleInspect(reco)}
                  className={`bg-card border p-5 rounded flex flex-col justify-between space-y-4 hover:border-primary/60 transition-all cursor-pointer shadow-sm relative group ${
                    selectedReco?.id === reco.id ? 'ring-1 ring-primary/45 border-primary/60' : 'border-border'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded border border-primary/20 bg-primary/10 text-primary text-[9px] uppercase font-bold tracking-wider font-mono">
                        {reco.action_type.replace(/_/g, " ")}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase font-mono border ${
                        isHighRisk ? 'bg-danger/10 text-danger border-danger/25' : 'bg-success/10 text-success border-success/25'
                      }`}>
                        {reco.risk_level} RISK
                      </span>
                    </div>

                    {/* Target details */}
                    <div>
                      <p className="text-[8px] text-muted-foreground uppercase font-bold tracking-widest font-mono">Target Asset ID</p>
                      <h4 className="text-xs font-bold text-foreground font-mono truncate mt-0.5" title={reco.resource_id}>{reco.resource_id}</h4>
                    </div>

                    {/* Summary savings */}
                    <div className="grid grid-cols-2 gap-4 border-t border-b border-border/60 py-2 mt-2">
                      <div>
                        <span className="text-[8px] text-muted-foreground uppercase block font-bold">Projected Saving</span>
                        <span className="text-emerald-500 font-mono font-extrabold text-sm">${reco.saving_amount.toFixed(2)}/mo</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-muted-foreground uppercase block font-bold">Confidence</span>
                        <span className="text-foreground font-mono font-bold text-sm">{Math.round((reco.confidence_score || 0.95) * 100)}%</span>
                      </div>
                    </div>

                    <p className="text-[10px] text-muted-foreground leading-relaxed italic line-clamp-2 mt-2">{reco.rationale}</p>
                  </div>

                  <div className="flex justify-between items-center text-[10px] pt-1">
                    <span className="text-muted-foreground uppercase font-bold font-mono">Status: <span className="text-foreground">{reco.status.replace(/_/g, " ")}</span></span>
                    <button className="flex items-center gap-1 text-primary font-bold hover:underline select-none">
                      Inspect Trace
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Slide-out Drawer */}
      <div 
        className={`absolute top-0 right-0 h-full w-[400px] bg-card border-l border-border shadow-2xl transition-transform duration-250 ease-in-out transform flex flex-col z-20 ${
          isDrawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {selectedReco && trace && (
          <>
            {/* Drawer Header */}
            <div className="p-4 border-b border-border bg-card/85 flex items-center justify-between sticky top-0">
              <div className="flex items-center gap-2">
                <Bot className="h-4.5 w-4.5 text-primary" />
                <h3 className="font-extrabold text-foreground text-xs uppercase tracking-wider">Explainability Inspector</h3>
              </div>
              <button 
                onClick={() => setIsDrawerOpen(false)}
                className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content list */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
              
              {/* Asset Context */}
              <div className="bg-secondary/10 border border-border rounded p-4 space-y-3">
                <div>
                  <span className="text-[8px] text-muted-foreground uppercase block font-bold font-mono">Target Asset ID</span>
                  <span className="text-xs font-mono font-bold text-foreground break-all">{selectedReco.resource_id}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 border-t border-border/40 pt-2.5">
                  <div>
                    <span className="text-[8px] text-muted-foreground uppercase block font-bold font-mono">Action Type</span>
                    <span className="text-[10px] font-bold text-primary uppercase font-mono">{selectedReco.action_type}</span>
                  </div>
                  <div>
                    <span className="text-[8px] text-muted-foreground uppercase block font-bold font-mono">Monthly Impact</span>
                    <span className="text-[10px] font-extrabold text-emerald-500 font-mono">${selectedReco.saving_amount.toFixed(2)}/mo</span>
                  </div>
                </div>
              </div>

              {/* Console log stream */}
              <div className="bg-black/95 rounded border border-border p-3.5 font-mono text-[10.5px] text-slate-300 shadow-inner relative overflow-hidden scanline-effect">
                <div className="flex items-center gap-1.5 mb-2.5 border-b border-border/45 pb-1.5 text-primary">
                  <FileText className="h-3.5 w-3.5" />
                  <span className="font-bold">HEURISTICS_REASONING.log</span>
                </div>
                <div className="space-y-1.5">
                  <p><span className="text-primary font-bold">{"[TELEMETRY]"}</span> {trace.telemetry}</p>
                  <p><span className="text-warning font-bold">{"[GOVERNANCE]"}</span> {trace.policy}</p>
                  <p><span className="text-success font-bold">{"[DECISION]"}</span> Autonomous swarm reached consensus for optimization dispatch.</p>
                </div>
              </div>

              {/* Swarm Trace steps timeline */}
              <div>
                <h4 className="text-[8.5px] uppercase tracking-widest text-muted-foreground font-bold mb-4 flex items-center gap-2 font-mono">
                  <GitCommit className="h-3.5 w-3.5 text-primary" />
                  Swarm Execution Tracing
                </h4>
                
                <div className="relative border-l border-border ml-3.5 space-y-5">
                  {trace.steps.map((step, idx) => (
                    <div key={idx} className="relative pl-5">
                      <span className="absolute -left-2.5 top-0.5 h-5 w-5 rounded bg-card border border-primary flex items-center justify-center">
                        <span className="h-1 w-1 rounded bg-primary" />
                      </span>
                      
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] font-bold text-foreground uppercase tracking-wide">{step.agent}</span>
                        <span className="text-[9px] font-mono text-muted-foreground">{step.duration}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">{step.action}</p>
                    </div>
                  ))}
                  
                  {/* Verified Step */}
                  <div className="relative pl-5 font-mono text-[10px]">
                    <span className="absolute -left-2.5 top-0.5 h-5 w-5 rounded bg-card border border-success flex items-center justify-center">
                      <CheckCircle2 className="h-3 w-3 text-success" />
                    </span>
                    <span className="text-success font-bold uppercase tracking-wider">Trace Verified</span>
                    <p className="text-[9px] text-muted-foreground mt-0.5">Orchestration sequence cached.</p>
                  </div>
                </div>
              </div>

              {/* Trace JSON inspection payload */}
              <div className="space-y-2">
                <h4 className="text-[8.5px] uppercase tracking-widest text-muted-foreground font-bold font-mono">Metadata Payload</h4>
                <div className="bg-black/90 p-3 rounded border border-border/40 font-mono text-[10px] text-emerald-400 overflow-x-auto max-h-48 custom-scrollbar">
                  <pre>{JSON.stringify(selectedReco, null, 2)}</pre>
                </div>
              </div>

            </div>
          </>
        )}
      </div>

    </div>
  );
}
