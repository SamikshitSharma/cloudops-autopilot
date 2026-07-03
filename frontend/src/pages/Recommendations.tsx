import { useState } from "react";
import { recommendations } from "@/lib/mock";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SeverityBadge } from "@/components/ui-ext/SeverityBadge";
import { Sparkles, TrendingUp, ShieldCheck, Zap, Cpu } from "lucide-react";
import { toast } from "sonner";

const catIcon = { cost: TrendingUp, security: ShieldCheck, reliability: Zap, performance: Cpu };
const catColor = {
  cost: "text-success",
  security: "text-destructive",
  reliability: "text-warning",
  performance: "text-primary",
} as const;

export default function Recommendations() {
  const [filter, setFilter] = useState<string>("all");
  const list = recommendations.filter((r) => filter === "all" || r.category === filter);

  return (
    <div className="space-y-6 animate-in-up">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold">Recommendations</h2>
          <p className="text-sm text-muted-foreground">AI-generated actions ranked by impact and confidence</p>
        </div>
        <div className="flex gap-1 rounded-md border border-border bg-muted/30 p-1">
          {["all", "cost", "reliability", "security", "performance"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded px-3 py-1 text-xs font-medium capitalize transition ${
                filter === f ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {list.map((r) => {
          const Icon = catIcon[r.category];
          return (
            <Card key={r.id} className="glass group relative overflow-hidden p-5 transition-all hover:-translate-y-0.5 hover:shadow-elegant">
              <div className="flex items-start gap-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted ${catColor[r.category]}`}>
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] uppercase">{r.category}</Badge>
                    <SeverityBadge severity={r.severity} />
                    <span className="ml-auto text-[11px] text-muted-foreground">{r.createdAt}</span>
                  </div>
                  <h3 className="mt-2 font-display text-base font-semibold leading-snug">{r.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{r.impact}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground">Target: {r.resource}</span>
                    {r.savings && <Badge className="bg-success/15 text-success hover:bg-success/20">{r.savings}</Badge>}
                    <span className="ml-auto inline-flex items-center gap-1 text-xs text-primary">
                      <Sparkles className="h-3 w-3" /> {Math.round(r.confidence * 100)}% confidence
                    </span>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button size="sm" className="bg-gradient-primary text-primary-foreground" onClick={() => toast.success("Sent to approvals queue")}>Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => toast.info("Opened plan preview")}>Preview plan</Button>
                    <Button size="sm" variant="ghost" onClick={() => toast("Dismissed", { description: r.title })}>Dismiss</Button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
