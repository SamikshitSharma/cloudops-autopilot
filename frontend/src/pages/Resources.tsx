import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui-ext/StatusPill";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui-ext/StateViews";
import { Search, Boxes, Download } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useResources } from "@/hooks/useResources";
import { toast } from "sonner";
import type { Status } from "@/lib/types";

const mapStatus = (status: string): Status => {
  const s = status.toLowerCase();
  if (s.startsWith("run") || s.startsWith("avail")) return "healthy";
  if (s.startsWith("stop")) return "degraded";
  if (s.startsWith("fail")) return "failing";
  return "unknown";
};

export default function Resources() {
  const [q, setQ] = useState("");
  const { data: dbResources, isLoading, isError, error, refetch } = useResources(q);
  const [selectedId, setSelectedId] = useState<string | null>(localStorage.getItem("last_selected_resource_id"));

  const resources = useMemo(() => {
    if (!dbResources) return [];
    return dbResources.map((r): any => ({
      id: r.id,
      name: r.name,
      type: r.type,
      provider: "azure",
      region: r.region,
      status: mapStatus(r.status),
      cost: r.monthly_cost ?? null,
      utilization: r.utilization ?? null,
      tags: Object.entries(r.tags).map(([k, v]) => `${k}:${v}`),
      cpu_utilization: r.cpu_utilization ?? null,
      memory_utilization: r.memory_utilization ?? null,
      disk_utilization: r.disk_utilization ?? null,
      network_utilization: r.network_utilization ?? null,
      telemetry_explanation: r.telemetry_explanation ?? null,
      metric_source: r.metric_source ?? null,
      cost_explanation: r.cost_explanation ?? null,
    }));
  }, [dbResources]);

  const handleExport = (format: "csv" | "json") => {
    const link = document.createElement("a");
    const url = `/api/v1/resources/export?format=${format}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
    link.href = url;
    link.setAttribute("download", `resources_export_${Date.now()}.${format}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exporting resource inventory as ${format.toUpperCase()}...`);
  };

  const handleSelectResource = (rId: string) => {
    localStorage.setItem("last_selected_resource_id", rId);
    setSelectedId(rId);
    toast.info(`Active resource context set to: ${rId}`);
  };

  if (isLoading) {
    return <LoadingState label="Loading cloud resource inventory…" />;
  }

  if (isError) {
    return <ErrorState title="Inventory Fetch Failed" description={error?.message} onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-6 animate-in-up">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold">Resource Inventory</h2>
          <p className="text-sm text-muted-foreground">Azure cloud resources — {resources.length.toLocaleString()} resources tracked</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport("csv")} className="gap-2"><Download className="h-4 w-4" /> Export CSV</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("json")} className="gap-2"><Download className="h-4 w-4" /> Export JSON</Button>
        </div>
      </div>

      <Card className="glass p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or type…" className="pl-9" />
          </div>
        </div>
      </Card>

      <Card className="glass overflow-hidden">
        {resources.length === 0 ? (
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
              {resources.map((r) => (
                <TableRow 
                  key={r.id} 
                  onClick={() => handleSelectResource(r.id)}
                  className={`cursor-pointer transition-all duration-150 ${selectedId === r.id ? "bg-primary/10 hover:bg-primary/15 border-l-2 border-primary" : "hover:bg-muted/40"}`}
                >
                  <TableCell>
                    <div className="font-medium">{r.name}</div>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {r.tags.map((t) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.type}</TableCell>
                  <TableCell>Azure</TableCell>
                  <TableCell className="font-mono text-xs">{r.region}</TableCell>
                  <TableCell><StatusPill status={r.status} /></TableCell>
                  <TableCell>
                    {r.cpu_utilization !== null ? (
                      <div className="space-y-1.5 py-1 max-w-[200px]" onClick={(e) => e.stopPropagation()}>
                        {r.metric_source && <div className="text-[10px] text-muted-foreground">Source: {r.metric_source}</div>}
                        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground leading-none">
                          <span>CPU</span>
                          <span className="font-semibold">{r.cpu_utilization}%</span>
                        </div>
                        <Progress value={r.cpu_utilization} className="h-1" />
                        
                        {r.memory_utilization !== null && (
                          <>
                            <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground leading-none">
                              <span>MEM</span>
                              <span className="font-semibold">{r.memory_utilization}%</span>
                            </div>
                            <Progress value={r.memory_utilization} className="h-1 bg-muted/20" />
                          </>
                        )}
                        {r.disk_utilization !== null && (
                          <>
                            <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground leading-none">
                              <span>DISK</span>
                              <span className="font-semibold">{r.disk_utilization}%</span>
                            </div>
                            <Progress value={r.disk_utilization} className="h-1 bg-muted/20" />
                          </>
                        )}
                        {r.network_utilization !== null && (
                          <>
                            <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground leading-none">
                              <span>NET</span>
                              <span className="font-semibold">{r.network_utilization}%</span>
                            </div>
                            <Progress value={r.network_utilization} className="h-1 bg-muted/20" />
                          </>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground/80 italic leading-relaxed block max-w-[180px]">
                        {r.telemetry_explanation || "Telemetry unavailable"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {r.cost !== null && r.cost !== undefined ? (
                      `$${r.cost.toLocaleString()}`
                    ) : (
                      <span className="text-[11px] text-muted-foreground whitespace-normal block max-w-[180px] ml-auto">
                        {r.cost_explanation || "Cost unavailable"}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
