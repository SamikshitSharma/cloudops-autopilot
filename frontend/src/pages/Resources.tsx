import { useMemo, useState } from "react";
import { resources } from "@/lib/mock";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui-ext/StatusPill";
import { EmptyState } from "@/components/ui-ext/StateViews";
import { Search, Boxes, Download } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";

const providerLabel: Record<string, string> = { aws: "AWS", azure: "Azure", gcp: "GCP" };

export default function Resources() {
  const [q, setQ] = useState("");
  const [provider, setProvider] = useState<string>("all");
  const filtered = useMemo(() => resources.filter((r) =>
    (provider === "all" || r.provider === provider) &&
    (r.name.toLowerCase().includes(q.toLowerCase()) || r.type.toLowerCase().includes(q.toLowerCase()))
  ), [q, provider]);

  return (
    <div className="space-y-6 animate-in-up">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold">Resource Inventory</h2>
          <p className="text-sm text-muted-foreground">Unified view across cloud accounts — {resources.length.toLocaleString()} resources tracked</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2"><Download className="h-4 w-4" /> Export</Button>
        </div>
      </div>

      <Card className="glass p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or type…" className="pl-9" />
          </div>
          <div className="flex gap-1 rounded-md border border-border bg-muted/30 p-1">
            {(["all", "aws", "azure", "gcp"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setProvider(p)}
                className={`rounded px-3 py-1 text-xs font-medium capitalize transition ${
                  provider === p ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p === "all" ? "All clouds" : providerLabel[p]}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="glass overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={Boxes} title="No resources match" description="Try clearing your filters or broadening the search." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Cloud</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Utilization</TableHead>
                <TableHead className="text-right">Cost / mo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id} className="cursor-pointer">
                  <TableCell>
                    <div className="font-medium">{r.name}</div>
                    <div className="flex gap-1 pt-1">
                      {r.tags.map((t) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.type}</TableCell>
                  <TableCell>{providerLabel[r.provider]}</TableCell>
                  <TableCell className="font-mono text-xs">{r.region}</TableCell>
                  <TableCell><StatusPill status={r.status} /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={r.utilization} className="h-1.5 w-24" />
                      <span className="font-mono text-xs text-muted-foreground">{r.utilization}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">${r.cost.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
