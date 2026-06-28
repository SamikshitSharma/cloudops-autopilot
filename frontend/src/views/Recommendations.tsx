import React, { useState } from "react";
import type { RecommendationDTO } from "../api/client";

interface RecommendationsProps {
  recommendations: RecommendationDTO[];
}

export function Recommendations({ recommendations }: RecommendationsProps) {
  const [selectedReco, setSelectedReco] = useState<RecommendationDTO | null>(
    recommendations.length > 0 ? recommendations[0] : null
  );

  const getOriginalJSON = (reco: RecommendationDTO) => {
    return JSON.stringify({
      id: reco.id,
      resource_id: reco.resource_id,
      action: "active",
      cost_monthly: reco.saving_amount * 2.5,
      metrics: {
        avg_cpu_14d: reco.evidence ? 0.04 : 0.02,
        active_connections: 1,
        disk_state: "attached"
      }
    }, null, 2);
  };

  const getProposedJSON = (reco: RecommendationDTO) => {
    return JSON.stringify({
      id: reco.id,
      resource_id: reco.resource_id,
      action: reco.action_type,
      cost_monthly: (reco.saving_amount * 2.5) - reco.saving_amount,
      metrics: {
        avg_cpu_14d: reco.evidence ? 0.04 : 0.02,
        active_connections: 0,
        disk_state: reco.action_type === 'delete' ? "removed" : "attached"
      }
    }, null, 2);
  };

  return (
    <div className="space-y-6 font-mono text-[11px] leading-relaxed text-muted-foreground fade-in-up">
      
      {/* Header index */}
      <div className="pb-4 border-b border-border">
        <h2 className="text-lg font-bold text-foreground tracking-tight font-sans">optimizations.json</h2>
        <p className="text-[10px] text-muted-foreground mt-1 uppercase font-semibold">Active Cost Optimization Configuration Diffs</p>
      </div>

      {/* Split Pane Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Column: Active Recommendations file list */}
        <div className="space-y-2 border-r border-border/40 pr-0 lg:pr-6">
          <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest pb-1 border-b border-border">
            PENDING CONFIG ACTIONS
          </div>
          
          {recommendations.length > 0 ? (
            <div className="space-y-1 mt-3">
              {recommendations.map((reco) => {
                const isActive = selectedReco?.id === reco.id;
                return (
                  <button
                    key={reco.id}
                    onClick={() => setSelectedReco(reco)}
                    className={`w-full text-left p-2.5 rounded border transition-all ${
                      isActive 
                        ? "bg-secondary text-primary font-bold border-l-2 border-primary" 
                        : "bg-card/45 border-border hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="truncate text-foreground font-bold">{reco.id}</span>
                      <span className={`text-[9px] px-1 rounded uppercase font-semibold ${
                        reco.risk_level === 'low' ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'
                      }`}>
                        {reco.risk_level}
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] mt-1">
                      <span>{reco.resource_id.split('/').pop()}</span>
                      <span className="text-foreground font-semibold">-${reco.saving_amount.toFixed(2)}/mo</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-4 border border-border border-dashed rounded text-center text-muted-foreground mt-3">
              No pending cost optimizations. Configuration profile is aligned.
            </div>
          )}
        </div>

        {/* Right Columns: Git Diff Visualizer comparison */}
        <div className="lg:col-span-2 space-y-4">
          <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest pb-1 border-b border-border">
            FILE DIFF: {selectedReco ? `${selectedReco.id}-${selectedReco.resource_id.split('/').pop()}.json` : "no-file-selected"}
          </div>

          {selectedReco ? (
            <div className="space-y-4">
              
              {/* Git Side-by-Side Diff Viewport */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Original properties */}
                <div className="border border-border rounded bg-card/15 overflow-hidden shadow-elevation-1">
                  <div className="bg-card px-3 py-1.5 border-b border-border text-muted-foreground flex justify-between">
                    <span>ORIGINAL PROFILE</span>
                    <span className="text-destructive font-bold">- DELETIONS</span>
                  </div>
                  <pre className="p-3 text-[10px] leading-relaxed text-destructive/90 overflow-x-auto bg-destructive/5 select-text font-mono">
                    {getOriginalJSON(selectedReco)}
                  </pre>
                </div>

                {/* Proposed properties */}
                <div className="border border-border rounded bg-card/15 overflow-hidden shadow-elevation-1">
                  <div className="bg-card px-3 py-1.5 border-b border-border text-muted-foreground flex justify-between">
                    <span>PROPOSED PROFILE</span>
                    <span className="text-success font-bold">+ ADDITIONS</span>
                  </div>
                  <pre className="p-3 text-[10px] leading-relaxed text-success/90 overflow-x-auto bg-success/5 select-text font-mono">
                    {getProposedJSON(selectedReco)}
                  </pre>
                </div>

              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button 
                  disabled
                  className="px-4 py-2 border border-border rounded bg-card hover:bg-secondary/40 text-foreground font-semibold font-mono hover:text-destructive transition-colors text-xs opacity-50 cursor-not-allowed shadow-elevation-1"
                >
                  [ REJECT OPTIMIZATION ]
                </button>
                <button 
                  disabled
                  className="px-4 py-2 border border-border rounded bg-card hover:bg-secondary/40 text-foreground font-semibold font-mono hover:text-primary transition-colors text-xs opacity-50 cursor-not-allowed shadow-elevation-1"
                >
                  [ COMPILE & MERGE DIFF ]
                </button>
              </div>

            </div>
          ) : (
            <div className="p-8 border border-border border-dashed rounded text-center text-muted-foreground">
              Select an optimization target file from the list to view original vs proposed parameter diffs.
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
