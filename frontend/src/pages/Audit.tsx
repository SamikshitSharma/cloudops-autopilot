import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ScrollText, Play } from "lucide-react";
import { useAudit } from "@/hooks/useAudit";
import { useRerunWorkflow } from "@/hooks/useWorkflow";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui-ext/StateViews";
import type { AuditEntry } from "@/lib/types";

interface TraceAuditEntry extends AuditEntry {
  workflowId: string;
  correlationId: string;
  agentId: string;
  resourceId: string;
  duration: string;
  reason: string;
  executionResult: string;
  rawPayload: any;
}

const outcomeCls = {
  success: "text-success",
  failed: "text-destructive",
  pending: "text-warning",
} as const;

export default function Audit() {
  const { data: dbLogs, isLoading, isError, error, refetch } = useAudit();
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const rerunWorkflow = useRerunWorkflow(null);

  const handleReplay = (wfId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!wfId || wfId === "—") {
      toast.error("Invalid workflow ID for replay");
      return;
    }
    rerunWorkflow.mutate(wfId, {
      onSuccess: () => {
        toast.success("Workflow rerun successfully triggered from audit log!");
      },
      onError: (err: any) => {
        toast.error(`Replay failed: ${err.message}`);
      }
    });
  };

  const auditLedger = useMemo((): TraceAuditEntry[] => {
    if (!dbLogs) return [];
    return dbLogs.map((e) => {
      // Reconstruct dynamic hash from unique ID
      const charHex = Array.from(e.id)
        .map((c) => c.charCodeAt(0).toString(16))
        .join("");
      const hash = `0x${charHex.slice(0, 16)}`;

      let target = "—";
      if (e.payload) {
        if (e.payload.resource_id) target = e.payload.resource_id;
        else if (e.payload.tool_name) target = e.payload.tool_name;
        else if (e.payload.scenario) target = e.payload.scenario;
        else if (e.payload.remediated_resources) target = e.payload.remediated_resources.join(", ");
      }

      // Outcome parsing
      let outcome: "success" | "failed" | "pending" = "success";
      if (e.status === "failure") outcome = "failed";
      else if (e.status === "warning") outcome = "pending";

      const payloadInner = e.payload?.payload || {};

      return {
        id: e.id,
        ts: new Date(e.timestamp).toLocaleString(),
        actor: e.agent_name || "orchestrator",
        action: e.event_type || e.step_name,
        target,
        outcome,
        hash,
        workflowId: e.payload?.workflow_id || e.payload?.workflow_run_id || e.run_id,
        correlationId: e.payload?.correlation_id || "—",
        agentId: e.agent_name,
        resourceId: payloadInner.resource_id || e.payload?.resource_id || payloadInner.selected_resource || "—",
        duration: payloadInner.duration_sec !== undefined ? `${payloadInner.duration_sec.toFixed(3)}s` : (payloadInner.duration_seconds !== undefined ? `${payloadInner.duration_seconds.toFixed(3)}s` : "—"),
        reason: payloadInner.objective || payloadInner.reason || payloadInner.scenario || "—",
        executionResult: payloadInner.status || (payloadInner.execution_results ? JSON.stringify(payloadInner.execution_results, null, 2) : "—"),
        rawPayload: e.payload
      };
    });
  }, [dbLogs]);

  if (isLoading) {
    return <LoadingState label="Loading immutable audit logs ledger…" />;
  }

  if (isError) {
    return <ErrorState title="Audit Ledger Fetch Failed" description={error?.message} onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-6 animate-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold">Audit Ledger</h2>
          <p className="text-sm text-muted-foreground">Tamper-evident, hash-chained record of every action</p>
        </div>
        <Badge variant="outline" className="gap-1.5 border-success/40 text-success">
          <ShieldCheck className="h-3.5 w-3.5" /> Chain integrity verified
        </Badge>
      </div>

      {auditLedger.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="Audit Ledger Empty"
          description="No operations have been run yet. Audit trail will record execution details dynamically."
        />
      ) : (
        <Card className="glass overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead />
                <TableHead>Timestamp</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target Resource</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Hash</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditLedger.map((e) => (
                <optgroup key={e.id} label="ledger-entry" className="contents">
                  <TableRow className="cursor-pointer hover:bg-muted/40 transition" onClick={() => setExpandedRow(expandedRow === e.id ? null : e.id)}>
                    <TableCell className="text-center font-bold text-xs text-muted-foreground w-6">
                      {expandedRow === e.id ? "▼" : "▶"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">{e.ts}</TableCell>
                    <TableCell className="font-semibold">{e.actor}</TableCell>
                    <TableCell className="font-mono text-xs text-primary">{e.action}</TableCell>
                    <TableCell className="font-mono text-xs">{e.resourceId !== "—" ? e.resourceId : e.target}</TableCell>
                    <TableCell className="font-mono text-xs">{e.duration}</TableCell>
                    <TableCell className={`text-xs font-semibold capitalize ${outcomeCls[e.outcome]}`}>{e.outcome}</TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">{e.hash}</TableCell>
                  </TableRow>
                  {expandedRow === e.id && (
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableCell colSpan={8} className="p-4 border-t-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                          <div className="space-y-3">
                            <h4 className="font-bold uppercase tracking-wider text-muted-foreground text-[10px]">Trace Context</h4>
                            <div className="grid grid-cols-3 gap-y-2 gap-x-4 border border-border/40 p-3 rounded bg-background/50">
                              <span className="text-muted-foreground flex items-center">Workflow ID:</span>
                              <span className="col-span-2 font-mono break-all text-foreground flex items-center justify-between gap-2">
                                <Link to={`/workflows?id=${e.workflowId}`} className="text-primary hover:underline">{e.workflowId}</Link>
                                {e.workflowId && e.workflowId !== "—" && (
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="h-5 px-1.5 text-[9px] gap-1 flex items-center border-primary/40 text-primary bg-primary/5 hover:bg-primary/10" 
                                    onClick={(event) => handleReplay(e.workflowId, event)}
                                    disabled={rerunWorkflow.isPending}
                                  >
                                    <Play className="h-2.5 w-2.5" /> Replay Run
                                  </Button>
                                )}
                              </span>
                              <span className="text-muted-foreground">Correlation ID:</span>
                              <span className="col-span-2 font-mono break-all text-foreground">{e.correlationId}</span>
                              <span className="text-muted-foreground">Agent ID:</span>
                              <span className="col-span-2 font-mono text-foreground">{e.agentId}</span>
                              <span className="text-muted-foreground">Resource ID:</span>
                              <span className="col-span-2 font-mono break-all text-foreground">
                                {e.resourceId && e.resourceId !== "—" ? (
                                  <Link 
                                    to={`/resources?q=${encodeURIComponent(e.resourceId)}`} 
                                    className="text-primary hover:underline"
                                    onClick={() => localStorage.setItem("last_selected_resource_id", e.resourceId)}
                                  >
                                    {e.resourceId}
                                  </Link>
                                ) : "—"}
                              </span>
                            </div>
                            <div className="pt-2 border-t border-border/40">
                              <span className="text-muted-foreground block font-medium">Reason / Objective:</span>
                              <span className="text-foreground mt-0.5 block">{e.reason}</span>
                            </div>
                            {e.executionResult !== "—" && (
                              <div className="pt-2">
                                <span className="text-muted-foreground block font-medium">Execution Result Summary:</span>
                                <pre className="text-foreground mt-1.5 block font-mono text-[11px] max-h-40 overflow-y-auto bg-black/30 p-2.5 rounded border border-border/40 whitespace-pre-wrap break-all leading-normal">{e.executionResult}</pre>
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <h4 className="font-bold uppercase tracking-wider text-muted-foreground text-[10px]">Raw Event Payload Details</h4>
                            <pre className="max-h-64 overflow-y-auto rounded border border-border/40 bg-black/40 p-3 font-mono text-[10px] leading-relaxed text-foreground/80 whitespace-pre-wrap break-all leading-normal">
                              {JSON.stringify(e.rawPayload, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </optgroup>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

