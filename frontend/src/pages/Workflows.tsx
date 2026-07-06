import { useState, useMemo } from "react";
import { PipelineTimeline } from "@/components/workflows/PipelineTimeline";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap, RefreshCw, Pause, Play, GitBranch } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  useWorkflows,
  useWorkflowDetails,
  useTriggerWorkflow,
  usePauseWorkflow,
  useResumeWorkflow,
  useRerunWorkflow,
} from "@/hooks/useWorkflow";
import { useSearchParams } from "react-router-dom";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui-ext/StateViews";
import type { PipelineStage } from "@/lib/types";

// Stage templates aligned with actual sequential orchestrator stage IDs
const STAGE_TEMPLATES = [
  { id: 1, key: "executive_orchestrator", name: "Executive Orchestration", agent: "Executive Orchestrator", description: "Orchestrates reasoning, logs events, and sequences agents." },
  { id: 2, key: "inventory_agent", name: "Resource Inventory", agent: "Inventory Agent", description: "Discovers Azure Cloud resources and updates the asset inventory database." },
  { id: 3, key: "telemetry_agent", name: "Telemetry Collection", agent: "Telemetry Agent", description: "Collects utilization metrics, CPU, memory, and database IOPS." },
  { id: 4, key: "analysis_agent", name: "Analysis & Anomaly Detection", agent: "Analysis Agent", description: "Detects underutilized resources and anomalies from telemetry data." },
  { id: 5, key: "recommendation_agent", name: "Recommendation Generation", agent: "Recommendation Agent", description: "Generates ranked cost optimization recommendations from analysis results." },
  { id: 6, key: "risk_assessment_agent", name: "Risk Assessment", agent: "Risk Assessment Agent", description: "Validates security rules, checks policies, and calculates blast radius." },
  { id: 7, key: "approval_agent", name: "Human-in-the-loop Gate", agent: "Approval Agent", description: "Blocks execution for high-risk changes, requests human sign-off." },
  { id: 8, key: "execution_agent", name: "Remediation Execution", agent: "Execution Agent", description: "Dispatches tasks, applies remediation, and updates resource states." },
  { id: 9, key: "audit_agent", name: "Audit & Verification", agent: "Audit Agent", description: "Verifies systems nominal, validates metrics changes, and logs audit ledger." },
];

export default function Workflows() {
  const queryClient = useQueryClient();
  const { data: workflows = [], isLoading: isHistoryLoading, isError: isHistoryError, error: historyError } = useWorkflows();
  const triggerWorkflow = useTriggerWorkflow();

  const [searchParams, setSearchParams] = useSearchParams();
  const workflowIdParam = searchParams.get("id");

  const activeWfId = useMemo(() => {
    if (workflowIdParam) return workflowIdParam;
    if (workflows.length > 0) return workflows[0].workflow_id;
    return null;
  }, [workflowIdParam, workflows]);

  const { data: wfDetails, isLoading: isDetailsLoading, refetch: refetchDetails } = useWorkflowDetails(activeWfId);
  const pauseWorkflow = usePauseWorkflow(activeWfId);
  const resumeWorkflow = useResumeWorkflow(activeWfId);
  const rerunWorkflow = useRerunWorkflow(activeWfId);

  const [selectedKey, setSelectedKey] = useState<string>("executive_orchestrator");

  const stages = useMemo(() => {
    return STAGE_TEMPLATES.map((tmpl): PipelineStage => {
      const dbStage = wfDetails?.stages?.find((s) => s.stage_id === tmpl.key);
      let status: PipelineStage["status"] = "queued";
      let durationMs = 0;
      let confidence = 0;
      let outputs: string[] = [];

      if (dbStage) {
        if (dbStage.status === "success") status = "complete";
        else if (dbStage.status === "pending") status = "queued";
        else status = dbStage.status as any;

        durationMs = (dbStage.duration || 0) * 1000;
        confidence = dbStage.confidence || 0;

        if (dbStage.output_summary) {
          if (Array.isArray(dbStage.output_summary)) {
            outputs = dbStage.output_summary.map((o) => String(o));
          } else if (typeof dbStage.output_summary === "object") {
            outputs = Object.entries(dbStage.output_summary).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
          } else {
            outputs = [String(dbStage.output_summary)];
          }
        }
      }

      return { ...tmpl, status, durationMs, confidence, outputs };
    });
  }, [wfDetails]);

  const selectedStage = useMemo(() => {
    return stages.find((s) => s.key === selectedKey) || stages[0];
  }, [stages, selectedKey]);

  const dbStageSelected = useMemo(() => {
    return wfDetails?.stages?.find((s) => s.stage_id === selectedStage.key);
  }, [wfDetails, selectedStage]);

  const logTrace = useMemo(() => {
    if (!dbStageSelected) {
      return `[Stage: ${selectedStage.name}]\nWaiting in orchestrator execution queue...`;
    }
    return `[${new Date(dbStageSelected.started_at || "").toLocaleTimeString()}] Orchestrator Dispatched Agent: ${dbStageSelected.stage_name}
[Status] ${dbStageSelected.status.toUpperCase()}
[Duration] ${dbStageSelected.duration ? `${dbStageSelected.duration.toFixed(3)} seconds` : "running..."}
[Confidence] ${dbStageSelected.confidence ? `${(dbStageSelected.confidence * 100).toFixed(1)}%` : "N/A"}

[Inputs]
${JSON.stringify(dbStageSelected.input_summary, null, 2)}

[Outputs]
${JSON.stringify(dbStageSelected.output_summary, null, 2)}

[Causal Reasoning Graph Analysis]
${JSON.stringify(dbStageSelected.reasoning_summary, null, 2)}

[LLM Trace metadata]
${JSON.stringify(dbStageSelected.llm_trace, null, 2)}`;
  }, [dbStageSelected, selectedStage]);

  const handlePauseResume = () => {
    if (!wfDetails || !activeWfId) return;
    if (wfDetails.status === "paused") {
      resumeWorkflow.mutate(undefined, {
        onSuccess: () => { toast.success("Workflow resumed successfully."); refetchDetails(); },
        onError: (err: any) => { toast.error(`Resume failed: ${err.message}`); }
      });
    } else {
      pauseWorkflow.mutate(undefined, {
        onSuccess: () => { toast.success("Workflow pause request dispatched."); refetchDetails(); },
        onError: (err: any) => { toast.error(`Pause failed: ${err.message}`); }
      });
    }
  };

  const handleRerun = () => {
    if (!activeWfId) return;
    rerunWorkflow.mutate(undefined, {
      onSuccess: () => {
        toast.success("Workflow rerun successfully triggered!");
        refetchDetails();
      },
      onError: (err: any) => {
        toast.error(`Rerun failed: ${err.message}`);
      }
    });
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries();
    refetchDetails();
    toast.success("Workflow and dashboard state refreshed.");
  };

  const handleTriggerRun = () => {
    triggerWorkflow.mutate(
      { scenario_name: "idle_vm", objective: "Optimize Idle Virtual Compute Instances", execution_mode: "MOCK" },
      {
        onSuccess: (res) => {
          toast.success("New autonomous multi-agent reasoning sweep triggered successfully!");
          if (res.workflow_id) {
            setSearchParams({ id: res.workflow_id });
            refetchDetails();
          }
        },
        onError: (err: any) => { toast.error(`Trigger failed: ${err.message}`); },
      }
    );
  };

  if (isHistoryLoading || isDetailsLoading) {
    return <LoadingState label="Synchronizing orchestrator workflow logs state…" />;
  }

  if (isHistoryError) {
    return <ErrorState title="Workflow Center Connection Failed" description={historyError?.message} onRetry={() => refetchDetails()} />;
  }

  if (workflows.length === 0) {
    return (
      <div className="space-y-6 animate-in-up">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold">Workflow Center</h2>
            <p className="text-sm text-muted-foreground">9-stage sequential AI agent pipeline</p>
          </div>
          <Button size="sm" className="gap-2 bg-gradient-primary text-primary-foreground" onClick={handleTriggerRun}>
            <Zap className="h-4 w-4" /> Trigger run
          </Button>
        </div>
        <EmptyState
          icon={GitBranch}
          title="No workflows executed yet"
          description="Click Trigger run to execute the sequential AI agent orchestrator reasoning cycle."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in-up">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl font-semibold">Workflow Center</h2>
            <Badge variant="outline" className="border-primary/40 text-primary">Run #{activeWfId?.slice(0, 13)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">9-stage sequential AI agent pipeline · inventory → telemetry → analysis → recommendation → risk → approval → execution → audit</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={handlePauseResume}>
            {wfDetails?.status === "paused" ? (
              <><Play className="h-4 w-4" /> Resume</>
            ) : (
              <><Pause className="h-4 w-4" /> Pause</>
            )}
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button size="sm" className="gap-2 bg-gradient-primary text-primary-foreground" onClick={handleTriggerRun}>
            <Zap className="h-4 w-4" /> Trigger run
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="glass p-5 lg:col-span-2">
          <h3 className="mb-4 font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">Pipeline</h3>
          <PipelineTimeline stages={stages} onSelect={(s) => setSelectedKey(s.key)} activeId={selectedStage.id} />
        </Card>

        <Card className="glass p-6 lg:col-span-3">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">STAGE {String(selectedStage.id).padStart(2, "0")}</span>
                <span className="text-xs uppercase tracking-widest text-primary">{selectedStage.agent}</span>
              </div>
              <h3 className="mt-1 font-display text-xl font-semibold">{selectedStage.name}</h3>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">{selectedStage.description}</p>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleRerun} disabled={rerunWorkflow.isPending}>
              <Play className="h-3.5 w-3.5" /> Re-run
            </Button>
          </div>

          <Tabs defaultValue="io" className="mt-4">
            <TabsList>
              <TabsTrigger value="io">I/O</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
              <TabsTrigger value="metrics">Metrics</TabsTrigger>
              <TabsTrigger value="config">Reasoning & Policies</TabsTrigger>
            </TabsList>
            <TabsContent value="io" className="mt-4 space-y-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Inputs</p>
                <div className="mt-1.5 rounded-md border border-border bg-black/20 p-2.5 font-mono text-[11px] leading-normal break-all">
                  {dbStageSelected?.input_summary ? JSON.stringify(dbStageSelected.input_summary, null, 2) : "{}"}
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mt-3">Outputs</p>
                <div className="mt-1.5 rounded-md border border-border bg-black/20 p-2.5 font-mono text-[11px] leading-normal break-all">
                  {dbStageSelected?.output_summary ? JSON.stringify(dbStageSelected.output_summary, null, 2) : "{}"}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 pt-2">
                <Stat label="Duration" value={selectedStage.durationMs ? `${(selectedStage.durationMs / 1000).toFixed(2)}s` : "—"} />
                <Stat label="Confidence" value={selectedStage.confidence ? `${Math.round(selectedStage.confidence * 100)}%` : "—"} />
                <Stat label="Status" value={selectedStage.status} />
              </div>
            </TabsContent>
            <TabsContent value="logs" className="mt-4">
              <pre className="max-h-72 overflow-auto rounded-md border border-border bg-black/40 p-4 font-mono text-[11px] leading-relaxed text-foreground/80 whitespace-pre-wrap break-all leading-normal">
                {logTrace}
              </pre>
            </TabsContent>
            <TabsContent value="metrics" className="mt-4 space-y-4">
              <div className="rounded-md border border-border bg-black/40 p-4 font-mono text-[11px] leading-relaxed space-y-3 whitespace-pre-wrap leading-normal break-all">
                <div>
                  <span className="text-primary block font-semibold text-[10px] uppercase tracking-wider mb-1">Latency & Performance:</span>
                  <span className="text-foreground/90">Agent Latency: {dbStageSelected?.duration ? `${dbStageSelected.duration.toFixed(3)}s` : "—"}</span>
                </div>
                {dbStageSelected?.llm_trace?.llm_calls && dbStageSelected.llm_trace.llm_calls.length > 0 && (
                  <div>
                    <span className="text-primary block font-semibold text-[10px] uppercase tracking-wider mb-1">LLM Requests & Token Usage:</span>
                    <span className="text-foreground/90 leading-relaxed block">
                      Model: {dbStageSelected.llm_trace.model_used || "—"}<br />
                      Prompt Version: {dbStageSelected.llm_trace.prompt_version || "—"}<br />
                      Prompt Tokens: {dbStageSelected.llm_trace.llm_calls[0].prompt_tokens || "—"}<br />
                      Completion Tokens: {dbStageSelected.llm_trace.llm_calls[0].completion_tokens || "—"}<br />
                      Total Tokens: {(dbStageSelected.llm_trace.llm_calls[0].prompt_tokens + dbStageSelected.llm_trace.llm_calls[0].completion_tokens) || "—"}<br />
                      Cost Estimate: ${(((dbStageSelected.llm_trace.llm_calls[0].prompt_tokens * 0.15) + (dbStageSelected.llm_trace.llm_calls[0].completion_tokens * 0.60)) / 1000000).toFixed(5)}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-primary block font-semibold text-[10px] uppercase tracking-wider mb-1">Azure SDK Calls:</span>
                  <span className="text-foreground/90">
                    API Operations: {dbStageSelected?.llm_trace?.azure_calls && dbStageSelected.llm_trace.azure_calls.length > 0
                      ? dbStageSelected.llm_trace.azure_calls.join(", ")
                      : "None"}
                    <br />
                    Source: {dbStageSelected?.llm_trace?.azure_api_source || "Local Cache"}
                  </span>
                </div>
                <div>
                  <span className="text-primary block font-semibold text-[10px] uppercase tracking-wider mb-1">Database Operations:</span>
                  <span className="text-foreground/90">
                    Tables Written: {dbStageSelected?.llm_trace?.db_writes && dbStageSelected.llm_trace.db_writes.length > 0
                      ? dbStageSelected.llm_trace.db_writes.join(", ")
                      : "None"}
                  </span>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="config" className="mt-4 space-y-4">
              <div className="rounded-md border border-border bg-black/40 p-4 font-mono text-[11px] leading-relaxed space-y-3 whitespace-pre-wrap leading-normal break-all">
                <div>
                  <span className="text-primary block font-semibold text-[10px] uppercase tracking-wider mb-1">Agent Causal Thoughts:</span>
                  <span className="text-foreground/90 block italic bg-muted/10 p-2 rounded border border-border/30 mt-1">"{dbStageSelected?.reasoning_summary?.thought || "None"}"</span>
                </div>
                <div>
                  <span className="text-primary block font-semibold text-[10px] uppercase tracking-wider mb-1">Policy Decisions & Checked Rules:</span>
                  <span className="text-foreground/90">{dbStageSelected?.reasoning_summary?.evidence || "No active policy checkpoints."}</span>
                </div>
                {selectedStage.key === "execution_agent" && (
                  <div>
                    <span className="text-primary block font-semibold text-[10px] uppercase tracking-wider mb-1">Rollback Status:</span>
                    <span className="text-foreground/90 block block-mono bg-black/20 p-2 rounded">
                      Rollback Plan: "Revert VM stop/start or storage purge"<br />
                      Status: {dbStageSelected?.output_summary?.execution_results?.[0]?.rollback_status || "NONE"}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-primary block font-semibold text-[10px] uppercase tracking-wider mb-1">Artifacts Generated:</span>
                  <span className="text-foreground/90 leading-relaxed block">
                    - {selectedStage.key}.json (persisted run DTO schema)<br />
                    {selectedStage.key === "recommendation_agent" && "- cost-governance-audit-signoff.hash\n"}
                    {selectedStage.key === "audit_agent" && "- cryptographic-integrity-hash.bin\n"}
                  </span>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-lg font-semibold capitalize">{value}</p>
    </div>
  );
}
