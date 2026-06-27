import React, { useState } from "react";
import { 
  ShieldCheck, 
  Check, 
  DollarSign, 
  ShieldAlert, 
  KeyRound, 
  Activity,
  User,
  ExternalLink
} from "lucide-react";
import type { RecommendationDTO, ApprovalDTO } from "../api/client";

interface ApprovalsProps {
  recommendations: RecommendationDTO[];
  approvals: ApprovalDTO[];
  approve: (approvalId: string) => Promise<any>;
}

export function Approvals({ recommendations, approvals, approve }: ApprovalsProps) {
  const [operatorId, setOperatorId] = useState("Dashboard-Operator");
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Link recommendations with their approvals
  const pendingApprovalsList = approvals
    .filter(a => a.status === "pending")
    .map(app => {
      const reco = recommendations.find(r => r.id === app.recommendation_id);
      return { approval: app, recommendation: reco };
    })
    .filter(item => item.recommendation !== undefined);

  const handleApprove = async (approvalId: string) => {
    setLoadingMap(prev => ({ ...prev, [approvalId]: true }));
    setSuccessMsg(null);
    try {
      await approve(approvalId);
      setSuccessMsg(`Manual signature authenticated successfully. Action token generated.`);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingMap(prev => ({ ...prev, [approvalId]: false }));
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Widget */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#22252d] pb-6">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-wide">HUMAN-IN-THE-LOOP APPROVAL CENTER</h2>
          <p className="text-xs text-slate-400 mt-1">Manual validation gates and cryptographic approval triggers for cost reduction sweeps.</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Active Operator:</span>
            <div className="relative">
              <User className="absolute left-2.5 top-1.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                value={operatorId}
                onChange={(e) => setOperatorId(e.target.value)}
                className="bg-[#090b0f] border border-[#22252d] rounded-lg pl-8 pr-3 py-1 text-xs text-indigo-400 font-mono font-bold w-44 focus:border-indigo-500/50 focus:outline-none focus:ring-0"
              />
            </div>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-semibold flex items-center gap-2.5 animate-fadeIn shadow-lg shadow-emerald-500/5">
          <Check className="h-4.5 w-4.5 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Approvals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {pendingApprovalsList.length === 0 ? (
          <div className="md:col-span-2 p-16 border border-dashed border-[#22252d] rounded-xl text-center bg-[#111318]/50 shadow-inner">
            <ShieldAlert className="h-10 w-10 text-slate-600 mx-auto mb-4" />
            <p className="text-sm font-extrabold text-slate-400 uppercase tracking-wider">No Pending Gated Approvals</p>
            <p className="text-xs text-slate-500 mt-1.5 max-w-sm mx-auto leading-relaxed">Autopilot policies are monitoring the subscription. Any write action triggers requiring validation will populate here.</p>
          </div>
        ) : (
          pendingApprovalsList.map(({ approval, recommendation }) => {
            if (!recommendation) return null;
            const isHighRisk = recommendation.risk_level === "high";
            const isLoading = loadingMap[approval.id] || false;

            return (
              <div key={approval.id} className={`p-6 border rounded-xl bg-[#111318] flex flex-col justify-between space-y-6 shadow-xl relative overflow-hidden transition-all duration-200 hover:border-indigo-500/30 ${
                isHighRisk ? "border-rose-500/20" : "border-[#22252d]"
              }`}>
                {isHighRisk && <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500" />}
                
                <div className="space-y-4">
                  {/* Header: Action type & Risk level */}
                  <div className="flex items-center justify-between">
                    <span className={`text-[9px] uppercase font-extrabold tracking-wider px-2.5 py-1 rounded-md border ${
                      recommendation.action_type === "stop"
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        : recommendation.action_type === "resize"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          : "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                    }`}>
                      ACTION: {recommendation.action_type}
                    </span>
                    <span className={`text-[9px] uppercase font-extrabold tracking-wider px-2.5 py-1 rounded-md border ${
                      isHighRisk ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                    }`}>
                      {recommendation.risk_level} RISK
                    </span>
                  </div>

                  {/* Target resource & savings */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-extrabold text-white font-mono">{recommendation.resource_id}</h4>
                    <p className="text-xs text-slate-400 leading-normal">{recommendation.rationale}</p>
                    {recommendation.evidence && (
                      <p className="text-[10px] text-slate-500 font-mono italic">Evidence: {recommendation.evidence}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    {/* Savings display */}
                    <div className="flex items-center gap-1.5 text-emerald-400 font-extrabold text-xs bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20 font-mono">
                      <DollarSign className="h-3.5 w-3.5" />
                      <span>Savings: ${recommendation.saving_amount.toFixed(2)} / mo</span>
                    </div>

                    {/* Confidence display */}
                    <div className="flex items-center gap-1 text-indigo-400 font-extrabold text-xs bg-indigo-500/10 px-2.5 py-1 rounded border border-indigo-500/20 font-mono">
                      <span>Confidence: {((recommendation.confidence_score || 0.95) * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </div>

                {/* Actions buttons */}
                <div className="pt-4 border-t border-[#22252d] flex items-center justify-between gap-4">
                  <div className="flex items-center gap-1.5 text-[9px] text-slate-500 font-mono uppercase tracking-wider">
                    <KeyRound className="h-3.5 w-3.5 text-indigo-400" />
                    <span>JWT Signature required</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleApprove(approval.id)}
                      disabled={isLoading}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase transition-all disabled:opacity-50 shadow-lg shadow-indigo-600/15"
                    >
                      {isLoading ? (
                        <>
                          <Activity className="h-3.5 w-3.5 animate-pulse" />
                          <span>Signing...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="h-3.5 w-3.5" />
                          <span>Sign & Approve</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
