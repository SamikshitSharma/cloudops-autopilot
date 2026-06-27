import React, { useState } from "react";
import { 
  ShieldCheck, 
  Check, 
  DollarSign, 
  ShieldAlert, 
  KeyRound, 
  Activity,
  User,
  ExternalLink,
  Fingerprint,
  Cpu,
  CheckCircle2,
  Lock,
  LockOpen
} from "lucide-react";
import type { RecommendationDTO, ApprovalDTO } from "../api/client";

interface ApprovalsProps {
  recommendations: RecommendationDTO[];
  approvals: ApprovalDTO[];
  approve: (approvalId: string) => Promise<any>;
}

export function Approvals({ recommendations, approvals, approve }: ApprovalsProps) {
  const [operatorId, setOperatorId] = useState("Dashboard-Operator");
  const [signingState, setSigningState] = useState<Record<string, "idle" | "signing" | "success">>({});
  const [signingProgress, setSigningProgress] = useState<Record<string, number>>({});
  const [cryptoHash, setCryptoHash] = useState<Record<string, string>>({});

  // Link recommendations with their approvals
  const pendingApprovalsList = approvals
    .filter(a => a.status === "pending")
    .map(app => {
      const reco = recommendations.find(r => r.id === app.recommendation_id);
      return { approval: app, recommendation: reco };
    })
    .filter(item => item.recommendation !== undefined);

  const generateRandomHash = () => {
    const chars = '0123456789abcdef';
    let hash = '0x';
    for (let i = 0; i < 40; i++) hash += chars[Math.floor(Math.random() * chars.length)];
    return hash;
  };

  const handleApprove = async (approvalId: string) => {
    setSigningState(prev => ({ ...prev, [approvalId]: "signing" }));
    setSigningProgress(prev => ({ ...prev, [approvalId]: 0 }));
    
    // Animate the cryptographic signing
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress > 100) progress = 100;
      
      setSigningProgress(prev => ({ ...prev, [approvalId]: progress }));
      setCryptoHash(prev => ({ ...prev, [approvalId]: generateRandomHash() }));

      if (progress === 100) {
        clearInterval(interval);
        finalizeApproval(approvalId);
      }
    }, 200);
  };

  const finalizeApproval = async (approvalId: string) => {
    try {
      await approve(approvalId);
      setSigningState(prev => ({ ...prev, [approvalId]: "success" }));
      setTimeout(() => {
        setSigningState(prev => {
          const newState = { ...prev };
          delete newState[approvalId];
          return newState;
        });
      }, 3000);
    } catch (err: any) {
      console.error(err);
      setSigningState(prev => ({ ...prev, [approvalId]: "idle" }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Widget */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-border mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Lock className="h-6 w-6 text-primary" />
            Approval Center
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Cryptographic execution gates for autonomous cloud remediation operations.</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-md border border-border">
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider font-bold">Operator ID:</span>
            <div className="relative">
              <User className="absolute left-1.5 top-1 h-3.5 w-3.5 text-primary" />
              <input
                type="text"
                value={operatorId}
                onChange={(e) => setOperatorId(e.target.value)}
                className="bg-transparent border-none pl-6 pr-2 py-0.5 text-[11px] text-foreground font-mono font-bold w-40 focus:outline-none focus:ring-0"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Approvals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {pendingApprovalsList.length === 0 ? (
          <div className="md:col-span-2 p-16 border-2 border-dashed border-border rounded-xl text-center bg-muted/10">
            <ShieldCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-sm font-bold text-foreground uppercase tracking-wider">Zero Pending Gates</p>
            <p className="text-xs text-muted-foreground mt-2 max-w-sm mx-auto leading-relaxed">
              All active agent sweeps have completed or are operating within permitted guardrail boundaries. No manual intervention required.
            </p>
          </div>
        ) : (
          pendingApprovalsList.map(({ approval, recommendation }) => {
            if (!recommendation) return null;
            const isHighRisk = recommendation.risk_level === "high";
            const state = signingState[approval.id] || "idle";
            const progress = signingProgress[approval.id] || 0;
            const hash = cryptoHash[approval.id] || "0x0000000000000000000000000000000000000000";

            return (
              <div key={approval.id} className={`glass-panel p-6 border rounded-xl flex flex-col justify-between space-y-6 shadow-xl relative overflow-hidden transition-all duration-300 ${
                isHighRisk ? "border-rose-500/50 shadow-rose-500/10" : "border-border hover:border-primary/50"
              }`}>
                {isHighRisk && <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500" />}
                
                <div className="space-y-4 relative z-10">
                  {/* Header: Action type & Risk level */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-md border bg-card text-foreground border-border flex items-center gap-1.5">
                      <Cpu className="h-3 w-3 text-primary" />
                      {recommendation.action_type.replace(/_/g, " ")}
                    </span>
                    <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-md border flex items-center gap-1.5 ${
                      isHighRisk ? "bg-rose-500/10 text-rose-500 border-rose-500/20" : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    }`}>
                      {isHighRisk ? <ShieldAlert className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                      {recommendation.risk_level} RISK
                    </span>
                  </div>

                  {/* Target resource & savings */}
                  <div className="space-y-2 bg-muted/20 p-4 rounded-lg border border-border/50">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-1">Target Asset ID</p>
                    <h4 className="text-sm font-bold text-foreground font-mono truncate">{recommendation.resource_id}</h4>
                    
                    <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-1">MRR Impact</p>
                        <p className="font-mono font-bold text-emerald-500 text-xs">+${recommendation.saving_amount.toFixed(2)}/mo</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-1">Agent Confidence</p>
                        <p className="font-mono font-bold text-primary text-xs">{((recommendation.confidence_score || 0.95) * 100).toFixed(0)}%</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cryptographic Signing Overlay or Button */}
                <div className="relative z-10">
                  {state === "idle" ? (
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                        <KeyRound className="h-3.5 w-3.5 text-primary" />
                        <span>Requires signature</span>
                      </div>
                      <button
                        onClick={() => handleApprove(approval.id)}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold uppercase tracking-wider transition-all"
                      >
                        <Fingerprint className="h-4 w-4" />
                        Sign & Execute
                      </button>
                    </div>
                  ) : state === "signing" ? (
                    <div className="bg-black/80 rounded-lg p-4 border border-border scanline-effect">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                          <Activity className="h-3.5 w-3.5 animate-pulse" />
                          Generating Cryptographic Token...
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground">{Math.floor(progress)}%</span>
                      </div>
                      
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mb-3">
                        <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
                      </div>
                      
                      <div className="text-[9px] font-mono text-muted-foreground break-all leading-tight opacity-70">
                        {hash}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-emerald-500/10 rounded-lg p-4 border border-emerald-500/30 flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Signature Verified</p>
                        <p className="text-[10px] font-mono text-muted-foreground mt-0.5">Execution payload dispatched to orchestrator.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
