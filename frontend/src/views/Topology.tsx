import React, { useState, useMemo } from "react";
import { 
  Network,
  Info, 
  MapPin, 
  Tag, 
  Cpu, 
  Database,
  Globe,
  Settings,
  Activity,
  AlertCircle
} from "lucide-react";
import type { ResourceDTO, RecommendationDTO, RunDetailsDTO } from "../api/client";

interface TopologyProps {
  resources: ResourceDTO[];
  recommendations?: RecommendationDTO[];
  activeRunDetails?: RunDetailsDTO | null;
}

export function Topology({ resources, recommendations = [], activeRunDetails }: TopologyProps) {
  const [selectedResource, setSelectedResource] = useState<ResourceDTO | null>(null);

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "running":
      case "active":
      case "succeeded":
        return "hsl(var(--primary))"; // Indigo
      case "stopped":
      case "deallocated":
      case "failed":
        return "hsl(var(--destructive))"; // Red
      case "unattached":
      case "detached":
      default:
        return "#f59e0b"; // Amber
    }
  };

  // 1. Group resources by Resource Group based on Azure provider_id
  const resourceGroups = useMemo(() => {
    const groups: Record<string, ResourceDTO[]> = {};
    resources.forEach(res => {
      // Azure IDs typically look like: /subscriptions/{id}/resourceGroups/{rg}/providers/...
      const match = res.provider_id.match(/resourceGroups\/([^\/]+)/i);
      const rgName = match ? match[1].toLowerCase() : "unassigned";
      
      if (!groups[rgName]) {
        groups[rgName] = [];
      }
      groups[rgName].push(res);
    });
    return groups;
  }, [resources]);

  const hasActiveRun = activeRunDetails?.db_record?.status === "running";

  return (
    <div className="space-y-6">
      {/* Header Widget */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Infrastructure Topology</h2>
          <p className="text-sm text-muted-foreground mt-1">Live autonomous mapping of resource dependencies and telemetry flow.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md border border-border">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${hasActiveRun ? 'bg-emerald-400' : 'bg-muted-foreground'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${hasActiveRun ? 'bg-emerald-500' : 'bg-muted-foreground'}`}></span>
            </span>
            <span className="text-[11px] font-mono font-medium text-foreground uppercase tracking-wider">
              {hasActiveRun ? "REAL-TIME TELEMETRY ACTIVE" : "MONITORING IDLE"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Topology Canvas Container */}
        <div className="lg:col-span-3 glass-panel rounded-xl p-6 shadow-2xl flex flex-col gap-8 min-h-[500px] relative overflow-hidden group scanline-effect bg-black/40">
          
          <div className="flex gap-4 text-[10px] text-muted-foreground font-mono font-medium border-b border-border/50 pb-4">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" /> RUNNING</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-destructive" /> STOPPED/FAILED</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#f59e0b]" /> UNATTACHED/OTHER</span>
            <span className="flex items-center gap-1.5 ml-4"><AlertCircle className="h-3 w-3 text-amber-400" /> INSIGHT AVAILABLE</span>
          </div>

          <div className="flex-1 overflow-auto space-y-8">
            {Object.keys(resourceGroups).length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground font-mono text-sm">
                No resources discovered in Azure tenant.
              </div>
            ) : (
              Object.entries(resourceGroups).map(([rgName, rgResources]) => (
                <div key={rgName} className="relative p-6 rounded-xl border-2 border-border/50 bg-card/20 flex flex-col gap-4">
                  <div className="absolute -top-3 left-4 px-2 py-0.5 bg-background border-2 border-border/50 rounded-md text-[10px] font-bold text-primary font-mono tracking-wide uppercase shadow-sm">
                    RG: {rgName}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-2">
                    {rgResources.map(res => {
                      const isSelected = selectedResource?.id === res.id;
                      const hasRecommendation = recommendations.some(r => r.resource_id === res.id);
                      // If the active run details specifically targets this resource or if there's a global run, pulse it.
                      const isTargeted = hasActiveRun; 
                      
                      return (
                        <div 
                          key={res.id}
                          className={`relative cursor-pointer transition-all duration-300 rounded-lg p-3 flex flex-col justify-between h-[80px] shadow-sm bg-background/80 border ${isSelected ? 'border-primary shadow-primary/20 scale-105 z-10' : 'border-border hover:border-primary/50'}`}
                          onClick={() => setSelectedResource(res)}
                          onMouseEnter={() => setSelectedResource(res)}
                        >
                          {/* Inner pulse if targeted by active run */}
                          {isTargeted && !isSelected && (
                            <div className="absolute inset-0 rounded-lg border border-primary opacity-20 animate-pulse-ring pointer-events-none" />
                          )}
                          
                          <div className="flex items-start justify-between">
                            <span className="text-[11px] font-bold text-foreground font-mono truncate pr-2" title={res.name}>
                              {res.name}
                            </span>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {hasRecommendation && <AlertCircle className="h-3.5 w-3.5 text-amber-400 animate-pulse" />}
                              <span 
                                className={`h-2.5 w-2.5 rounded-full ${isTargeted && res.status !== 'unattached' ? 'animate-pulse' : ''}`} 
                                style={{ backgroundColor: getStatusColor(res.status) }} 
                                title={res.status}
                              />
                            </div>
                          </div>
                          <span className="text-[9px] text-muted-foreground font-mono truncate uppercase tracking-wider">{res.type.split('/').pop()}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Selected Resource Inspector Drawer */}
        <div className="lg:col-span-1 bg-card border border-border rounded-xl shadow-lg flex flex-col overflow-hidden relative min-h-[500px]">
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
                    {selectedResource.type.toLowerCase().includes("virtualmachine") ? <Cpu className="h-5 w-5" /> : <Database className="h-5 w-5" />}
                  </div>
                  <div className="overflow-hidden">
                    <h4 className="font-bold text-foreground font-mono text-sm truncate" title={selectedResource.name}>{selectedResource.name}</h4>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest truncate">{selectedResource.type.split('/').pop()}</p>
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
                    <span className="font-mono text-foreground">{selectedResource.region || 'global'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs p-2 rounded-md bg-muted/30 border border-border">
                    <span className="text-muted-foreground font-medium flex items-center gap-2"><Globe className="h-3.5 w-3.5"/> Provider</span>
                    <span className="font-mono text-foreground truncate max-w-[120px]" title={selectedResource.provider_id}>
                      {selectedResource.provider_id.split('/')[1] || 'Azure RM'}
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                  <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">Resource Tags</h4>
                  {selectedResource.tags && Object.keys(selectedResource.tags).length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(selectedResource.tags).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-1.5 px-2 py-1 rounded bg-secondary border border-border text-[10px] text-foreground font-mono max-w-full">
                          <Tag className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground truncate">{key}:</span>
                          <span className="font-bold truncate">{value as string}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No tags assigned</p>
                  )}
                </div>

                <div className="pt-2">
                  <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Live AI Telemetry</h4>
                  {hasActiveRun ? (
                    <div className="p-3 bg-black/50 border border-border rounded-md text-[10px] font-mono text-emerald-400 space-y-1">
                      <p>{">"} Interrogating Azure Metrics...</p>
                      <p>{">"} Cross-referencing FinOps policies...</p>
                      <p className="animate-pulse">{">"} Awaiting orchestrator agent...</p>
                    </div>
                  ) : recommendations.some(r => r.resource_id === selectedResource.id) ? (
                    <div className="p-3 bg-black/50 border border-border rounded-md text-[10px] font-mono text-amber-400 space-y-1">
                      <p>{">"} Recommendation pending execution.</p>
                      <p>{">"} Risk profile computed.</p>
                      <p>{">"} Awaiting operator signature...</p>
                    </div>
                  ) : (
                    <div className="p-3 bg-black/50 border border-border rounded-md text-[10px] font-mono text-muted-foreground space-y-1">
                      <p>{">"} Resource is compliant.</p>
                      <p>{">"} Telemetry monitoring idle.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground space-y-3">
                <Network className="h-8 w-8 opacity-20" />
                <p className="text-sm">Hover or select a resource<br/>on the topology map.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
