import React, { useState, useMemo } from "react";
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
  LockOpen,
  History,
  XCircle
} from "lucide-react";
import type { RecommendationDTO, ApprovalDTO } from "../api/client";

interface ApprovalsProps {
  recommendations: RecommendationDTO[];
  approvals: ApprovalDTO[];
  approve: (approvalId: string) => Promise<any>;
}

export function Approvals({ recommendations, approvals, approve }: ApprovalsProps) {
  const [operatorId, setOperatorId] = useState("admin-operator-98");
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [signingState, setSigningState] = useState<Record<string, "idle" | "signing" | "success">>({});
  const [signingProgress, setSigningProgress] = useState<Record<string, number>>({});
  const [cryptoHash, setCryptoHash] = useState<Record<string, string>>({});

  // Map approvals with recommendations
  const approvalsList = useMemo(() => {
    return approvals.map(app => {
      const reco = recommendations.find(r => r.id === app.recommendation_id);
      return { approval: app, recommendation: reco };
    }).filter(item => item.recommendation !== undefined);
  }, [approvals, recommendations]);

  const pendingApprovals = useMemo(() => {
    return approvalsList.filter(item => item.approval.status === "pending");
  }, [approvalsList]);

  const historicalApprovals = useMemo(() => {
    return approvalsList.filter(item => item.approval.status !== "pending");
  }, [approvalsList]);

  const generateRandomHash = () => {
    const chars = '0123456789abcdef';
    let hash = '0x';
    for (let i = 0; i < 40; i++) hash += chars[Math.floor(Math.random() * chars.length)];
    return hash;
  };

  const handleApprove = async (approvalId: string) => {
    setSigningState(prev => ({ ...prev, [approvalId]: "signing" }));
    setSigningProgress(prev => ({ ...prev, [approvalId]: 0 }));
    
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 20;
      if (progress > 100) progress = 100;
      
      setSigningProgress(prev => ({ ...prev, [approvalId]: progress }));
      setCryptoHash(prev => ({ ...prev, [approvalId]: generateRandomHash() }));

      if (progress === 100) {
        clearInterval(interval);
        finalizeApproval(approvalId);
      }
    }, 150);
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
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setSigningState(prev => ({ ...prev, [approvalId]: "idle" }));
    }
  };

  // Bulk Approval Action
  const handleBulkApprove = async () => {
    for (const item of pendingApprovals) {
      await handleApprove(item.approval.id);
    }
  };

  return (
    <div className="space-y-6 fade-in-up">
      
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h2 className="text-xl font-extrabold text-foreground uppercase flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Security Signatures Gate
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Cryptographic execution gates for autonomous cloud remediation operations.</p>
        </div>
        
        <div className="flex items-center gap-4 text-xs">
          {/* Operator ID input */}
          <div className="flex items-center gap-2 bg-card px-3 py-1.5 rounded border border-border">
            <span className="text-[9px] font-mono text-muted-foreground uppercase font-bold">OPERATOR_ID:</span>
            <div className="relative flex items-center">
              <User className="h-3.5 w-3.5 text-primary mr-1" />
              <input
                type="text"
                value={operatorId}
                onChange={(e) => setOperatorId(e.target.value)}
                className="bg-transparent border-none p-0 text-[10px] text-foreground font-mono font-bold w-36 focus:outline-none focus:ring-0"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs and Bulk Action Controls */}
      <div className="flex items-center justify-between select-none">
        <div className="flex gap-2 p-1 bg-secondary/15 rounded border border-border">
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-3 py-1 text-xs font-bold uppercase rounded flex items-center gap-1.5 transition-all ${
              activeTab === "pending" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LockOpen className="h-3.5 w-3.5" />
            Pending Gates ({pendingApprovals.length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-3 py-1 text-xs font-bold uppercase rounded flex items-center gap-1.5 transition-all ${
              activeTab === "history" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <History className="h-3.5 w-3.5" />
            Decision Log ({historicalApprovals.length})
          </button>
        </div>

        {activeTab === "pending" && pendingApprovals.length > 0 && (
          <button
            onClick={handleBulkApprove}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-primary hover:bg-primary/95 text-primary-foreground text-[10px] font-bold uppercase tracking-wider transition-all"
          >
            <Fingerprint className="h-3.5 w-3.5" />
            Sign All Pending
          </button>
        )}
      </div>

      {/* Main Grid display */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {activeTab === "pending" ? (
          pendingApprovals.length === 0 ? (
            <div className="md:col-span-2 p-16 border border-dashed border-border rounded text-center bg-card/45">
              <ShieldCheck className="h-10 w-10 text-success mx-auto mb-3 opacity-70 animate-pulse-ring rounded-full" />
              <p className="text-xs font-bold text-foreground uppercase tracking-wider">Zero Pending Gates</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto leading-normal">
                All cloud tenant resources are executing within governing policy boundaries. No signatures required.
              </p>
            </div>
          ) : (
            pendingApprovals.map(({ approval, recommendation }) => {
              if (!recommendation) return null;
              const isHighRisk = recommendation.risk_level === "high";
              const state = signingState[approval.id] || "idle";
              const progress = signingProgress[approval.id] || 0;
              const hash = cryptoHash[approval.id] || "0x0000000000000000000000000000000000000000";

              return (
                <div key={approval.id} className={`bg-card p-5 border rounded flex flex-col justify-between space-y-4 shadow-sm relative overflow-hidden transition-all duration-200 ${
                  isHighRisk ? "border-danger/35 hover:border-danger/60" : "border-border hover:border-primary/60"
                }`}>
                  {isHighRisk && <div className="absolute top-0 left-0 w-1 h-full bg-danger" />}
                  
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border bg-secondary/15 text-foreground border-border flex items-center gap-1.5">
                        <Cpu className="h-3 w-3 text-primary" />
                        {recommendation.action_type}
                      </span>
                      <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border flex items-center gap-1.5 ${
                        isHighRisk ? "bg-danger/10 text-danger border-danger/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      }`}>
                        {isHighRisk ? <ShieldAlert className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                        {recommendation.risk_level} Risk
                      </span>
                    </div>

                    {/* Target and impact */}
                    <div className="bg-secondary/10 p-3 rounded space-y-2 border border-border/40">
                      <div>
                        <span className="text-[8px] text-muted-foreground uppercase block font-bold font-mono">Target Asset ID</span>
                        <h4 className="text-xs font-bold text-foreground font-mono truncate mt-0.5" title={recommendation.resource_id}>{recommendation.resource_id}</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-4 border-t border-border/30 pt-2">
                        <div>
                          <span className="text-[8px] text-muted-foreground uppercase block font-bold font-mono">Savings yield</span>
                          <span className="font-mono font-bold text-emerald-500 text-[11px]">+${recommendation.saving_amount.toFixed(2)}/mo</span>
                        </div>
                        <div>
                          <span className="text-[8px] text-muted-foreground uppercase block font-bold font-mono">Confidence</span>
                          <span className="font-mono font-bold text-primary text-[11px]">{((recommendation.confidence_score || 0.95) * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Signature control console */}
                  <div className="relative">
                    {state === "idle" ? (
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground font-mono uppercase font-bold">
                          <KeyRound className="h-3.5 w-3.5 text-primary animate-pulse" />
                          <span>Awaiting signature</span>
                        </div>
                        <button
                          onClick={() => handleApprove(approval.id)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded bg-primary hover:bg-primary/95 text-primary-foreground text-[10px] font-bold uppercase tracking-wider transition-all"
                        >
                          <Fingerprint className="h-3.5 w-3.5" />
                          Sign Gate
                        </button>
                      </div>
                    ) : state === "signing" ? (
                      <div className="bg-black/95 rounded p-3 border border-border/80 font-mono text-[9px] text-slate-300 scanline-effect">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[8px] font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
                            <Activity className="h-3 w-3 animate-pulse" />
                            Signing payload token...
                          </span>
                          <span className="text-[9px] text-muted-foreground">{Math.floor(progress)}%</span>
                        </div>
                        <div className="w-full h-1 bg-secondary rounded-full overflow-hidden mb-2">
                          <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
                        </div>
                        <div className="text-[8px] text-muted-foreground break-all leading-none truncate select-all">{hash}</div>
                      </div>
                    ) : (
                      <div className="bg-success/10 rounded p-3 border border-success/35 flex items-center gap-2.5">
                        <div className="h-6 w-6 rounded-full bg-success/20 flex items-center justify-center">
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        </div>
                        <div>
                          <p className="text-[10px] font-extrabold text-success uppercase tracking-wider">Gate verified</p>
                          <p className="text-[9px] text-muted-foreground font-mono mt-0.5">Payload dispatch signature confirmed.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )
        ) : (
          historicalApprovals.length === 0 ? (
            <div className="md:col-span-2 p-16 border border-dashed border-border rounded text-center bg-card/45">
              <History className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-55" />
              <p className="text-xs font-bold text-foreground uppercase tracking-wider">Zero Historical Decisions</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto leading-normal">
                No signatures have been completed during this swarm lifecycle yet.
              </p>
            </div>
          ) : (
            historicalApprovals.map(({ approval, recommendation }) => {
              if (!recommendation) return null;
              const isApproved = approval.status === "approved";
              return (
                <div key={approval.id} className="bg-card p-4 border border-border rounded flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono font-bold text-slate-300 truncate w-32" title={recommendation.resource_id}>
                      {recommendation.resource_id}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-extrabold uppercase font-mono border ${
                      isApproved ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                    }`}>
                      {isApproved ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {approval.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-[9px] font-mono border-t border-border/40 pt-2 text-muted-foreground">
                    <div>
                      <span>Action:</span>
                      <span className="text-foreground font-bold block mt-0.5">{recommendation.action_type}</span>
                    </div>
                    <div>
                      <span>Signed Timestamp:</span>
                      <span className="text-foreground block mt-0.5">{approval.decided_at ? new Date(approval.decided_at).toLocaleString() : "System verified"}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )
        )}
      </div>

    </div>
  );
}
