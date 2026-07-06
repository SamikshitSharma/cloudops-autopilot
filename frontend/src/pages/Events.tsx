import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SeverityBadge } from "@/components/ui-ext/SeverityBadge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Pause, Play, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEvents } from "@/hooks/useEvents";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui-ext/StateViews";
import type { EventItem } from "@/lib/types";

export default function Events() {
  const [paused, setPaused] = useState(false);
  const [frozenItems, setFrozenItems] = useState<EventItem[]>([]);

  // Query real events from audit logs
  const { data: liveItems = [], isLoading, isError, error, refetch } = useEvents();

  useEffect(() => {
    if (!paused) {
      setFrozenItems(liveItems);
    }
  }, [liveItems, paused]);

  const items = paused ? frozenItems : liveItems;

  if (isLoading) {
    return <LoadingState label="Subscribing to orchestrator event streams…" />;
  }

  if (isError) {
    return <ErrorState title="Event Stream Subscription Failed" description={error?.message} onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-6 animate-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold">Event Bus</h2>
          <p className="text-sm text-muted-foreground">Real-time stream from every agent and integration</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5">
            <span className={`h-2 w-2 rounded-full ${paused ? "bg-muted-foreground" : "bg-success animate-pulse"}`} />
            {paused ? "Paused" : "Streaming"}
          </Badge>
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setPaused((p) => !p)}>
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            {paused ? "Resume" : "Pause"}
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Radio}
          title="Event Bus Silent"
          description="No operations have occurred. Agent events will stream dynamically once runs are active."
        />
      ) : (
        <Card className="glass overflow-hidden">
          <ScrollArea className="h-[560px]">
            <ul className="divide-y divide-border font-mono text-xs">
              {items.map((e) => (
                <li key={e.id} className="flex items-start gap-3 px-4 py-2 hover:bg-muted/30">
                  <span className="w-20 shrink-0 text-muted-foreground">{e.ts}</span>
                  <SeverityBadge severity={e.severity} dotOnly />
                  <span className="w-44 shrink-0 truncate text-primary">{e.topic}</span>
                  <span className="w-32 shrink-0 truncate text-muted-foreground">{e.source}</span>
                  <span className="flex-1 truncate text-foreground/90">{e.message}</span>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </Card>
      )}
    </div>
  );
}

