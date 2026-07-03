import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

const factors = [
  { name: "RDS connection pool saturation", weight: 0.42, direction: "positive" },
  { name: "Sudden traffic spike (US-East, +180%)", weight: 0.28, direction: "positive" },
  { name: "Elevated GC pauses on api-prod-02", weight: 0.14, direction: "positive" },
  { name: "Deploy correlation (release v3.11 · 22m ago)", weight: 0.10, direction: "positive" },
  { name: "Prior baseline within tolerance", weight: 0.06, direction: "negative" },
];

export default function Explainability() {
  return (
    <div className="space-y-6 animate-in-up">
      <div>
        <h2 className="font-display text-2xl font-semibold">Explainability</h2>
        <p className="text-sm text-muted-foreground">Why the Reasoner Agent selected its top hypothesis</p>
      </div>

      <Card className="glass p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Badge variant="outline" className="gap-1.5 border-primary/40 text-primary">
              <Sparkles className="h-3 w-3" /> Hypothesis #H-4820
            </Badge>
            <h3 className="mt-3 font-display text-xl font-semibold">
              orders-primary connection pool exhaustion under traffic spike
            </h3>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              The Reasoner Agent correlated a 180% traffic burst with a saturated Postgres connection pool and elevated
              GC pauses on the api tier. The proposed remediation scales the pool and adds a read replica.
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Confidence</p>
            <p className="font-display text-4xl font-semibold text-gradient">86%</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="glass p-5">
          <h3 className="mb-4 font-display text-base font-semibold">Contributing Factors</h3>
          <ul className="space-y-3">
            {factors.map((f) => (
              <li key={f.name}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>{f.name}</span>
                  <span className={`font-mono text-xs ${f.direction === "positive" ? "text-primary" : "text-muted-foreground"}`}>
                    {f.direction === "positive" ? "+" : "−"}{Math.round(f.weight * 100)}%
                  </span>
                </div>
                <Progress value={f.weight * 100} className="h-1.5" />
              </li>
            ))}
          </ul>
        </Card>

        <Card className="glass p-5">
          <h3 className="mb-4 font-display text-base font-semibold">Model Provenance</h3>
          <dl className="space-y-3 text-sm">
            <Row label="Reasoner model" value="autopilot-reasoner-v2.4 (fine-tuned)" />
            <Row label="Detector ensemble" value="isolation-forest + prophet-v3" />
            <Row label="Prompt template" value="reasoner/root-cause@v12" />
            <Row label="Tools invoked" value="graph.query · metrics.fetch · logs.search" />
            <Row label="Retrieval sources" value="runbooks (14) · postmortems (3) · docs (7)" />
            <Row label="Guardrails applied" value="policy.blast_radius · policy.rollback_required" />
          </dl>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/60 pb-2 last:border-none">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-mono text-xs">{value}</dd>
    </div>
  );
}
