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
  AlertCircle,
  Server
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
        return "text-success bg-success/15 border-success/30";
      case "stopped":
      case "deallocated":
      case "failed":
        return "text-danger bg-danger/15 border-danger/30";
      case "unattached":
      case "detached":
      default:
        return "text-warning bg-warning/15 border-warning/30";
    }
  };

  const getStatusHex = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "running":
      case "active":
        return "hsl(var(--success))";
      case "stopped":
      case "failed":
        return "hsl(var(--danger))";
      default:
        return "hsl(var(--warning))";
    }
  };

  // Group resources by Resource Group
  const resourceGroups = useMemo(() => {
    const groups: Record<string, ResourceDTO[]> = {};
    resources.forEach(res => {
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
    <div className="space-y-6 fade-in-up">
      
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h2 className="text-xl font-extrabold text-foreground uppercase">Infrastructure Topology Map</h2>
          <p className="text-xs text-muted-foreground mt-1">Live autonomous mapping of resource groups, asset dependencies, and telemetry status.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1 bg-card rounded border border-border">
            <span className="relative flex h-1.5 w-1.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${hasActiveRun ? 'bg-primary' : 'bg-muted-foreground'}`}></span>
              <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${hasActiveRun ? 'bg-primary' : 'bg-muted-foreground'}`}></span>
            </span>
            <span className="text-[9px] font-mono font-bold text-foreground uppercase">
              {hasActiveRun ? "Swarm telemetry active" : "Telemetry offline"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Canvas Area (3 columns) */}
        <div className="lg:col-span-3 bg-card border border-border rounded p-5 min-h-[500px] flex flex-col justify-between relative overflow-hidden bg-dot-pattern">
          
          {/* Status legend indicators */}
          <div className="flex gap-4 text-[9px] text-muted-foreground font-mono font-bold border-b border-border pb-3 mb-5 select-none">
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-success" /> RUNNING</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-danger" /> STOPPED</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-warning" /> UNATTACHED</span>
            <span className="flex items-center gap-1.5 ml-auto text-primary"><AlertCircle className="h-3 w-3" /> ACTION PENDING</span>
          </div>

          <div className="flex-grow space-y-6 overflow-y-auto custom-scrollbar max-h-[520px] pr-1">
            {Object.keys(resourceGroups).length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground font-mono text-xs">
                No active Azure resources discovered in tenant subscription.
              </div>
            ) : (
              Object.entries(resourceGroups).map(([rgName, rgResources]) => (
                <div key={rgName} className="relative p-5 rounded border border-border/85 bg-secondary/5 flex flex-col gap-3">
                  {/* Resource Group Badge */}
                  <div className="absolute -top-2.5 left-4 px-2 py-0.5 bg-card border border-border rounded text-[9px] font-mono font-extrabold text-primary uppercase tracking-wide">
                    Group: {rgName}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-1.5">
                    {rgResources.map(res => {
                      const isSelected = selectedResource?.id === res.id;
                      const hasRecommendation = recommendations.some(r => r.resource_id === res.id);
                      
                      return (
                        <div 
                          key={res.id}
                          className={`relative cursor-pointer transition-all duration-150 rounded p-3 flex flex-col justify-between h-[80px] bg-card border ${
                            isSelected ? 'border-primary ring-1 ring-primary/45 shadow-sm' : 'border-border/80 hover:border-primary/50'
                          }`}
                          onClick={() => setSelectedResource(res)}
                          onMouseEnter={() => setSelectedResource(res)}
                        >
                          <div className="flex items-start justify-between">
                            <span className="text-[10px] font-mono font-bold text-foreground truncate pr-2" title={res.name}>
                              {res.name}
                            </span>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {hasRecommendation && <AlertCircle className="h-3.5 w-3.5 text-warning animate-pulse" />}
                              <span 
                                className="h-2 w-2 rounded-full" 
                                style={{ backgroundColor: getStatusHex(res.status) }} 
                              />
                            </div>
                          </div>
                          
                          <span className="text-[8px] text-muted-foreground font-mono uppercase tracking-widest block truncate">
                            {res.type.split('/').pop()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Selected inspector panel (1 column) */}
        <div className="bg-card border border-border rounded p-5 flex flex-col justify-between shadow-sm min-h-[500px]">
          <div>
            <div className="flex items-center gap-2 mb-5 border-b border-border pb-3">
              <Settings className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Topology Inspector</h3>
            </div>

            {selectedResource ? (
              <div className="space-y-5 animate-fadeIn text-xs">
                
                {/* Header title */}
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-secondary/15 rounded border border-border text-primary">
                    {selectedResource.type.toLowerCase().includes("virtualmachine") ? <Cpu className="h-4.5 w-4.5" /> : <Server className="h-4.5 w-4.5" />}
                  </div>
                  <div className="overflow-hidden">
                    <h4 className="font-bold text-foreground font-mono text-xs truncate" title={selectedResource.name}>{selectedResource.name}</h4>
                    <p className="text-[8px] text-muted-foreground font-mono uppercase tracking-widest mt-0.5 truncate">{selectedResource.type.split('/').pop()}</p>
                  </div>
                </div>

                {/* Metrics items */}
                <div className="space-y-2 pt-1 font-mono text-[10px]">
                  <div className="flex items-center justify-between p-2 rounded bg-secondary/10 border border-border/80">
                    <span className="text-muted-foreground font-semibold flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" /> STATUS</span>
                    <span className={`font-bold uppercase tracking-wider flex items-center gap-1 px-1.5 py-0.5 rounded border ${getStatusColor(selectedResource.status)}`}>
                      {selectedResource.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded bg-secondary/10 border border-border/80">
                    <span className="text-muted-foreground font-semibold flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> REGION</span>
                    <span className="font-bold text-foreground">{selectedResource.region}</span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded bg-secondary/10 border border-border/80">
                    <span className="text-muted-foreground font-semibold flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> PROVIDER</span>
                    <span className="font-bold text-foreground truncate max-w-[110px]" title={selectedResource.provider_id}>
                      {selectedResource.provider_id.split('/')[1] || 'Azure RM'}
                    </span>
                  </div>
                </div>

                {/* Metadata Tags */}
                <div className="space-y-1.5">
                  <span className="text-[8px] text-muted-foreground uppercase block font-bold font-mono">Resource Metadata Tags</span>
                  {selectedResource.tags && Object.keys(selectedResource.tags).length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(selectedResource.tags).map(([key, value]) => (
                        <span key={key} className="inline-flex items-center gap-0.5 text-[8.5px] px-1.5 py-0.5 rounded bg-secondary/20 text-slate-300 border border-border font-mono">
                          <Tag className="h-2 w-2 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">{key}:</span>
                          <span className="font-bold">{value as string}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted-foreground italic font-mono">No metadata tags assigned.</p>
                  )}
                </div>

                {/* Diagnostics logs */}
                <div className="space-y-1.5">
                  <span className="text-[8px] text-muted-foreground uppercase block font-bold font-mono">Real-time Node Telemetry</span>
                  <div className="p-2.5 bg-black/95 rounded border border-border/60 font-mono text-[9px] text-emerald-400 space-y-1 shadow-inner scanline-effect relative">
                    {hasActiveRun ? (
                      <>
                        <p>{">"} Sweeping metric points...</p>
                        <p className="animate-pulse">{">"} Enforcing policy limits...</p>
                      </>
                    ) : recommendations.some(r => r.resource_id === selectedResource.id) ? (
                      <>
                        <p className="text-warning">{">"} Recommendation pending signature.</p>
                        <p className="text-warning">{">"} Gate sequence locked.</p>
                      </>
                    ) : (
                      <>
                        <p>{">"} Resource status: stable.</p>
                        <p>{">"} Telemetry monitoring active.</p>
                      </>
                    )}
                  </div>
                </div>

              </div>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center text-center text-muted-foreground space-y-2 select-none">
                <Network className="h-8 w-8 opacity-20" />
                <p className="text-xs font-bold uppercase">No target selected</p>
                <p className="text-[9px] text-muted-foreground leading-normal max-w-[140px] mx-auto">Hover or click on any node inside the topology groups canvas.</p>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-border text-[8px] text-muted-foreground font-mono leading-relaxed mt-4">
            Tenant topology matches active subscription resource bindings.
          </div>
        </div>

      </div>
    </div>
  );
}
