import React, { useState } from "react";
import { 
  CheckSquare, 
  Check, 
  X, 
  AlertOctagon, 
  DollarSign, 
  ShieldAlert, 
  KeyRound, 
  Activity 
} from "lucide-react";
import type { RecommendationDTO, ApprovalDTO } from "../api/client";

interface RecommendationsProps {
  recommendations: RecommendationDTO[];
  approvals: ApprovalDTO[];
  approve: (approvalId: string) => Promise<any>;
}

export function Recommendations({ recommendations, approvals, approve }: RecommendationsProps) {
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
      setSuccessMsg(`Recommendation approved! Token generated and coordinator resumed.`);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingMap(prev => ({ ...prev, [approvalId]: false }));
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Human-in-the-Loop Gated Approvals Center */}
      <div className="p-6 bg-card border border-border rounded-xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-primary animate-pulse" />
            <h3 className="font-heading font-semibold text-base">Human-in-the-Loop Gated Approvals</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Operator Signature:</span>
            <input
              type="text"
              value={operatorId}
              onChange={(e) => setOperatorId(e.target.value)}
              className="bg-muted/30 border border-border rounded px-2 py-1 text-xs text-foreground font-mono font-bold w-40 focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>
        </div>

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-lg text-xs font-semibold flex items-center gap-2">
            <Check className="h-4 w-4" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {pendingApprovalsList.length === 0 ? (
            <div className="md:col-span-2 p-12 border border-dashed border-border rounded-xl text-center">
              <ShieldAlert className="h-8 w-8 text-muted mx-auto mb-2" />
              <p className="text-sm font-medium text-muted">No pending write approval requests detected.</p>
              <p className="text-xs text-muted/60 mt-1">Automatic guardrails are currently monitoring subscription activity.</p>
            </div>
          ) : (
            pendingApprovalsList.map(({ approval, recommendation }) => {
              if (!recommendation) return null;
              const isHighRisk = recommendation.risk_level === "high";
              const isLoading = loadingMap[approval.id] || false;

              return (
                <div key={approval.id} className={`p-6 border rounded-xl bg-card/60 flex flex-col justify-between space-y-4 transition-all hover:shadow-lg hover:shadow-primary/5 ${
                  isHighRisk ? "border-rose-500/20" : "border-border"
                }`}>
                  <div className="space-y-3">
                    {/* Header: Action type & Risk level */}
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                        recommendation.action_type === "stop"
                          ? "bg-rose-500/15 text-rose-500 border border-rose-500/25"
                          : recommendation.action_type === "resize"
                            ? "bg-amber-500/15 text-amber-500 border border-amber-500/25"
                            : "bg-cyan-500/15 text-cyan-500 border border-cyan-500/25"
                      }`}>
                        Action Required: {recommendation.action_type}
                      </span>
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                        isHighRisk ? "bg-rose-500/20 text-rose-400" : "bg-cyan-500/20 text-cyan-400"
                      }`}>
                        {recommendation.risk_level} Risk
                      </span>
                    </div>

                    {/* Target resource & savings */}
                    <div>
                      <h4 className="text-sm font-bold text-foreground font-mono">{recommendation.resource_id}</h4>
                      <p className="text-xs text-muted mt-1 leading-relaxed">{recommendation.rationale}</p>
                      {recommendation.evidence && (
                        <p className="text-[10px] text-muted-foreground/80 mt-1 italic">Evidence: {recommendation.evidence}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Savings display */}
                      <div className="flex items-center gap-1.5 text-emerald-500 font-semibold text-xs bg-emerald-500/10 px-2.5 py-1 rounded w-fit">
                        <DollarSign className="h-3.5 w-3.5" />
                        <span>Est. Savings: ${recommendation.saving_amount.toFixed(2)} / mo</span>
                      </div>

                      {/* Confidence display */}
                      {recommendation.confidence_score !== undefined && recommendation.confidence_score !== null && (
                        <div className="flex items-center gap-1 text-primary font-semibold text-xs bg-primary/10 px-2.5 py-1 rounded w-fit">
                          <span>Confidence: {(recommendation.confidence_score * 100).toFixed(0)}%</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="pt-4 border-t border-border flex items-center justify-between gap-4">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
                      <KeyRound className="h-3 w-3" />
                      <span>Signed JWT required</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApprove(approval.id)}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all disabled:opacity-50"
                      >
                        {isLoading ? (
                          <>
                            <Activity className="h-3.5 w-3.5 animate-pulse" />
                            <span>Signing...</span>
                          </>
                        ) : (
                          <>
                            <Check className="h-3.5 w-3.5" />
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

      {/* 2. Structured Cost Recommendations Registry */}
      <div className="p-6 bg-card border border-border rounded-xl">
        <div className="flex items-center gap-2 mb-4">
          <CheckSquare className="h-5 w-5 text-primary" />
          <h3 className="font-heading font-semibold text-base">Cost Optimization Proposals</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border text-muted uppercase font-bold text-[10px] tracking-wider">
                <th className="py-3 px-4">Resource ID</th>
                <th className="py-3 px-4">Remediation Action</th>
                <th className="py-3 px-4">Rationale</th>
                <th className="py-3 px-4">Risk Level</th>
                <th className="py-3 px-4">Confidence</th>
                <th className="py-3 px-4">Savings Amount</th>
                <th className="py-3 px-4">State Status</th>
              </tr>
            </thead>
            <tbody>
              {recommendations.map((reco) => (
                <tr key={reco.id} className="border-b border-border hover:bg-muted/10 transition-all">
                  <td className="py-3.5 px-4 font-mono font-bold text-foreground">{reco.resource_id}</td>
                  <td className="py-3.5 px-4">
                    <span className="font-semibold text-foreground capitalize">{reco.action_type}</span>
                  </td>
                  <td className="py-3.5 px-4 text-muted-foreground w-80">{reco.rationale}</td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold ${
                      reco.risk_level === "high" 
                        ? "bg-rose-500/10 text-rose-500" 
                        : "bg-cyan-500/10 text-cyan-500"
                    }`}>
                      {reco.risk_level}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-primary">
                    {reco.confidence_score !== undefined && reco.confidence_score !== null
                      ? `${(reco.confidence_score * 100).toFixed(0)}%`
                      : "100%"}
                  </td>
                  <td className="py-3.5 px-4 text-emerald-500 font-bold font-mono">${reco.saving_amount.toFixed(2)}</td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                      reco.status === "executed"
                        ? "bg-emerald-500/10 text-emerald-500"
                        : reco.status === "pending"
                          ? "bg-amber-500/10 text-amber-500 animate-pulse"
                          : reco.status === "approved"
                            ? "bg-indigo-500/10 text-indigo-500"
                            : "bg-rose-500/10 text-rose-500"
                    }`}>
                      {reco.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
