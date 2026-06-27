import React, { useState } from "react";
import { 
  Network,
  Info, 
  MapPin, 
  Tag, 
  Cpu, 
  Database,
  Globe,
  Settings,
  Activity
} from "lucide-react";
import type { ResourceDTO } from "../api/client";

interface TopologyProps {
  resources: ResourceDTO[];
}

export function Topology({ resources }: TopologyProps) {
  const [selectedResource, setSelectedResource] = useState<ResourceDTO | null>(null);

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "running":
      case "active":
        return "hsl(var(--primary))"; // Indigo
      case "stopped":
      case "deallocated":
        return "hsl(var(--destructive))"; // Red
      case "unattached":
      case "detached":
      default:
        return "#f59e0b"; // Amber
    }
  };

  const activeNodes = [
    { id: "vm-idle-01", status: "stopped", x: 50, y: 100, label: "vm-idle-01", type: "Compute/VM" },
    { id: "vm-over-01", status: "running", x: 215, y: 100, label: "vm-over-01", type: "Compute/VM" },
    { id: "vm-busy-01", status: "running", x: 50, y: 190, label: "vm-busy-01", type: "Compute/VM" },
    { id: "vm-strict-01", status: "running", x: 215, y: 190, label: "vm-strict-01", type: "Compute/VM" },
    { id: "vm-dev-idle-01", status: "running", x: 405, y: 100, label: "vm-dev-idle-01", type: "Compute/VM" },
    { id: "disk-temp-01", status: "unattached", x: 560, y: 100, label: "disk-temp-01", type: "Compute/Disk" },
    { id: "vm-conflict-01", status: "running", x: 405, y: 250, label: "vm-conflict-01", type: "Compute/VM" },
    { id: "disk-staging-01", status: "unattached", x: 560, y: 250, label: "disk-staging-01", type: "Compute/Disk" }
  ];

  return (
    <div className="space-y-6">
      {/* Header Widget */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Infrastructure Topology</h2>
          <p className="text-sm text-muted-foreground mt-1">Live autonomous mapping of resource dependencies and telemetry flow.</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-primary font-mono bg-primary/10 px-3 py-1.5 rounded-md border border-primary/20">
          <Activity className="h-3.5 w-3.5 animate-pulse" />
          <span>REAL-TIME TELEMETRY ACTIVE</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Topology Canvas Container */}
        <div className="lg:col-span-3 glass-panel rounded-xl p-2 shadow-2xl flex justify-center items-center min-h-[500px] relative overflow-hidden group scanline-effect">
          
          <div className="absolute top-6 left-6 flex gap-4 text-[10px] text-muted-foreground font-mono font-medium">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" /> RUNNING</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-destructive" /> STOPPED</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#f59e0b]" /> ORPHANED</span>
          </div>

          <svg width="740" height="400" viewBox="0 0 740 400" className="w-full max-w-[740px]">
            {/* Background animated lines */}
            <g opacity="0.2">
              <path d="M 0 50 Q 370 0 740 50" fill="none" stroke="hsl(var(--primary))" strokeWidth="1" />
              <path d="M 0 100 Q 370 50 740 100" fill="none" stroke="hsl(var(--primary))" strokeWidth="1" />
              <path d="M 0 150 Q 370 100 740 150" fill="none" stroke="hsl(var(--primary))" strokeWidth="1" />
              <path d="M 0 200 Q 370 150 740 200" fill="none" stroke="hsl(var(--primary))" strokeWidth="1" />
              <path d="M 0 250 Q 370 200 740 250" fill="none" stroke="hsl(var(--primary))" strokeWidth="1" />
              <path d="M 0 300 Q 370 250 740 300" fill="none" stroke="hsl(var(--primary))" strokeWidth="1" />
              <path d="M 0 350 Q 370 300 740 350" fill="none" stroke="hsl(var(--primary))" strokeWidth="1" />
            </g>

            {/* Subscription Bound Box */}
            <rect x="10" y="10" width="720" height="380" rx="14" fill="none" stroke="hsl(var(--border))" strokeWidth="2" strokeDasharray="6 6" />
            <text x="30" y="32" className="text-[10px] font-bold fill-muted-foreground font-mono tracking-widest uppercase">Azure Tenant / SamikshitSharma</text>

            {/* rg-prod Container */}
            <g id="rg-prod">
              <rect x="30" y="60" width="340" height="300" rx="10" fill="hsl(var(--card))" fillOpacity="0.4" stroke="hsl(var(--border))" strokeWidth="1.5" />
              <text x="45" y="80" className="text-[10px] font-bold fill-primary font-mono tracking-wide uppercase">rg-prod (Production)</text>
              
              {/* Logical linking paths with animated telemetry flow */}
              <path d="M 185 132 L 215 132" stroke="hsl(var(--border))" strokeWidth="1.5" />
              <circle cx="185" cy="132" r="2" fill="hsl(var(--primary))">
                <animate attributeName="cx" from="185" to="215" dur="1.5s" repeatCount="indefinite" />
              </circle>
              
              <path d="M 185 222 L 215 222" stroke="hsl(var(--border))" strokeWidth="1.5" />
              <circle cx="185" cy="222" r="2" fill="hsl(var(--primary))">
                <animate attributeName="cx" from="185" to="215" dur="2s" repeatCount="indefinite" />
              </circle>
            </g>

            {/* rg-dev Container */}
            <g id="rg-dev">
              <rect x="390" y="60" width="320" height="140" rx="10" fill="hsl(var(--card))" fillOpacity="0.4" stroke="hsl(var(--border))" strokeWidth="1.5" />
              <text x="405" y="80" className="text-[10px] font-bold fill-primary font-mono tracking-wide uppercase">rg-dev (Development)</text>
              
              <path d="M 540 132 L 560 132" stroke="hsl(var(--border))" strokeWidth="1.5" strokeDasharray="4 4" />
            </g>

            {/* rg-staging Container */}
            <g id="rg-staging">
              <rect x="390" y="220" width="320" height="140" rx="10" fill="hsl(var(--card))" fillOpacity="0.4" stroke="hsl(var(--border))" strokeWidth="1.5" />
              <text x="405" y="240" className="text-[10px] font-bold fill-primary font-mono tracking-wide uppercase">rg-staging (Staging)</text>
              
              <path d="M 540 282 L 560 282" stroke="hsl(var(--border))" strokeWidth="1.5" strokeDasharray="4 4" />
            </g>

            {/* Render Nodes */}
            {activeNodes.map(node => {
              const isSelected = selectedResource?.id === node.id;
              return (
                <g 
                  key={node.id}
                  className="cursor-pointer group animate-float-pulse" 
                  style={{ animationDelay: `${Math.random()}s` }}
                  onClick={() => setSelectedResource(resources.find(r => r.id === node.id) || null)}
                  onMouseEnter={() => setSelectedResource(resources.find(r => r.id === node.id) || null)}
                >
                  <rect 
                    x={node.x} y={node.y} width="135" height="65" rx="8" 
                    fill="hsl(var(--background))" 
                    stroke={isSelected ? "hsl(var(--primary))" : "hsl(var(--border))"} 
                    strokeWidth={isSelected ? "2.5" : "1.5"} 
                    className="transition-all duration-300 shadow-xl" 
                  />
                  {isSelected && (
                    <rect x={node.x - 2} y={node.y - 2} width="139" height="69" rx="10" fill="none" stroke="hsl(var(--primary))" strokeWidth="1" strokeOpacity="0.5" className="animate-pulse-ring" />
                  )}
                  <text x={node.x + 12} y={node.y + 25} className="text-[11px] font-bold fill-foreground font-mono">{node.label}</text>
                  <text x={node.x + 12} y={node.y + 45} className="text-[9px] fill-muted-foreground font-mono">{node.type}</text>
                  
                  {/* Status Indicator */}
                  <circle cx={node.x + 115} cy={node.y + 32} r="5" fill={getStatusColor(node.status)} className={node.status !== 'unattached' ? "animate-pulse" : ""} />
                </g>
              );
            })}
          </svg>
        </div>

        {/* Selected Resource Inspector Drawer */}
        <div className="lg:col-span-1 bg-card border border-border rounded-xl shadow-lg flex flex-col overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-accent" />
          <div className="p-5 border-b border-border bg-muted/20">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary" />
              Inspector Pane
            </h3>
          </div>
          
          <div className="flex-1 p-5 overflow-y-auto">
            {selectedResource ? (
              <div className="space-y-6 animate-fadeIn">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary/10 rounded-lg text-primary border border-primary/20">
                    {selectedResource.type.includes("virtualMachine") ? <Cpu className="h-5 w-5" /> : <Database className="h-5 w-5" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground font-mono text-sm">{selectedResource.name}</h4>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{selectedResource.type}</p>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between text-xs p-2 rounded-md bg-muted/30 border border-border">
                    <span className="text-muted-foreground font-medium flex items-center gap-2"><Activity className="h-3.5 w-3.5"/> Status</span>
                    <span className="font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: getStatusColor(selectedResource.status) }}>
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: getStatusColor(selectedResource.status) }} />
                      {selectedResource.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs p-2 rounded-md bg-muted/30 border border-border">
                    <span className="text-muted-foreground font-medium flex items-center gap-2"><MapPin className="h-3.5 w-3.5"/> Region</span>
                    <span className="font-mono text-foreground">{selectedResource.region}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs p-2 rounded-md bg-muted/30 border border-border">
                    <span className="text-muted-foreground font-medium flex items-center gap-2"><Globe className="h-3.5 w-3.5"/> Provider</span>
                    <span className="font-mono text-foreground">Azure RM</span>
                  </div>
                </div>

                <div className="pt-2">
                  <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">Resource Tags</h4>
                  {Object.keys(selectedResource.tags).length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(selectedResource.tags).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-1.5 px-2 py-1 rounded bg-secondary border border-border text-[10px] text-foreground font-mono">
                          <Tag className="h-2.5 w-2.5 text-muted-foreground" />
                          <span className="text-muted-foreground">{key}:</span>
                          <span className="font-bold">{value}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No tags assigned</p>
                  )}
                </div>

                <div className="pt-2">
                  <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Live AI Telemetry</h4>
                  <div className="p-3 bg-black/50 border border-border rounded-md text-[10px] font-mono text-emerald-400 space-y-1">
                    <p>{">"} Ping successful: 14ms</p>
                    <p>{">"} Polling metrics (CPU/Mem)...</p>
                    <p>{">"} Cross-referencing FinOps policies...</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground space-y-3">
                <Info className="h-8 w-8 opacity-20" />
                <p className="text-sm">Hover or select a resource<br/>on the topology map.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
