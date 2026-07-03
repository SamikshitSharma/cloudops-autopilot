import { useEffect, useState } from "react";
import { events as seed, type EventItem, type Severity } from "@/lib/mock";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SeverityBadge } from "@/components/ui-ext/SeverityBadge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

const topics = ["anomaly.detected", "cost.budget.warn", "plan.generated", "policy.violation", "resource.healthy", "execution.applied"];
const messages = [
  "p95 latency drifted +80ms on checkout-svc",
  "GKE node pool at 92% utilization",
  "Cost anomaly on ml-training account (+$920)",
  "IAM privilege escalation attempt blocked",
  "Auto-scaled api-prod-* to 6 replicas",
];
const sev: Severity[] = ["info", "low", "medium", "high", "critical"];

export default function Events() {
  const [items, setItems] = useState<EventItem[]>(seed);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      const now = new Date();
      const ts = now.toTimeString().slice(0, 8);
      const e: EventItem = {
        id: `e-${now.getTime()}`,
        ts,
        topic: topics[Math.floor(Math.random() * topics.length)],
        severity: sev[Math.floor(Math.random() * sev.length)],
        message: messages[Math.floor(Math.random() * messages.length)],
        source: ["sensor-agent", "detector-agent", "planner-agent", "cost-agent"][Math.floor(Math.random() * 4)],
      };
      setItems((prev) => [e, ...prev].slice(0, 60));
    }, 2200);
    return () => clearInterval(id);
  }, [paused]);

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
    </div>
  );
}
