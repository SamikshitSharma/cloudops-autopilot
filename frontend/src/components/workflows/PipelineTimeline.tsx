import { CheckCircle2, CircleDashed, Loader2, XCircle, MinusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PipelineStage } from "@/lib/mock";
import { Progress } from "@/components/ui/progress";

const iconFor = (s: PipelineStage["status"]) =>
  s === "complete" ? CheckCircle2 :
  s === "running"  ? Loader2 :
  s === "failed"   ? XCircle :
  s === "skipped"  ? MinusCircle : CircleDashed;

const colorFor = (s: PipelineStage["status"]) =>
  s === "complete" ? "text-success border-success/40 bg-success/10" :
  s === "running"  ? "text-primary border-primary/50 bg-primary/10" :
  s === "failed"   ? "text-destructive border-destructive/40 bg-destructive/10" :
  s === "skipped"  ? "text-muted-foreground border-border bg-muted/40" :
                     "text-muted-foreground border-border bg-muted/30";

export function PipelineTimeline({
  stages,
  onSelect,
  activeId,
}: {
  stages: PipelineStage[];
  onSelect?: (s: PipelineStage) => void;
  activeId?: number;
}) {
  return (
    <ol className="relative space-y-3">
      {stages.map((stage, idx) => {
        const Icon = iconFor(stage.status);
        const isLast = idx === stages.length - 1;
        const active = activeId === stage.id;
        return (
          <li key={stage.id} className="relative">
            {!isLast && (
              <span
                className={cn(
                  "absolute left-[19px] top-10 h-full w-px",
                  stage.status === "complete" ? "bg-gradient-to-b from-success to-primary" : "bg-border",
                )}
                aria-hidden
              />
            )}
            <button
              type="button"
              onClick={() => onSelect?.(stage)}
              className={cn(
                "group flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-all",
                active ? "border-primary/50 bg-primary/5 shadow-elegant" : "border-transparent hover:border-border hover:bg-muted/30",
              )}
              aria-current={active ? "step" : undefined}
            >
              <div
                className={cn(
                  "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border",
                  colorFor(stage.status),
                )}
              >
                <Icon className={cn("h-4 w-4", stage.status === "running" && "animate-spin")} aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground">STAGE {String(stage.id).padStart(2, "0")}</span>
                      <span className="text-[10px] uppercase tracking-widest text-primary">{stage.agent}</span>
                    </div>
                    <h4 className="mt-0.5 truncate font-display text-sm font-semibold">{stage.name}</h4>
                  </div>
                  {stage.status !== "queued" && stage.status !== "skipped" && (
                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                      {stage.durationMs > 0 ? `${(stage.durationMs / 1000).toFixed(2)}s` : ""}
                    </span>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{stage.description}</p>
                {stage.confidence > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <Progress value={stage.confidence * 100} className="h-1 flex-1" />
                    <span className="font-mono text-[10px] text-muted-foreground">{Math.round(stage.confidence * 100)}%</span>
                  </div>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
