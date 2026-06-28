import React, { useState } from "react";
import type { RecommendationDTO, ApprovalDTO } from "../api/client";

interface ApprovalsProps {
  recommendations: RecommendationDTO[];
  approvals: ApprovalDTO[];
  approve: (approvalId: string) => Promise<any>;
}

export function Approvals({ recommendations, approvals, approve }: ApprovalsProps) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [sliderVal, setSliderVal] = useState<Record<string, number>>({});
  const [approvedState, setApprovedState] = useState<Record<string, "idle" | "success">>({});
  const [tokens, setTokens] = useState<Record<string, string>>({});

  const pendingApprovalsList = approvals
    .filter(a => a.status === "pending")
    .map(app => {
      const reco = recommendations.find(r => r.id === app.recommendation_id);
      return { approval: app, recommendation: reco };
    })
    .filter(item => item.recommendation !== undefined) as { approval: ApprovalDTO; recommendation: RecommendationDTO }[];

  const generateJWTClaims = (item: { approval: ApprovalDTO; recommendation: RecommendationDTO }) => {
    return JSON.stringify({
      sub: item.recommendation.resource_id.split('/').pop(),
      action: item.recommendation.action_type,
      workflow_id: item.approval.recommendation_id,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iss: "autopilot-compliance",
      gate_token_id: `app-${item.approval.id}`
    }, null, 2);
  };

  const handleSliderChange = async (approvalId: string, val: number, item: any) => {
    if (!checked[approvalId]) return;
    
    setSliderVal(prev => ({ ...prev, [approvalId]: val }));

    if (val === 100) {
      setApprovedState(prev => ({ ...prev, [approvalId]: "success" }));
      
      // Simulate compiling cryptographic token hash
      const randomToken = "ey" + Array.from({length: 45}, () => Math.random().toString(36)[2]).join("");
      setTokens(prev => ({ ...prev, [approvalId]: randomToken }));

      try {
        await approve(approvalId);
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="space-y-6 font-mono text-[11px] leading-relaxed text-muted-foreground fade-in-up">
      
      {/* Header index */}
      <div className="pb-4 border-b border-border">
        <h2 className="text-lg font-bold text-foreground tracking-tight font-sans">compliance.gate</h2>
        <p className="text-[10px] text-muted-foreground mt-1 uppercase font-semibold">Cryptographic Human-in-the-Loop Approval Sign-offs</p>
      </div>

      {/* Grid panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Column: Pending approvals list */}
        <div className="space-y-2 border-r border-border/40 pr-0 lg:pr-6">
          <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest pb-1 border-b border-border">
            AWAITING AUTHORIZATION
          </div>

          {pendingApprovalsList.length > 0 ? (
            <div className="space-y-1 mt-3">
              {pendingApprovalsList.map(({ approval, recommendation }) => {
                const isApproved = approvedState[approval.id] === 'success';
                return (
                  <div
                    key={approval.id}
                    className={`p-2.5 rounded border ${
                      isApproved ? 'bg-success/5 border-success/30' : 'bg-card/45 border-border'
                    }`}
                  >
                    <div className="flex justify-between items-center text-foreground font-bold">
                      <span>Gate: app-{approval.id}</span>
                      <span className={`text-[9px] px-1 rounded uppercase font-semibold ${
                        isApproved ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'
                      }`}>
                        {isApproved ? 'authorized' : 'gated'}
                      </span>
                    </div>
                    <div className="text-[10px] mt-1 space-y-0.5">
                      <div>Target: <span className="text-foreground">{recommendation.resource_id.split('/').pop()}</span></div>
                      <div>Action: <span className="text-primary uppercase font-bold">{recommendation.action_type}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 border border-border border-dashed rounded text-center text-muted-foreground mt-3">
              No pending approvals. Autopilot is fully authorized.
            </div>
          )}
        </div>

        {/* Right Columns: JWT verification and Slider swipe gate */}
        <div className="lg:col-span-2 space-y-4">
          <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest pb-1 border-b border-border">
            SIGNATURE CONSOLE
          </div>

          {pendingApprovalsList.length > 0 ? (
            <div className="space-y-5">
              {pendingApprovalsList.map((item) => {
                const approvalId = item.approval.id;
                const isApproved = approvedState[approvalId] === 'success';
                const currentVal = sliderVal[approvalId] || 0;
                
                return (
                  <div key={approvalId} className="space-y-4 pb-4 border-b border-border/40">
                    
                    {/* JWT Monospace Block */}
                    <div className="border border-border rounded bg-card/15 overflow-hidden shadow-elevation-1">
                      <div className="bg-card px-3 py-1.5 border-b border-border text-muted-foreground text-[10px] font-bold">
                        COMPLIANCE CLAIMS PAYLOAD (JSON)
                      </div>
                      <pre className="p-3 text-[10px] leading-relaxed text-foreground/80 overflow-x-auto select-text font-mono">
                        {generateJWTClaims(item)}
                      </pre>
                    </div>

                    {/* Token signature output upon success */}
                    {isApproved && tokens[approvalId] && (
                      <div className="p-2.5 border border-success/30 bg-success/5 rounded text-success text-[10px] break-all font-mono">
                        [TOKEN COMPILED & INJECTED]: {tokens[approvalId]}
                      </div>
                    )}

                    {/* Sign-off Slider gate */}
                    {!isApproved && (
                      <div className="space-y-3 p-4 border border-border rounded-lg bg-card/35 shadow-elevation-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`verify-${approvalId}`}
                            checked={checked[approvalId] || false}
                            onChange={(e) => setChecked(prev => ({ ...prev, [approvalId]: e.target.checked }))}
                            className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                          />
                          <label htmlFor={`verify-${approvalId}`} className="text-[10px] font-sans text-muted-foreground cursor-pointer">
                            I verify this optimization complies with FinOps guardrail metrics requirements.
                          </label>
                        </div>

                        <div className="space-y-1">
                          <div className="text-[9px] text-muted-foreground flex justify-between font-mono">
                            <span>Drag handle to compile and authorize token</span>
                            <span>{currentVal}%</span>
                          </div>
                          
                          <div className="relative flex items-center h-8 bg-background border border-border rounded-full overflow-hidden">
                            {/* Slide fill background */}
                            <div 
                              className="absolute left-0 top-0 bottom-0 bg-primary/10 transition-all duration-75"
                              style={{ width: `${currentVal}%` }}
                            />
                            
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={currentVal}
                              disabled={!checked[approvalId]}
                              onChange={(e) => handleSliderChange(approvalId, parseInt(e.target.value), item)}
                              className={`w-full h-full opacity-70 cursor-pointer accent-primary disabled:opacity-30 disabled:cursor-not-allowed`}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 border border-border border-dashed rounded text-center text-muted-foreground">
              All compliance checks resolved. No gates are currently blocking compiler state execution.
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
