import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useApprovals } from "@/hooks/useApprovals";
import { useRecommendations } from "@/hooks/useRecommendations";
import type { Notification } from "@/lib/types";
import { toast } from "sonner";
import { SeverityBadge } from "@/components/ui-ext/SeverityBadge";

export function NotificationCenter() {
  const { data: approvals = [] } = useApprovals();
  const { data: recommendations = [] } = useRecommendations();

  const pendingApprovals = approvals.filter((a) => a.status === "pending");
  const items: Notification[] = pendingApprovals.map((a) => {
    const reco = recommendations.find((r) => r.id === a.recommendation_id);
    return {
      id: a.id,
      title: reco ? `${reco.action_type.toUpperCase()} Action Required` : "Approval Request",
      body: reco ? reco.rationale : `Resource state change approval requested.`,
      severity: reco ? (reco.risk_level === "high" ? "high" : "low") : "medium",
      ts: new Date(a.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      read: false,
    };
  });
  const unread = items.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications (${unread} unread)`}>
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-border p-3">
          <div>
            <div className="text-sm font-medium">Notifications</div>
            <div className="text-xs text-muted-foreground">{unread} unread</div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => toast.info("Pending approvals must be resolved from the Approvals Queue.")}>
            Mark all read
          </Button>
        </div>
        <ScrollArea className="max-h-96">
          <ul className="divide-y divide-border">
            {items.map((n) => (
              <li key={n.id} className="flex gap-3 p-3 hover:bg-muted/40">
                <SeverityBadge severity={n.severity} dotOnly />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{n.title}</p>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{n.ts}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                </div>
                {!n.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
              </li>
            ))}
          </ul>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
