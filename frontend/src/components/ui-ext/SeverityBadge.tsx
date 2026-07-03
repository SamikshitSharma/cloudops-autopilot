import { cn } from "@/lib/utils";
import type { Severity } from "@/lib/mock";

const styles: Record<Severity, { dot: string; text: string; ring: string; label: string }> = {
  critical: { dot: "bg-destructive", text: "text-destructive", ring: "ring-destructive/30", label: "Critical" },
  high:     { dot: "bg-warning",     text: "text-warning",     ring: "ring-warning/30",     label: "High" },
  medium:   { dot: "bg-info",        text: "text-info",        ring: "ring-info/30",        label: "Medium" },
  low:      { dot: "bg-primary",     text: "text-primary",     ring: "ring-primary/30",     label: "Low" },
  info:     { dot: "bg-muted-foreground", text: "text-muted-foreground", ring: "ring-border", label: "Info" },
};

interface Props {
  severity: Severity;
  dotOnly?: boolean;
  className?: string;
}

export function SeverityBadge({ severity, dotOnly, className }: Props) {
  const s = styles[severity];
  if (dotOnly) {
    return (
      <span className={cn("mt-1.5 inline-flex h-2 w-2 shrink-0 rounded-full ring-4", s.dot, s.ring, className)} aria-label={s.label} />
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium", s.text, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} aria-hidden />
      {s.label}
    </span>
  );
}
