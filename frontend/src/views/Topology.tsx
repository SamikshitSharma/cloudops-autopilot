import React, { useState, useMemo } from "react";
import { 
  Network,
  Cpu, 
  Database,
  Server,
  Zap,
  Tag,
  MapPin
} from "lucide-react";
import type { ResourceDTO, RecommendationDTO, RunDetailsDTO } from "../api/client";

interface TopologyProps {
  resources: ResourceDTO[];
  recommendations?: RecommendationDTO[];
  activeRunDetails?: RunDetailsDTO | null;
}

export function Topology({ resources, recommendations = [], activeRunDetails }: TopologyProps) {
  const [selectedResource, setSelectedResource] = useState<ResourceDTO | null>(null);
  
  // Dynamic schematic grid zoom/pan coordinates state variables
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // 1. Group resources by Resource Group
  const resourceGroups = useMemo(() => {
    const groups: Record<string, ResourceDTO[]> = {};
    resources.forEach(res => {
      const match = res.provider_id.match(/resourceGroups\/([^\/]+)/i);
      const rgName = match ? match[1] : "unassigned";
      if (!groups[rgName]) {
        groups[rgName] = [];
      }
      groups[rgName].push(res);
    });
    return groups;
  }, [resources]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag when clicking the canvas backdrop
    if ((e.target as HTMLElement).tagName === "svg" || (e.target as HTMLElement).id === "canvas-grid") {
      setIsDragging(true);
      setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoom = (direction: "in" | "out") => {
    setZoomLevel(prev => {
      if (direction === "in") return Math.min(prev + 0.1, 1.5);
      return Math.max(prev - 0.1, 0.5);
    });
  };

  return (
    <div className="space-y-6 font-mono text-[11px] leading-relaxed text-muted-foreground fade-in-up">
      
      {/* Header index */}
      <div className="pb-4 border-b border-border flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-foreground tracking-tight font-sans">topology.schema</h2>
          <p className="text-[10px] text-muted-foreground mt-1 uppercase font-semibold">Workspace Infrastructure Coordinate Schematic</p>
        </div>
        
        {/* Schematic Controls */}
        <div className="flex gap-2">
          <button 
            onClick={() => handleZoom("out")}
            className="px-2 py-1 border border-border bg-card hover:bg-secondary/40 text-foreground rounded shadow-elevation-1"
          >
            Zoom Out
          </button>
          <span className="px-2 py-1 text-foreground font-semibold bg-secondary/35 rounded flex items-center">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button 
            onClick={() => handleZoom("in")}
            className="px-2 py-1 border border-border bg-card hover:bg-secondary/40 text-foreground rounded shadow-elevation-1"
          >
            Zoom In
          </button>
          <button 
            onClick={() => { setZoomLevel(1); setPanOffset({ x: 0, y: 0 }); }}
            className="px-2 py-1 border border-border bg-card hover:bg-secondary/40 text-foreground rounded shadow-elevation-1"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Infinite Canvas Simulation */}
      <div 
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className={`h-[400px] border border-border rounded-lg bg-card/20 bg-grid-pattern relative overflow-hidden select-none shadow-elevation-1 cursor-grab ${isDragging ? "cursor-grabbing" : ""}`}
      >
        <div 
          id="canvas-grid"
          className="absolute inset-0 transition-transform duration-75"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
            transformOrigin: "center center"
          }}
        >
          {/* SVG Dependency Connection Lines */}
          <svg className="absolute inset-0 w-[2000px] h-[2000px] pointer-events-none">
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--secondary-foreground))" opacity="0.3" />
              </marker>
            </defs>
            {/* Draw schematic links */}
            <path d="M 120 110 L 400 110" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeDasharray="4 4" markerEnd="url(#arrow)" />
            <path d="M 120 180 L 400 110" stroke="hsl(var(--secondary-foreground))" strokeWidth="1" opacity="0.3" markerEnd="url(#arrow)" />
            <path d="M 400 110 L 680 180" stroke="hsl(var(--secondary-foreground))" strokeWidth="1" opacity="0.3" markerEnd="url(#arrow)" />
          </svg>

          {/* Interactive Bounded Groups */}
          <div className="absolute top-10 left-10 flex gap-12 p-6">
            
            {Object.entries(resourceGroups).map(([rgName, rList]) => (
              <div 
                key={rgName}
                className="border border-dashed border-border/80 p-4 rounded bg-background/50 space-y-4 min-w-[260px] shadow-elevation-1"
              >
                <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest pb-1 border-b border-border">
                  Group: {rgName}
                </div>
                
                <div className="space-y-2">
                  {rList.map((res) => {
                    const hasAlert = recommendations.some(r => r.resource_id === res.id && r.status === 'pending');
                    const isSelected = selectedResource?.id === res.id;
                    
                    return (
                      <div
                        key={res.id}
                        onClick={() => setSelectedResource(res)}
                        className={`p-2.5 rounded border text-left cursor-pointer transition-all ${
                          isSelected 
                            ? "bg-secondary border-primary shadow-elevation-1" 
                            : "bg-card border-border hover:border-secondary-foreground"
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-foreground">{res.name}</span>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            res.status === 'Running' || res.status === 'active' ? 'bg-success' : 'bg-destructive'
                          }`} />
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1 flex justify-between">
                          <span>{res.type.split('/').pop()}</span>
                          {hasAlert && <span className="text-warning font-bold">● Opt Target</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

          </div>
        </div>
      </div>

      {/* Progressive Node Details Panel */}
      {selectedResource ? (
        <div className="p-4 border border-border rounded bg-card space-y-3 shadow-elevation-1 fade-in-up">
          <div className="flex justify-between items-center border-b border-border pb-2">
            <span className="text-xs font-bold text-foreground">{selectedResource.name}</span>
            <button 
              onClick={() => setSelectedResource(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px]">
            <div>
              <div className="text-muted-foreground">Azure Resource ID</div>
              <div className="text-foreground select-text font-mono truncate">{selectedResource.provider_id}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Resource Region</div>
              <div className="text-foreground">{selectedResource.region}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Type Scope</div>
              <div className="text-foreground font-mono">{selectedResource.type}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Lifecycle State</div>
              <div className="text-foreground uppercase font-bold text-primary">{selectedResource.status}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 border border-border border-dashed rounded text-center text-muted-foreground">
          Click an infrastructure canvas node in the blueprint schematic to inspect its Azure configuration details progressively.
        </div>
      )}

    </div>
  );
}
