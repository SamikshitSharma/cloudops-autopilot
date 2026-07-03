import { topology } from "@/lib/mock";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/ui-ext/StatusPill";

const kindColor = (status: string) =>
  status === "healthy" ? "hsl(var(--success))" :
  status === "degraded" ? "hsl(var(--warning))" :
  status === "failing" ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))";

export default function Topology() {
  const nodeMap = new Map(topology.nodes.map((n) => [n.id, n]));
  return (
    <div className="space-y-6 animate-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold">Service Topology</h2>
          <p className="text-sm text-muted-foreground">Live dependency graph · anomalies propagate through the blast radius</p>
        </div>
        <Badge variant="outline">Live · 3s refresh</Badge>
      </div>

      <Card className="glass relative overflow-hidden p-4">
        <div className="grid-pattern absolute inset-0 opacity-30" aria-hidden />
        <svg viewBox="0 0 860 420" className="relative w-full">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="hsl(var(--primary))" opacity="0.7" />
            </marker>
            <linearGradient id="edge" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="hsl(var(--primary))" />
              <stop offset="100%" stopColor="hsl(var(--accent))" />
            </linearGradient>
          </defs>

          {topology.edges.map((e, i) => {
            const a = nodeMap.get(e.from)!;
            const b = nodeMap.get(e.to)!;
            return (
              <line
                key={i}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke="url(#edge)"
                strokeWidth={e.weight ?? 1.5}
                strokeDasharray="6 4"
                className="animate-flow"
                opacity={0.55}
                markerEnd="url(#arrow)"
              />
            );
          })}

          {topology.nodes.map((n) => (
            <g key={n.id} transform={`translate(${n.x}, ${n.y})`}>
              <circle r="26" fill="hsl(var(--card))" stroke={kindColor(n.status)} strokeWidth="2" />
              <circle r="30" fill="none" stroke={kindColor(n.status)} strokeWidth="1" opacity="0.3" />
              <text textAnchor="middle" y="4" fill="hsl(var(--foreground))" fontSize="10" fontFamily="Inter">
                {n.kind.toUpperCase()}
              </text>
              <text textAnchor="middle" y="52" fill="hsl(var(--muted-foreground))" fontSize="11" fontFamily="Inter">
                {n.label}
              </text>
            </g>
          ))}
        </svg>
      </Card>

      <Card className="glass p-4">
        <h3 className="mb-3 font-display text-sm font-semibold">Nodes</h3>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {topology.nodes.map((n) => (
            <div key={n.id} className="rounded-md border border-border bg-muted/20 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{n.label}</span>
                <StatusPill status={n.status} />
              </div>
              <p className="mt-1 font-mono text-[10px] uppercase text-muted-foreground">{n.kind}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
