import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export function LoadingState({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground", className)}>
      <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({
  title, description, icon: Icon = Inbox, action, className,
}: {
  title: string; description?: string; icon?: typeof Inbox; action?: ReactNode; className?: string;
}) {
  return (
    <div className={cn("glass flex flex-col items-center justify-center gap-3 rounded-lg p-10 text-center", className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
      </div>
      <h3 className="font-display text-base font-semibold">{title}</h3>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this section. Please retry.",
  onRetry,
}: { title?: string; description?: string; onRetry?: () => void }) {
  return (
    <div className="glass flex flex-col items-center justify-center gap-3 rounded-lg p-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
        <AlertTriangle className="h-5 w-5" aria-hidden />
      </div>
      <h3 className="font-display text-base font-semibold">{title}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {onRetry && <Button variant="outline" onClick={onRetry}>Retry</Button>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted animate-shimmer",
        className,
      )}
      aria-hidden
    />
  );
}
