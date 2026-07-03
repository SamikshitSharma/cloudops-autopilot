import { useState } from "react";
import { pipelineStages, type PipelineStage } from "@/lib/mock";
import { PipelineTimeline } from "@/components/workflows/PipelineTimeline";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap, RefreshCw, Pause, Play } from "lucide-react";
import { toast } from "sonner";

export default function Workflows() {
  const [selected, setSelected] = useState<PipelineStage>(pipelineStages.find((s) => s.status === "running") ?? pipelineStages[0]);

  return (
    <div className="space-y-6 animate-in-up">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl font-semibold">Workflow Center</h2>
            <Badge variant="outline" className="border-primary/40 text-primary">Run #P-2481</Badge>
          </div>
          <p className="text-sm text-muted-foreground">9-stage sequential AI agent pipeline · ingest → normalize → correlate → detect → reason → plan → simulate → approve → execute</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => toast.info("Pipeline paused")}><Pause className="h-4 w-4" /> Pause</Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => toast.info("Refreshed")}><RefreshCw className="h-4 w-4" /> Refresh</Button>
          <Button size="sm" className="gap-2 bg-gradient-primary text-primary-foreground" onClick={() => toast.success("New pipeline run triggered")}>
            <Zap className="h-4 w-4" /> Trigger run
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="glass p-5 lg:col-span-2">
          <h3 className="mb-4 font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">Pipeline</h3>
          <PipelineTimeline stages={pipelineStages} onSelect={setSelected} activeId={selected.id} />
        </Card>

        <Card className="glass p-6 lg:col-span-3">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">STAGE {String(selected.id).padStart(2, "0")}</span>
                <span className="text-xs uppercase tracking-widest text-primary">{selected.agent}</span>
              </div>
              <h3 className="mt-1 font-display text-xl font-semibold">{selected.name}</h3>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">{selected.description}</p>
            </div>
            <Button variant="outline" size="sm" className="gap-2"><Play className="h-3.5 w-3.5" /> Re-run</Button>
          </div>

          <Tabs defaultValue="io" className="mt-4">
            <TabsList>
              <TabsTrigger value="io">I/O</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
              <TabsTrigger value="metrics">Metrics</TabsTrigger>
              <TabsTrigger value="config">Config</TabsTrigger>
            </TabsList>
            <TabsContent value="io" className="mt-4 space-y-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Outputs</p>
                <ul className="mt-2 space-y-1.5">
                  {selected.outputs.length ? selected.outputs.map((o, i) => (
                    <li key={i} className="rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-xs">{o}</li>
                  )) : <li className="text-xs italic text-muted-foreground">Stage has not produced outputs yet.</li>}
                </ul>
              </div>
              <div className="grid grid-cols-3 gap-3 pt-2">
                <Stat label="Duration" value={selected.durationMs ? `${(selected.durationMs / 1000).toFixed(2)}s` : "—"} />
                <Stat label="Confidence" value={selected.confidence ? `${Math.round(selected.confidence * 100)}%` : "—"} />
                <Stat label="Status" value={selected.status} />
              </div>
            </TabsContent>
            <TabsContent value="logs" className="mt-4">
              <pre className="max-h-72 overflow-auto rounded-md border border-border bg-black/40 p-4 font-mono text-[11px] leading-relaxed text-foreground/80">
{`[23:14:02] ${selected.agent} :: booted (v4.2.1)
[23:14:02] loaded ontology schema v4.2 from registry
[23:14:03] processing ${selected.outputs[0] ?? "n/a"}
[23:14:04] ${selected.status === "running" ? "…streaming" : "completed"} in ${(selected.durationMs / 1000).toFixed(2)}s
[23:14:04] confidence=${selected.confidence.toFixed(2)}`}
              </pre>
            </TabsContent>
            <TabsContent value="metrics" className="mt-4 text-sm text-muted-foreground">
              Latency p50 / p95 / p99 · tokens · cache-hit rate · retries — instrumented per stage.
            </TabsContent>
            <TabsContent value="config" className="mt-4 text-sm text-muted-foreground">
              Prompt template, tools, timeouts and guardrail policies are versioned in the agent registry.
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
