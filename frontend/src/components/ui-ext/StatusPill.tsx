import { cn } from "@/lib/utils";
import type { Status } from "@/lib/mock";

const map: Record<Status, { label: string; cls: string; dot: string }> = {
  healthy:  { label: "Healthy",  cls: "text-success border-success/30 bg-success/10", dot: "bg-success" },
  degraded: { label: "Degraded", cls: "text-warning border-warning/30 bg-warning/10", dot: "bg-warning" },
  failing:  { label: "Failing",  cls: "text-destructive border-destructive/30 bg-destructive/10", dot: "bg-destructive" },
  unknown:  { label: "Unknown",  cls: "text-muted-foreground border-border bg-muted/40", dot: "bg-muted-foreground" },
};

export function StatusPill({ status, className }: { status: Status; className?: string }) {
  const s = map[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium", s.cls, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} aria-hidden />
      {s.label}
    </span>
  );
}
