import React, { useState } from "react";
import { 
  Database, 
  MapPin, 
  Tag, 
  Info, 
  Cpu, 
  Layers 
} from "lucide-react";
import type { ResourceDTO } from "../api/client";

interface InventoryProps {
  resources: ResourceDTO[];
}

export function Inventory({ resources }: InventoryProps) {
  const [selectedResource, setSelectedResource] = useState<ResourceDTO | null>(null);

  // Group resources by Resource Group parsed from provider_id
  const parseResourceGroup = (providerId: string): string => {
    const match = providerId.match(/\/resourceGroups\/([^/]+)/i);
    return match ? match[1] : "default-rg";
  };

  const groupedByRg = resources.reduce((acc, r) => {
    const rg = parseResourceGroup(r.provider_id);
    if (!acc[rg]) {
      acc[rg] = [];
    }
    acc[rg].push(r);
    return acc;
  }, {} as Record<string, ResourceDTO[]>);

  return (
    <div className="space-y-8">
      
      {/* 1. Interactive SVG Azure Topology Visualizer */}
      <div className="p-6 bg-card border border-border rounded-xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <h3 className="font-heading font-semibold text-base">Azure Cloud Subscription Topology Map</h3>
          </div>
          <span className="text-xs text-muted font-mono">HOVER NODES TO INSPECT CONFIG</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Topology Canvas */}
          <div className="lg:col-span-3 border border-border/60 rounded-xl bg-slate-950/40 p-4 overflow-auto flex justify-center items-center min-h-[400px]">
            <svg width="680" height="360" viewBox="0 0 680 360" className="w-full max-w-[680px]">
              
              {/* Subscription Outer Border */}
              <rect x="10" y="10" width="660" height="340" rx="12" fill="none" stroke="var(--border)" strokeWidth="1.5" strokeDasharray="4 4" />
              <text x="30" y="32" className="text-[10px] font-bold fill-slate-400 font-mono">SUBSCRIPTION / CLOUDOPS-DEMO-SUB</text>

              {/* Resource Group 1: rg-prod (Primary workload) */}
              <g id="rg-prod">
                <rect x="30" y="60" width="320" height="260" rx="8" fill="var(--card)" fillOpacity="0.03" stroke="var(--border)" strokeWidth="1" />
                <text x="45" y="80" className="text-xs font-bold fill-foreground/70 font-sans">rg-prod (Production)</text>
                
                {/* vm-idle-01 */}
                <g className="cursor-pointer" onClick={() => setSelectedResource(resources.find(r => r.id === "vm-idle-01") || null)}
                   onMouseEnter={() => setSelectedResource(resources.find(r => r.id === "vm-idle-01") || null)}>
                  <rect x="50" y="100" width="130" height="60" rx="6" fill="var(--card)" stroke={selectedResource?.id === "vm-idle-01" ? "var(--primary)" : "var(--border)"} strokeWidth={selectedResource?.id === "vm-idle-01" ? "2" : "1"} />
                  <text x="62" y="125" className="text-[11px] font-semibold fill-foreground">vm-idle-01</text>
                  <text x="62" y="142" className="text-[9px] fill-slate-400">Microsoft.Compute/VM</text>
                  <circle cx="162" cy="130" r="4" fill="#ef4444" /> {/* Stopped indicator */}
                </g>

                {/* vm-over-01 */}
                <g className="cursor-pointer" onClick={() => setSelectedResource(resources.find(r => r.id === "vm-over-01") || null)}
                   onMouseEnter={() => setSelectedResource(resources.find(r => r.id === "vm-over-01") || null)}>
                  <rect x="200" y="100" width="130" height="60" rx="6" fill="var(--card)" stroke={selectedResource?.id === "vm-over-01" ? "var(--primary)" : "var(--border)"} strokeWidth={selectedResource?.id === "vm-over-01" ? "2" : "1"} />
                  <text x="212" y="125" className="text-[11px] font-semibold fill-foreground">vm-over-01</text>
                  <text x="212" y="142" className="text-[9px] fill-slate-400">Microsoft.Compute/VM</text>
                  <circle cx="312" cy="130" r="4" fill="#10b981" /> {/* Running indicator */}
                </g>

                {/* vm-busy-01 */}
                <g className="cursor-pointer" onClick={() => setSelectedResource(resources.find(r => r.id === "vm-busy-01") || null)}
                   onMouseEnter={() => setSelectedResource(resources.find(r => r.id === "vm-busy-01") || null)}>
                  <rect x="50" y="180" width="130" height="60" rx="6" fill="var(--card)" stroke={selectedResource?.id === "vm-busy-01" ? "var(--primary)" : "var(--border)"} strokeWidth={selectedResource?.id === "vm-busy-01" ? "2" : "1"} />
                  <text x="62" y="205" className="text-[11px] font-semibold fill-foreground">vm-busy-01</text>
                  <text x="62" y="222" className="text-[9px] fill-slate-400">Microsoft.Compute/VM</text>
                  <circle cx="162" cy="210" r="4" fill="#10b981" />
                </g>

                {/* vm-strict-01 */}
                <g className="cursor-pointer" onClick={() => setSelectedResource(resources.find(r => r.id === "vm-strict-01") || null)}
                   onMouseEnter={() => setSelectedResource(resources.find(r => r.id === "vm-strict-01") || null)}>
                  <rect x="200" y="180" width="130" height="60" rx="6" fill="var(--card)" stroke={selectedResource?.id === "vm-strict-01" ? "var(--primary)" : "var(--border)"} strokeWidth={selectedResource?.id === "vm-strict-01" ? "2" : "1"} />
                  <text x="212" y="205" className="text-[11px] font-semibold fill-foreground">vm-strict-01</text>
                  <text x="212" y="222" className="text-[9px] fill-slate-400">Microsoft.Compute/VM</text>
                  <circle cx="312" cy="210" r="4" fill="#10b981" />
                </g>
              </g>

              {/* Resource Group 2: rg-dev (Developer playground) */}
              <g id="rg-dev">
                <rect x="370" y="60" width="280" height="120" rx="8" fill="var(--card)" fillOpacity="0.03" stroke="var(--border)" strokeWidth="1" />
                <text x="385" y="80" className="text-xs font-bold fill-foreground/70 font-sans">rg-dev (Development)</text>
                
                {/* vm-dev-idle-01 */}
                <g className="cursor-pointer" onClick={() => setSelectedResource(resources.find(r => r.id === "vm-dev-idle-01") || null)}
                   onMouseEnter={() => setSelectedResource(resources.find(r => r.id === "vm-dev-idle-01") || null)}>
                  <rect x="385" y="100" width="115" height="60" rx="6" fill="var(--card)" stroke={selectedResource?.id === "vm-dev-idle-01" ? "var(--primary)" : "var(--border)"} strokeWidth={selectedResource?.id === "vm-dev-idle-01" ? "2" : "1"} />
                  <text x="395" y="125" className="text-[11px] font-semibold fill-foreground">vm-dev-idle-01</text>
                  <text x="395" y="142" className="text-[9px] fill-slate-400">Microsoft.Compute/VM</text>
                  <circle cx="485" cy="130" r="4" fill="#10b981" />
                </g>

                {/* disk-temp-01 */}
                <g className="cursor-pointer" onClick={() => setSelectedResource(resources.find(r => r.id === "disk-temp-01") || null)}
                   onMouseEnter={() => setSelectedResource(resources.find(r => r.id === "disk-temp-01") || null)}>
                  <rect x="515" y="100" width="115" height="60" rx="6" fill="var(--card)" stroke={selectedResource?.id === "disk-temp-01" ? "var(--primary)" : "var(--border)"} strokeWidth={selectedResource?.id === "disk-temp-01" ? "2" : "1"} />
                  <text x="525" y="125" className="text-[11px] font-semibold fill-foreground">disk-temp-01</text>
                  <text x="525" y="142" className="text-[9px] fill-slate-400">Microsoft.Compute/Disk</text>
                  <circle cx="615" cy="130" r="4" fill="#f59e0b" /> {/* Warning/Unattached */}
                </g>
              </g>

              {/* Resource Group 3: rg-staging (Escalation sandbox) */}
              <g id="rg-staging">
                <rect x="370" y="200" width="280" height="120" rx="8" fill="var(--card)" fillOpacity="0.03" stroke="var(--border)" strokeWidth="1" />
                <text x="385" y="220" className="text-xs font-bold fill-foreground/70 font-sans">rg-staging (Staging/Escalated)</text>

                {/* vm-conflict-01 */}
                <g className="cursor-pointer" onClick={() => setSelectedResource(resources.find(r => r.id === "vm-conflict-01") || null)}
                   onMouseEnter={() => setSelectedResource(resources.find(r => r.id === "vm-conflict-01") || null)}>
                  <rect x="385" y="240" width="115" height="60" rx="6" fill="var(--card)" stroke={selectedResource?.id === "vm-conflict-01" ? "var(--primary)" : "var(--border)"} strokeWidth={selectedResource?.id === "vm-conflict-01" ? "2" : "1"} />
                  <text x="395" y="265" className="text-[11px] font-semibold fill-foreground">vm-conflict-01</text>
                  <text x="395" y="282" className="text-[9px] fill-slate-400">Microsoft.Compute/VM</text>
                  <circle cx="485" cy="270" r="4" fill="#ef4444" />
                </g>

                {/* vm-prod-active-02 */}
                <g className="cursor-pointer" onClick={() => setSelectedResource(resources.find(r => r.id === "vm-prod-active-02") || null)}
                   onMouseEnter={() => setSelectedResource(resources.find(r => r.id === "vm-prod-active-02") || null)}>
                  <rect x="515" y="240" width="115" height="60" rx="6" fill="var(--card)" stroke={selectedResource?.id === "vm-prod-active-02" ? "var(--primary)" : "var(--border)"} strokeWidth={selectedResource?.id === "vm-prod-active-02" ? "2" : "1"} />
                  <text x="525" y="265" className="text-[11px] font-semibold fill-foreground">vm-prod-active-02</text>
                  <text x="525" y="282" className="text-[9px] fill-slate-400">Microsoft.Compute/VM</text>
                  <circle cx="615" cy="270" r="4" fill="#10b981" />
                </g>
              </g>
            </svg>
          </div>

          {/* Node Inspector Details Panel */}
          <div className="p-6 border border-border bg-card/40 rounded-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4 border-b border-border pb-3">
                <Info className="h-5 w-5 text-primary" />
                <h4 className="font-heading font-semibold text-sm">Resource Inspector</h4>
              </div>

              {selectedResource ? (
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-muted block">Resource Name</span>
                    <span className="text-sm font-bold text-foreground font-mono">{selectedResource.name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-muted block">Provider Type</span>
                    <span className="text-xs text-foreground truncate block font-mono">{selectedResource.type}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-muted block">Operational Status</span>
                    <span className={`inline-block px-2 py-0.5 mt-1 rounded text-[10px] uppercase font-bold ${
                      selectedResource.status === "Running"
                        ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                        : selectedResource.status === "Stopped"
                          ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                          : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                    }`}>{selectedResource.status}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-border/50">
                    <span className="flex items-center gap-1 text-muted">
                      <MapPin className="h-3.5 w-3.5" /> {selectedResource.region}
                    </span>
                    <span className="text-muted font-mono">{selectedResource.last_seen ? "Last Seen: Today" : ""}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-muted block mb-1">Tags</span>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(selectedResource.tags).map(([k, v]) => (
                        <span key={k} className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground border border-border/50">
                          <Tag className="h-2 w-2" /> {k}: {v}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted italic text-center py-10">Select or hover a topology node to view configuration details.</p>
              )}
            </div>
            
            <div className="pt-4 border-t border-border/40 text-[10px] text-muted-foreground">
              Topology map reflects resources grouped by mock Resource Group namespaces.
            </div>
          </div>
        </div>
      </div>

      {/* 2. Structured Resources Grid Table */}
      <div className="p-6 bg-card border border-border rounded-xl">
        <div className="flex items-center gap-2 mb-4">
          <Database className="h-5 w-5 text-primary" />
          <h3 className="font-heading font-semibold text-base">Discovered Asset Inventory</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border text-muted uppercase font-bold text-[10px] tracking-wider">
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Region</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Tags</th>
                <th className="py-3 px-4">Last Synced</th>
              </tr>
            </thead>
            <tbody>
              {resources.map((res) => (
                <tr key={res.id} className="border-b border-border hover:bg-muted/10 transition-all">
                  <td className="py-3.5 px-4 font-mono font-bold text-foreground">{res.name}</td>
                  <td className="py-3.5 px-4 text-muted-foreground font-mono">{res.type}</td>
                  <td className="py-3.5 px-4 text-muted-foreground">{res.region}</td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                      res.status === "Running"
                        ? "bg-emerald-500/10 text-emerald-500"
                        : res.status === "Stopped"
                          ? "bg-rose-500/10 text-rose-500"
                          : "bg-amber-500/10 text-amber-500"
                    }`}>
                      {res.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(res.tags).map(([k, v]) => (
                        <span key={k} className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/20">
                          {k}={v}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-400 font-mono">
                    {new Date(res.last_seen).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
