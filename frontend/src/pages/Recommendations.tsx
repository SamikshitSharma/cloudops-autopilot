import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SeverityBadge } from "@/components/ui-ext/SeverityBadge";
import { Sparkles, TrendingUp, ShieldCheck, Zap, Cpu } from "lucide-react";
import { toast } from "sonner";
import { useRecommendations, useApproveRecommendation, useDismissRecommendation } from "@/hooks/useRecommendations";
import { useApprovals } from "@/hooks/useApprovals";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui-ext/StateViews";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import type { Severity, Recommendation } from "@/lib/types";

const catIcon = { cost: TrendingUp, security: ShieldCheck, reliability: Zap, performance: Cpu };
const catColor = {
  cost: "text-success",
  security: "text-destructive",
  reliability: "text-warning",
  performance: "text-primary",
} as const;

const mapCategory = (action: string) => {
  const a = action.toLowerCase();
  if (a === "stop" || a === "resize" || a === "delete") return "cost" as const;
  return "security" as const;
};

const mapSeverity = (risk: string): Severity => {
  const r = risk.toLowerCase();
  if (r === "high" || r === "critical") return "high";
  return "low";
};

export default function Recommendations() {
  const { data: dbRecommendations, isLoading, isError, error, refetch } = useRecommendations();
  const approveRecommendation = useApproveRecommendation();
  const dismissRecommendation = useDismissRecommendation();

  const [filter, setFilter] = useState<string>("all");
  const [previewReco, setPreviewReco] = useState<Recommendation | null>(null);

  const recommendations = useMemo(() => {
    if (!dbRecommendations) return [];
    return dbRecommendations.map((r): Recommendation => {
      let title = `${r.action_type.toUpperCase()} recommendation for ${r.resource_id}`;
      if (r.action_type === "stop") title = `Stop VM ${r.resource_id}`;
      else if (r.action_type === "resize") title = `Resize VM ${r.resource_id}`;
      else if (r.action_type === "delete") title = `Purge unattached resource ${r.resource_id}`;
      else if (r.action_type === "audit") title = `Audit configuration of ${r.resource_id}`;

      return {
        id: r.id,
        title,
        category: mapCategory(r.action_type),
        severity: mapSeverity(r.risk_level),
        savings: r.saving_amount > 0 ? `$${r.saving_amount}/mo` : undefined,
        impact: r.rationale,
        resource: r.resource_id,
        status: r.status,
        confidence: r.confidence_score !== null && r.confidence_score !== undefined ? r.confidence_score : 1.0,
        createdAt: "Active",
        evidence: r.evidence,
        reasoning_chain: r.reasoning_chain,
        run_id: r.run_id,
      };
    });
  }, [dbRecommendations]);

  const list = useMemo(() => {
    return recommendations.filter((r) => filter === "all" || r.category === filter);
  }, [recommendations, filter]);

  const handleApprove = (r: Recommendation) => {
    approveRecommendation.mutate(
      { recoId: r.id },
      {
        onSuccess: () => {
          toast.success("Recommendation successfully approved and execution triggered!");
        },
        onError: (err: any) => {
          toast.error(`Approval dispatch failed: ${err.message}`);
        },
      }
    );
  };

  const handlePreview = (r: Recommendation) => {
    setPreviewReco(r);
  };

  const handleDismiss = (r: Recommendation) => {
    dismissRecommendation.mutate(r.id, {
      onSuccess: () => {
        toast.success(`Recommendation dismissed successfully.`);
      },
      onError: (err: any) => {
        toast.error(`Dismissal failed: ${err.message}`);
      }
    });
  };

  if (isLoading) {
    return <LoadingState label="Loading optimization recommendations…" />;
  }

  if (isError) {
    return <ErrorState title="Recommendations Fetch Failed" description={error?.message} onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-6 animate-in-up">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold">Recommendations</h2>
          <p className="text-sm text-muted-foreground">AI-generated actions ranked by impact and confidence</p>
        </div>
        <div className="flex gap-1 rounded-md border border-border bg-muted/30 p-1">
          {["all", "cost", "reliability", "security", "performance"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded px-3 py-1 text-xs font-medium capitalize transition ${
                filter === f ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={Cpu}
          title="No recommendations match"
          description="Try clearing your filters or check back later after the next automated sweep."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {list.map((r) => {
            const Icon = catIcon[r.category];
            return (
              <Card key={r.id} className="glass group relative overflow-hidden p-5 transition-all hover:-translate-y-0.5 hover:shadow-elegant">
                <div className="flex items-start gap-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted ${catColor[r.category]}`}>
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] uppercase">{r.category}</Badge>
                      <SeverityBadge severity={r.severity} />
                      <span className="ml-auto text-[11px] text-muted-foreground">{r.createdAt}</span>
                    </div>
                    <h3 className="mt-2 font-display text-base font-semibold leading-snug">{r.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{r.impact}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <span className="font-mono text-xs text-muted-foreground">Target: {r.resource}</span>
                      {r.savings && <Badge className="bg-success/15 text-success hover:bg-success/20">{r.savings}</Badge>}
                      <span className="ml-auto inline-flex items-center gap-1 text-xs text-primary">
                        <Sparkles className="h-3 w-3" /> {Math.round(r.confidence * 100)}% confidence
                      </span>
                    </div>
                    {r.status === "pending" || r.status === "escalated" ? (
                      <div className="mt-4 flex gap-2">
                        <Button size="sm" className="bg-gradient-primary text-primary-foreground" onClick={() => handleApprove(r)}>Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => handlePreview(r)}>Preview plan</Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDismiss(r)}>Dismiss</Button>
                      </div>
                    ) : (
                      <div className="mt-4 flex gap-2">
                        <Badge variant="secondary" className="capitalize text-xs">{r.status.replace("_", " ")}</Badge>
                        <Button size="sm" variant="outline" onClick={() => handlePreview(r)}>View plan</Button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {previewReco && (
        <Dialog open={!!previewReco} onOpenChange={(open) => { if (!open) setPreviewReco(null); }}>
          <DialogContent className="glass max-w-xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                Remediation Plan Preview
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Consolidated telemetry indicators, risk profile, and multi-agent reasoning logs
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2 text-sm leading-relaxed max-h-[70vh] overflow-y-auto pr-1">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-0.5">Action Title</span>
                <p className="font-semibold text-foreground">{previewReco.title}</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-0.5">Target Resource</span>
                  <p className="font-mono text-xs text-foreground bg-muted/30 px-2 py-1 rounded border">{previewReco.resource}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-0.5">Category</span>
                  <Badge variant="outline" className="text-[10px] uppercase font-bold mt-0.5">{previewReco.category}</Badge>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-0.5">Workflow Run</span>
                  {previewReco.run_id ? (
                    <a href={`/workflows?id=wf-run-${previewReco.run_id}`} className="font-mono text-xs text-primary hover:underline bg-primary/10 px-2 py-1 rounded border border-primary/20 inline-block truncate max-w-full">
                      {previewReco.run_id.slice(0, 13)}...
                    </a>
                  ) : (
                    <span className="font-mono text-xs text-muted-foreground">Unknown</span>
                  )}
                </div>
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-0.5">Rationale & Impact</span>
                <p className="text-foreground text-xs bg-muted/20 p-2.5 rounded border leading-relaxed">{previewReco.impact}</p>
              </div>
              <div className="grid grid-cols-3 gap-4 border-y border-border/60 py-3">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-0.5">Estimated Savings</span>
                  <p className="text-success font-bold text-base">{previewReco.savings || "$0.00"}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-0.5">AI Confidence</span>
                  <p className="text-primary font-bold text-base">{Math.round(previewReco.confidence * 100)}%</p>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-0.5">Risk Level</span>
                  <div>
                    <Badge variant="outline" className={previewReco.severity === "high" ? "bg-destructive/10 text-destructive border-destructive/30 uppercase text-[10px]" : "bg-success/10 text-success border-success/30 uppercase text-[10px]"}>
                      {previewReco.severity} risk
                    </Badge>
                  </div>
                </div>
              </div>
              
              {/* Telemetry Evidence */}
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Telemetry Evidence</span>
                <div className="rounded-md border border-border bg-muted/40 p-3 text-xs space-y-2 leading-relaxed">
                  <div className="flex justify-between items-center border-b border-border/40 pb-1.5 font-mono">
                    <span className="text-muted-foreground">Source:</span>
                    <span className="text-foreground font-semibold">Azure Monitor / Advisor Logs</span>
                  </div>
                  <p className="font-mono text-[11px] text-foreground/90 whitespace-pre-line leading-relaxed">
                    {previewReco.evidence || "No evidence details available."}
                  </p>
                </div>
              </div>

              {/* CLI Command Preview */}
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">CLI Command Preview</span>
                <pre className="rounded-md border border-border bg-black/50 p-3 text-[11.5px] font-mono text-primary leading-relaxed whitespace-pre-wrap break-all leading-normal">
                  {(() => {
                    const name = previewReco.resource;
                    if (previewReco.title.toLowerCase().includes("stop")) {
                      return `# Azure CLI Action Dispatch script\naz vm stop \\\n  --name "${name}" \\\n  --resource-group "rg-autopilot" \\\n  --no-wait`;
                    }
                    if (previewReco.title.toLowerCase().includes("resize")) {
                      return `# Azure CLI Action Dispatch script\naz vm resize \\\n  --name "${name}" \\\n  --size "Standard_B2s" \\\n  --resource-group "rg-autopilot" \\\n  --no-wait`;
                    }
                    if (previewReco.title.toLowerCase().includes("purge") || previewReco.title.toLowerCase().includes("delete")) {
                      return `# Azure CLI Action Dispatch script\naz disk delete \\\n  --name "${name}" \\\n  --resource-group "rg-autopilot" \\\n  --yes --no-wait`;
                    }
                    if (previewReco.title.toLowerCase().includes("ssh") || previewReco.title.toLowerCase().includes("port 22")) {
                      return `# Azure CLI Action Dispatch script\naz network nsg rule update \\\n  --nsg-name "nsg-${name}" \\\n  --resource-group "rg-autopilot" \\\n  --name "AllowSSH" \\\n  --access "Deny" \\\n  --priority 100`;
                    }
                    if (previewReco.title.toLowerCase().includes("backup")) {
                      return `# Azure CLI Action Dispatch script\naz backup protection enable-for-vm \\\n  --resource-group "rg-autopilot" \\\n  --vault-name "backup-vault-eastus" \\\n  --vm "${name}" \\\n  --policy-name "DefaultPolicy"`;
                    }
                    if (previewReco.title.toLowerCase().includes("vault") || previewReco.title.toLowerCase().includes("public network")) {
                      return `# Azure CLI Action Dispatch script\naz keyvault update \\\n  --name "${name}" \\\n  --resource-group "rg-autopilot" \\\n  --default-action "Deny"`;
                    }
                    return `# General Action Dispatch script\naz resource update --ids "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-autopilot/providers/Microsoft.Compute/virtualMachines/${name}"`;
                  })()}
                </pre>
              </div>

              {/* Reasoning Chain */}
              {previewReco.reasoning_chain && (
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">Agent Reasoning Chain Trace</span>
                  <div className="rounded-md border border-border bg-black/40 p-3 text-xs space-y-2.5 font-mono leading-relaxed">
                    {Object.entries(previewReco.reasoning_chain).map(([agent, data]: [string, any]) => (
                      <div key={agent} className="border-l-2 border-primary/50 pl-2.5 py-0.5">
                        <div className="flex justify-between items-center text-[10px] uppercase font-bold text-primary/80 mb-0.5">
                          <span>{agent} Stage</span>
                          {data.confidence !== undefined && <span>{Math.round(data.confidence * 100)}% conf</span>}
                        </div>
                        {typeof data === "object" ? (
                          <div className="text-[11px] text-foreground/80 space-y-0.5">
                            {Object.entries(data).map(([k, v]) => (
                              <div key={k} className="flex justify-between">
                                <span className="text-muted-foreground">{k.replace(/_/g, " ")}:</span>
                                <span className="text-foreground font-medium text-right ml-2">{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-foreground/80">{String(data)}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" onClick={() => setPreviewReco(null)}>Close Preview</Button>
              <Button className="bg-gradient-primary text-primary-foreground" onClick={() => { handleApprove(previewReco); setPreviewReco(null); }}>Approve Plan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

