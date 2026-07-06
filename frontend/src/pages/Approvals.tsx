import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SeverityBadge } from "@/components/ui-ext/SeverityBadge";
import { Check, X, ShieldCheck, Inbox } from "lucide-react";
import { toast } from "sonner";
import { useApprovals, useApproveRequest, useRejectRequest } from "@/hooks/useApprovals";
import { useRecommendations } from "@/hooks/useRecommendations";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui-ext/StateViews";
import type { Severity, Approval } from "@/lib/types";

export default function Approvals() {
  const { data: dbApprovals, isLoading: isAppLoading, isError: isAppError, error: appError, refetch: refetchApps } = useApprovals();
  const { data: dbRecommendations } = useRecommendations();
  const approveRequest = useApproveRequest();
  const rejectRequest = useRejectRequest();

  const mappedApprovals = useMemo(() => {
    if (!dbApprovals) return [];
    return dbApprovals
      .filter((a) => a.status === "pending")
      .map((a): Approval => {
        const reco = dbRecommendations?.find((r) => r.id === a.recommendation_id);

        let title = reco
          ? `${reco.action_type.toUpperCase()} recommendation for ${reco.resource_id}`
          : "Resource Optimization Approval";
        if (reco) {
          if (reco.action_type === "stop") title = `Stop VM ${reco.resource_id}`;
          else if (reco.action_type === "resize") title = `Resize VM ${reco.resource_id}`;
          else if (reco.action_type === "delete") title = `Delete unattached disk ${reco.resource_id}`;
          else if (reco.action_type === "audit") title = `Audit configuration of ${reco.resource_id}`;
        }

        const blastRadius = reco && reco.risk_level === "high" 
          ? "High impact: requires manual confirmation." 
          : "Low impact: safe remediation action.";
          
        const plan = reco
          ? [
              reco.rationale,
              reco.evidence || "Assess resource telemetry metrics",
              `Dispatch and apply action: ${reco.action_type}`,
              "Verify system health nominal status",
            ]
          : ["Assess resource configuration", "Execute state change action", "Verify systems nominal"];

        return {
          id: a.id,
          title,
          requestedBy: "Planner Agent",
          risk: reco ? (reco.risk_level === "high" ? "high" : "low") : "medium",
          blastRadius,
          createdAt: new Date(a.created_at).toLocaleString(),
          plan,
        };
      });
  }, [dbApprovals, dbRecommendations]);

  const handleApprove = (a: Approval) => {
    approveRequest.mutate(
      { approvalId: a.id },
      {
        onSuccess: () => {
          toast.success("Action approved successfully! Cloud state change dispatched.", {
            description: a.title,
          });
        },
        onError: (err: any) => {
          toast.error(`Failed to authorize: ${err.message}`);
        },
      }
    );
  };

  const handleReject = (a: Approval) => {
    rejectRequest.mutate(
      { approvalId: a.id },
      {
        onSuccess: () => {
          toast.success("Action rejected successfully.", {
            description: a.title,
          });
        },
        onError: (err: any) => {
          toast.error(`Failed to reject: ${err.message}`);
        },
      }
    );
  };

  if (isAppLoading) {
    return <LoadingState label="Loading pending approvals queue…" />;
  }

  if (isAppError) {
    return <ErrorState title="Approvals Fetch Failed" description={appError?.message} onRetry={() => refetchApps()} />;
  }

  return (
    <div className="space-y-6 animate-in-up">
      <div>
        <h2 className="font-display text-2xl font-semibold">Approvals Queue</h2>
        <p className="text-sm text-muted-foreground">High-impact plans awaiting human confirmation</p>
      </div>

      {mappedApprovals.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Approvals Queue Empty"
          description="Workflows are executing smoothly. No manual signatures are required at this time."
        />
      ) : (
        <div className="space-y-4">
          {mappedApprovals.map((a) => (
            <Card key={a.id} className="glass p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ShieldCheck className="h-5 w-5" aria-hidden />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={a.risk} />
                      <span className="text-xs text-muted-foreground">
                        Requested by {a.requestedBy} · {a.createdAt}
                      </span>
                    </div>
                    <h3 className="mt-1 font-display text-base font-semibold">{a.title}</h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">Blast radius: {a.blastRadius}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleReject(a)}>
                    <X className="h-4 w-4" /> Reject
                  </Button>
                  <Button size="sm" className="gap-1.5 bg-gradient-primary text-primary-foreground" onClick={() => handleApprove(a)}>
                    <Check className="h-4 w-4" /> Approve
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
                {a.plan.map((step, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-md border border-border/60 bg-muted/20 p-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-[11px] text-primary">
                      {i + 1}
                    </span>
                    <p className="text-sm">{step}</p>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

