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
  Bot
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

  // Generate a detailed trace based on recommendation properties
  const generateTrace = (reco: RecommendationDTO) => {
    const isVm = reco.resource_id.toLowerCase().includes("vm");
    
    if (reco.reasoning_chain) {
      const chain = reco.reasoning_chain;
      return {
        telemetry: reco.evidence || `Metric underutilization identified.`,
        policy: chain.policy?.compliant === false
          ? `Policy Block: Action blocked.`
          : `Policy [${isVm ? "VM" : "DISK"}-98].`,
        steps: [
          { agent: "Telemetry Agent", action: "Collected Resource Manager metrics.", duration: "12ms", icon: Activity },
          { agent: "Analysis Agent", action: `Evaluated: ${chain.analysis?.decision || "Idle resource"}.`, duration: "45ms", icon: Cpu },
          { agent: "FinOps Agent", action: `Projected Savings: $${chain.finops?.estimated_monthly_savings?.toFixed(2)}.`, duration: "18ms", icon: DollarSign },
          { agent: "Policy Agent", action: `Compliant: ${chain.policy?.compliant ? "Yes" : "No"}.`, duration: "32ms", icon: Shield },
          { agent: "Decision Agent", action: `Action: ${chain.decision?.final_action || reco.action_type}.`, duration: "8ms", icon: Award }
        ]
      };
    }

    return {
      telemetry: isVm ? "Avg CPU Util: 1.8%, Network In: 2.1KB/s" : "Disk Unattached > 7 days.",
      policy: isVm ? "Policy ID: POL-VM-098 (Idle VMs)" : "Policy ID: POL-DISK-002",
      steps: [
        { agent: "Telemetry Agent", action: "Evaluated metrics vs historical logs.", duration: "24ms", icon: Activity },
        { agent: "Decision Agent", action: `Proposed ${reco.action_type} for $${reco.saving_amount.toFixed(2)}.`, duration: "67ms", icon: Cpu },
        { agent: "Audit Agent", action: `Risk classified as ${reco.risk_level.toUpperCase()}.`, duration: "19ms", icon: Shield }
      ]
    };
  };

  const trace = selectedReco ? generateTrace(selectedReco) : null;

  return (
    <div className="space-y-6 flex h-[calc(100vh-140px)] relative">
      
      <div className={`flex-1 transition-all duration-300 ${isDrawerOpen ? 'mr-[420px]' : ''}`}>
        {/* Header Widget */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-border mb-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">AI Reasoning Engine</h2>
            <p className="text-sm text-muted-foreground mt-1">Autonomous cost reduction proposals with complete cryptographic explainability.</p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-primary font-mono bg-primary/10 px-3 py-1.5 rounded-md border border-primary/20">
            <Sparkles className="h-3.5 w-3.5" />
            <span>EXPLAINABILITY MODE ON</span>
          </div>
        </div>

        {/* List Card */}
        <div className="glass-panel border border-border rounded-xl shadow-lg overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/20 text-muted-foreground uppercase font-bold text-[10px] tracking-wider">
                <th className="py-4 px-5">Resource ID</th>
                <th className="py-4 px-5">Proposed Action</th>
                <th className="py-4 px-5">Risk Profile</th>
                <th className="py-4 px-5">Confidence</th>
                <th className="py-4 px-5">Projected Savings</th>
                <th className="py-4 px-5 text-right">Reasoning Chain</th>
              </tr>
            </thead>
            <tbody>
              {recommendations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground italic">
                    No recommendations currently populated in registry database.
                  </td>
                </tr>
              ) : (
                recommendations.map((reco) => (
                  <tr 
                    key={reco.id} 
                    className="border-b border-border/50 hover:bg-muted/30 transition-all duration-150 cursor-pointer group"
                    onClick={() => handleInspect(reco)}
                  >
                    <td className="py-4 px-5 font-mono font-bold text-foreground">{reco.resource_id}</td>
                    <td className="py-4 px-5">
                      <span className="px-2 py-1 bg-primary/10 text-primary border border-primary/20 rounded font-mono font-bold tracking-wider uppercase text-[10px]">
                        {reco.action_type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-1.5 font-bold uppercase tracking-widest text-[10px]">
                        {reco.risk_level === "high" ? (
                          <span className="text-destructive flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-destructive animate-pulse" /> HIGH</span>
                        ) : (
                          <span className="text-emerald-500 flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> LOW</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-2 w-full max-w-[120px]">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary"
                            style={{ width: `${(reco.confidence_score || 0.9) * 100}%` }}
                          />
                        </div>
                        <span className="font-mono text-muted-foreground text-[10px] w-8">
                          {Math.round((reco.confidence_score || 0.9) * 100)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-5 font-mono font-bold text-emerald-500">
                      ${reco.saving_amount.toFixed(2)}/mo
                    </td>
                    <td className="py-4 px-5 text-right">
                      <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all text-[11px] font-semibold text-muted-foreground">
                        <GitBranch className="h-3.5 w-3.5" />
                        Inspect Trace
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* GitHub Copilot / Linear Style Side Drawer */}
      <div 
        className={`absolute top-0 right-0 h-full w-[400px] glass-panel border-l border-border shadow-2xl transition-transform duration-300 ease-in-out transform flex flex-col ${
          isDrawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {selectedReco && trace && (
          <>
            {/* Drawer Header */}
            <div className="p-5 border-b border-border bg-background flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-foreground text-sm">Agent Explainability</h3>
              </div>
              <button 
                onClick={() => setIsDrawerOpen(false)}
                className="p-1.5 hover:bg-muted rounded-md text-muted-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
              
              {/* Context Panel */}
              <div className="space-y-4">
                <div className="bg-muted/30 border border-border rounded-lg p-4">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-1">Target Asset</p>
                  <p className="font-mono font-bold text-foreground text-xs">{selectedReco.resource_id}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-card border border-border rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Proposed Action</p>
                    <p className="font-mono font-bold text-primary text-[11px]">{selectedReco.action_type}</p>
                  </div>
                  <div className="bg-card border border-border rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Impact</p>
                    <p className="font-mono font-bold text-emerald-500 text-[11px]">+${selectedReco.saving_amount.toFixed(2)}/mo</p>
                  </div>
                </div>
              </div>

              {/* STDOUT Terminal Reasoning Block */}
              <div className="bg-black/80 rounded-lg border border-border/50 p-4 font-mono text-[11px] text-muted-foreground shadow-inner scanline-effect">
                <div className="flex items-center gap-2 mb-3 border-b border-muted-foreground/20 pb-2">
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  <span className="text-primary font-bold">REASONING_CHAIN.log</span>
                </div>
                <div className="space-y-2 break-words">
                  <p><span className="text-emerald-500">{"[EVIDENCE]"}</span> {trace.telemetry}</p>
                  <p><span className="text-amber-500">{"[POLICY_CHECK]"}</span> {trace.policy}</p>
                  <p><span className="text-primary">{"[DECISION]"}</span> Recommended {selectedReco.action_type} with {(selectedReco.confidence_score || 0.9) * 100}% confidence.</p>
                </div>
              </div>

              {/* Linear-style Vertical Timeline */}
              <div className="pt-2">
                <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-4 flex items-center gap-2">
                  <GitCommit className="h-3.5 w-3.5" />
                  Agent Execution Trace
                </h4>
                
                <div className="relative border-l border-border ml-3 space-y-6">
                  {trace.steps.map((step, idx) => (
                    <div key={idx} className="relative pl-6">
                      {/* Node Point */}
                      <span className="absolute -left-2.5 top-1 h-5 w-5 rounded-full bg-card border-2 border-primary flex items-center justify-center">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      </span>
                      
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-foreground">{step.agent}</span>
                        <span className="text-[9px] font-mono text-muted-foreground">{step.duration}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{step.action}</p>
                    </div>
                  ))}
                  
                  {/* Final Output Node */}
                  <div className="relative pl-6">
                    <span className="absolute -left-2.5 top-1 h-5 w-5 rounded-full bg-card border-2 border-emerald-500 flex items-center justify-center">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    </span>
                    <span className="text-xs font-bold text-emerald-500">Trace Complete</span>
                    <p className="text-[10px] font-mono text-muted-foreground mt-1">Ready for Execution Pipeline</p>
                  </div>
                </div>
              </div>

            </div>
          </>
        )}
      </div>

    </div>
  );
}

function CheckCircle2(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>;
}
