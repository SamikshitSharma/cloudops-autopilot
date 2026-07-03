import { approvals } from "@/lib/mock";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SeverityBadge } from "@/components/ui-ext/SeverityBadge";
import { Check, X, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function Approvals() {
  return (
    <div className="space-y-6 animate-in-up">
      <div>
        <h2 className="font-display text-2xl font-semibold">Approvals Queue</h2>
        <p className="text-sm text-muted-foreground">High-impact plans awaiting human confirmation</p>
      </div>

      <div className="space-y-4">
        {approvals.map((a) => (
          <Card key={a.id} className="glass p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ShieldCheck className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={a.risk} />
                    <span className="text-xs text-muted-foreground">Requested by {a.requestedBy} · {a.createdAt}</span>
                  </div>
                  <h3 className="mt-1 font-display text-base font-semibold">{a.title}</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">Blast radius: {a.blastRadius}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast("Rejected", { description: a.title })}>
                  <X className="h-4 w-4" /> Reject
                </Button>
                <Button size="sm" className="gap-1.5 bg-gradient-primary text-primary-foreground" onClick={() => toast.success("Approved", { description: a.title })}>
                  <Check className="h-4 w-4" /> Approve
                </Button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
              {a.plan.map((step, i) => (
                <div key={i} className="flex items-start gap-3 rounded-md border border-border/60 bg-muted/20 p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-[11px] text-primary">
                    {i + 1}
                  </span>
                  <p className="text-sm">{step}</p>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
