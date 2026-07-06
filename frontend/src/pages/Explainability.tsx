import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Sparkles, HelpCircle } from "lucide-react";
import { useExplainability } from "@/hooks/useExplainability";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui-ext/StateViews";

export default function Explainability() {
  const { data: dbPaths, isLoading, isError, error, refetch } = useExplainability();

  const latestPath = useMemo(() => {
    if (!dbPaths || dbPaths.length === 0) return null;
    return dbPaths[0];
  }, [dbPaths]);

  const factors = useMemo(() => {
    if (!latestPath || !latestPath.observations) return [];
    const obs = latestPath.observations;
    const items = [];
    
    if (obs.analysis_finding) {
      items.push({
        name: "Analysis Finding",
        displayValue: obs.analysis_finding,
        weight: obs.analysis_confidence ?? 0.95,
      });
    }
    if (obs.estimated_monthly_savings) {
      items.push({
        name: "Estimated Monthly Savings",
        displayValue: `$${obs.estimated_monthly_savings}/mo`,
        weight: obs.estimated_monthly_savings > 100 ? 0.9 : obs.estimated_monthly_savings / 120,
      });
    }
    if (obs.compliance_gate) {
      const gate = obs.compliance_gate;
      const desc = `Compliant: ${gate.compliant ? "Yes" : "No"}, Requires Approval: ${gate.requires_approval ? "Yes" : "No"}`;
      items.push({
        name: "Compliance Gate Status",
        displayValue: desc,
        weight: gate.compliant ? 0.95 : 0.25,
      });
    }
    
    Object.entries(obs).forEach(([key, val]) => {
      if (["analysis_finding", "analysis_confidence", "estimated_monthly_savings", "compliance_gate", "resource_id"].includes(key)) return;
      let weight = 0.5;
      if (typeof val === "number") {
        if (val <= 1) weight = val;
        else if (val <= 100) weight = val / 100;
        else weight = 0.85;
      }
      items.push({
        name: key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
        displayValue: typeof val === "object" ? JSON.stringify(val) : String(val),
        weight,
      });
    });
    
    return items;
  }, [latestPath]);

  if (isLoading) {
    return <LoadingState label="Loading agent causal reasoning pathways…" />;
  }

  if (isError) {
    return <ErrorState title="Reasoning Paths Fetch Failed" description={error?.message} onRetry={() => refetch()} />;
  }

  if (!latestPath) {
    return (
      <div className="space-y-6 animate-in-up">
        <div>
          <h2 className="font-display text-2xl font-semibold">Explainability</h2>
          <p className="text-sm text-muted-foreground">Why the Reasoner Agent selected its top hypothesis</p>
        </div>
        <EmptyState
          icon={HelpCircle}
          title="No Reasoning Paths Found"
          description="Reasoning path records will be generated once the agent begins evaluating resources."
        />
      </div>
    );
  }

  const confidence = latestPath.hypotheses[0]?.confidence ?? latestPath.hypotheses[0]?.confidence_score ?? 0;

  return (
    <div className="space-y-6 animate-in-up">
      <div>
        <h2 className="font-display text-2xl font-semibold">Explainability</h2>
        <p className="text-sm text-muted-foreground">Why the Reasoner Agent selected its top hypothesis</p>
      </div>

      <Card className="glass p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <Badge variant="outline" className="gap-1.5 border-primary/40 text-primary">
              <Sparkles className="h-3 w-3" /> Hypothesis #{latestPath.id.slice(0, 8)}
            </Badge>
            <h3 className="mt-3 font-display text-xl font-semibold break-words">
              {latestPath.hypotheses[0]?.hypothesis || "Evaluate cloud resource configuration"}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Recommended action: <span className="font-semibold text-primary uppercase">{latestPath.recommended_action}</span>
            </p>
            <div className="mt-4 border-t border-border/60 pt-4 text-sm text-foreground/90 leading-relaxed bg-muted/20 p-4 rounded-lg">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">Detailed Reasoning Explanation</span>
              {latestPath.hypotheses[0]?.evidence || "No telemetry evidence details registered."}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Confidence</p>
            <p className="font-display text-4xl font-semibold text-gradient">{Math.round(confidence * 100)}%</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="glass p-5">
          <h3 className="mb-4 font-display text-base font-semibold">Contributing Factors</h3>
          {factors.length === 0 ? (
            <p className="text-xs italic text-muted-foreground">No specific observations recorded.</p>
          ) : (
            <ul className="space-y-4">
              {factors.map((f) => (
                <li key={f.name} className="border-b border-border/30 pb-3 last:border-none last:pb-0">
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span className="truncate max-w-[70%] text-foreground" title={f.name}>{f.name}</span>
                    <span className="font-mono text-[11px] text-primary shrink-0">
                      Weight: {Math.round(f.weight * 100)}%
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground break-words mt-1 mb-2 leading-relaxed bg-muted/10 p-1.5 rounded font-mono border border-border/40">
                    {f.displayValue}
                  </div>
                  <Progress value={f.weight * 100} className="h-1" />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="glass p-5">
          <h3 className="mb-4 font-display text-base font-semibold">Model Provenance</h3>
          <dl className="space-y-3 text-sm">
            <Row label="Reasoner agent" value={latestPath.agent_name} />
            <Row label="Trigger event" value={latestPath.trigger_event} />
            <Row label="Policy check status" value={latestPath.policy_check_status} />
            <Row label="Target resource ID" value={latestPath.resource_id || "—"} />
          </dl>
        </Card>
      </div>
    </div>
  );
}

// helper row component
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/60 pb-2 last:border-none">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="text-right font-mono text-xs truncate max-w-[70%]" title={value}>{value}</dd>
    </div>
  );
}

