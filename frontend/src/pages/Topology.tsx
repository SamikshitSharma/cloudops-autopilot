import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/ui-ext/StateViews";
import { Network, GitBranch, Cpu, Database, HardDrive, ShieldCheck, HelpCircle, Cloud, Globe, Server, Lock, BotMessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useHealth } from "@/hooks/overview";

export interface TopologyNode {
  id: string;
  label: string;
  type?: string;
  role?: string;
  status: string;
  health?: string;
  details?: string;
  cost?: number;
}

export interface TopologyEdge {
  source: string;
  target: string;
  type?: string;
}

export interface TopologyRaw {
  infrastructure: {
    nodes: Array<{ id: string; label: string; type?: string; health: string; details?: string }>;
    edges: TopologyEdge[];
  };
  agent: {
    nodes: Array<{ id: string; label: string; type?: string; health: string; details?: string }>;
    edges: TopologyEdge[];
  };
}

export interface TopologyResponse {
  infrastructure: {
    nodes: TopologyNode[];
    edges: TopologyEdge[];
  };
  agent: {
    nodes: TopologyNode[];
    edges: TopologyEdge[];
  };
}

export default function Topology() {
  const [view, setView] = useState<"infrastructure" | "agent">("infrastructure");
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null);
  const { data: health } = useHealth();

  const { data: topology, isLoading, isError, error, refetch } = useQuery<TopologyResponse>({
    queryKey: ["topology"],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: TopologyRaw }>("/api/v1/topology");
      const raw = res?.data;
      if (!raw) return { infrastructure: { nodes: [], edges: [] }, agent: { nodes: [], edges: [] } };
      // Normalize backend nodes: map `health` → `status`
      const normalizeNodes = (nodes: TopologyRaw["infrastructure"]["nodes"]): TopologyNode[] =>
        nodes.map(n => ({ ...n, status: n.health ?? "unknown" }));
      return {
        infrastructure: {
          nodes: normalizeNodes(raw.infrastructure?.nodes ?? []),
          edges: raw.infrastructure?.edges ?? [],
        },
        agent: {
          nodes: normalizeNodes(raw.agent?.nodes ?? []),
          edges: raw.agent?.edges ?? [],
        },
      };
    },
    refetchInterval: 3000,
  });

  const activeMode = useMemo(() => health?.data?.cloud_mode ?? "UNKNOWN", [health]);

  const handleNodeClick = (node: TopologyNode) => {
    setSelectedNode(node);
    if (view === "infrastructure") {
      localStorage.setItem("last_selected_resource_id", node.id);
      toast.info(`Active resource context set to: ${node.id}`);
    }
  };

  // Node position helper for Infrastructure
  const infraNodesWithCoords = useMemo(() => {
    if (!topology?.infrastructure?.nodes) return [];
    const nodes = topology.infrastructure.nodes;
    
    // Sort by type to layer them: VM (Web) -> SQL/Vault (Data) -> Disk (Storage)
    const vmNodes = nodes.filter(n => n.type === "VM" || n.type === "AppService" || n.type === "LoadBalancer");
    const dataNodes = nodes.filter(n => n.type === "Database" || n.type === "KeyVault");
    const storageNodes = nodes.filter(n => !vmNodes.includes(n) && !dataNodes.includes(n));
    
    const layout: (TopologyNode & { x: number; y: number })[] = [];
    const width = 800;
    
    // Layer 1: Compute (y = 80)
    vmNodes.forEach((n, idx) => {
      const x = vmNodes.length > 1 ? 80 + (idx * (width - 160)) / (vmNodes.length - 1) : width / 2;
      layout.push({ ...n, x, y: 80 });
    });
    
    // Layer 2: Data (y = 200)
    dataNodes.forEach((n, idx) => {
      const x = dataNodes.length > 1 ? 120 + (idx * (width - 240)) / (dataNodes.length - 1) : width / 2;
      layout.push({ ...n, x, y: 200 });
    });
    
    // Layer 3: Storage & Disks (y = 320)
    storageNodes.forEach((n, idx) => {
      const x = storageNodes.length > 1 ? 80 + (idx * (width - 160)) / (storageNodes.length - 1) : width / 2;
      layout.push({ ...n, x, y: 320 });
    });
    
    return layout;
  }, [topology, view]);

  // Node position helper for Agents
  const agentNodesWithCoords = useMemo(() => {
    if (!topology?.agent?.nodes) return [];
    const nodes = topology.agent.nodes;
    const width = 900;
    const layout: (TopologyNode & { x: number; y: number })[] = [];
    
    // 9 stages laid out in a clean pipeline
    nodes.forEach((n, idx) => {
      const x = 60 + (idx * (width - 120)) / (nodes.length - 1);
      layout.push({ ...n, x, y: 180 });
    });
    
    return layout;
  }, [topology, view]);

  if (isLoading) {
    return <LoadingState label="Constructing service dependency maps…" />;
  }

  if (isError) {
    return <ErrorState title="Topology Generation Failed" description={error?.message} onRetry={() => refetch()} />;
  }

  // Get status color helper
  const getStatusBorder = (status: string) => {
    const s = status.toLowerCase();
    if (s === "success" || s === "healthy" || s === "online" || s === "running") return "stroke-success";
    if (s === "failed" || s === "failing" || s === "degraded") return "stroke-destructive animate-pulse";
    if (s === "pending" || s === "stopped") return "stroke-muted-foreground/40";
    return "stroke-warning animate-pulse";
  };

  const getStatusFill = (status: string) => {
    const s = status.toLowerCase();
    if (s === "success" || s === "healthy" || s === "online") return "fill-success/20";
    if (s === "running") return "fill-info/30";
    if (s === "failed" || s === "failing" || s === "degraded") return "fill-destructive/20";
    if (s === "pending" || s === "stopped") return "fill-muted/20";
    return "fill-warning/20";
  };

  const getIcon = (type?: string) => {
    if (!type) return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
    const t = type.toLowerCase();
    // Compute
    if (t === "vm" || t === "appservice" || t === "nic") return <Cpu className="h-4 w-4 text-info" />;
    if (t === "loadbalancer") return <Server className="h-4 w-4 text-info" />;
    // Data
    if (t === "database") return <Database className="h-4 w-4 text-warning" />;
    if (t === "keyvault") return <Lock className="h-4 w-4 text-warning" />;
    // Storage
    if (t === "storage" || t === "disk") return <HardDrive className="h-4 w-4 text-muted-foreground" />;
    // Network
    if (t === "vnet" || t === "subnet") return <Network className="h-4 w-4 text-primary" />;
    if (t === "nsg") return <ShieldCheck className="h-4 w-4 text-success" />;
    if (t === "publicip") return <Globe className="h-4 w-4 text-muted-foreground" />;
    // Agents
    if (t === "agent") return <BotMessageSquare className="h-4 w-4 text-primary" />;
    // Cloud generic
    if (t === "cloud") return <Cloud className="h-4 w-4 text-info" />;
    return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6 animate-in-up">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold">System & Agent Topology</h2>
          <p className="text-sm text-muted-foreground">Trace synchronized Azure containment and recorded multi-agent pipeline state</p>
        </div>
        <div className="flex gap-2 items-center">
          <Badge variant="outline" className="uppercase font-semibold tracking-wider text-xs border-primary/45 text-primary">
            {activeMode}
          </Badge>
          <Button 
            variant={view === "infrastructure" ? "default" : "outline"} 
            size="sm" 
            onClick={() => { setView("infrastructure"); setSelectedNode(null); }}
            className="gap-2"
          >
            <Network className="h-4 w-4" /> Infrastructure Map
          </Button>
          <Button 
            variant={view === "agent" ? "default" : "outline"} 
            size="sm" 
            onClick={() => { setView("agent"); setSelectedNode(null); }}
            className="gap-2"
          >
            <GitBranch className="h-4 w-4" /> Agent reasoning Map
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Main Graph Card */}
        <Card className="glass p-5 lg:col-span-3 flex flex-col items-center justify-center relative min-h-[450px]">
          <div className="absolute top-4 left-4 flex flex-col gap-1 text-[11px] font-mono text-muted-foreground">
            <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success" /> Success / Online</div>
            <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-info animate-pulse" /> Running</div>
            <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-warning animate-pulse" /> Action Required / Pending</div>
            <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-destructive animate-pulse" /> Failure / Degraded</div>
          </div>
          
          <svg viewBox="0 0 900 400" className="w-full h-full max-h-[400px]">
            {/* Draw Edges */}
            {view === "infrastructure" && topology?.infrastructure?.edges.map((e, idx) => {
              const srcNode = infraNodesWithCoords.find(n => n.id === e.source);
              const tgtNode = infraNodesWithCoords.find(n => n.id === e.target);
              if (!srcNode || !tgtNode) return null;
              return (
                <line 
                  key={`e-${idx}`} 
                  x1={srcNode.x} 
                  y1={srcNode.y} 
                  x2={tgtNode.x} 
                  y2={tgtNode.y} 
                  className="stroke-border/60 stroke-2 stroke-dasharray-[4,4] animate-marquee"
                />
              );
            })}

            {view === "agent" && topology?.agent?.edges.map((e, idx) => {
              const srcNode = agentNodesWithCoords.find(n => n.id === e.source);
              const tgtNode = agentNodesWithCoords.find(n => n.id === e.target);
              if (!srcNode || !tgtNode) return null;
              
              // Pulsing line if source is active/running
              const isActive = srcNode.status === "running" || srcNode.status === "success";
              
              return (
                <g key={`ae-${idx}`}>
                  <defs>
                    <marker id="arrow" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 0 L 10 5 L 0 10 z" className="fill-muted-foreground/60" />
                    </marker>
                  </defs>
                  <line 
                    x1={srcNode.x} 
                    y1={srcNode.y} 
                    x2={tgtNode.x} 
                    y2={tgtNode.y} 
                    className={`stroke-2 marker-end-[url(#arrow)] ${isActive ? "stroke-primary/80" : "stroke-muted-foreground/30"}`}
                  />
                  {srcNode.status === "running" && (
                    <circle r="4" className="fill-primary animate-ping">
                      <animateMotion dur="2s" repeatCount="indefinite" path={`M ${srcNode.x} ${srcNode.y} L ${tgtNode.x} ${tgtNode.y}`} />
                    </circle>
                  )}
                </g>
              );
            })}

            {/* Draw Nodes */}
            {view === "infrastructure" && infraNodesWithCoords.map((n) => {
              const isSelected = selectedNode?.id === n.id;
              return (
                <g key={n.id} onClick={() => handleNodeClick(n)} className="cursor-pointer group">
                  <rect 
                    x={n.x - 22} 
                    y={n.y - 22} 
                    width="44" 
                    height="44" 
                    rx="8" 
                    className={`stroke-2 transition-all ${getIcon(n.type) ? "" : ""} ${getStatusBorder(n.status)} ${getStatusFill(n.status)} ${isSelected ? "stroke-primary ring-2 ring-primary/40" : "group-hover:stroke-primary/70"}`} 
                  />
                  <foreignObject x={n.x - 11} y={n.y - 11} width="22" height="22" className="pointer-events-none">
                    <div className="w-full h-full flex items-center justify-center">
                      {getIcon(n.type)}
                    </div>
                  </foreignObject>
                  <text 
                    x={n.x} 
                    y={n.y + 36} 
                    textAnchor="middle" 
                    className="font-mono text-[10px] fill-foreground font-semibold"
                  >
                    {n.label}
                  </text>
                </g>
              );
            })}

            {view === "agent" && agentNodesWithCoords.map((n) => {
              const isSelected = selectedNode?.id === n.id;
              const isRunning = n.status === "running";
              return (
                <g key={n.id} onClick={() => handleNodeClick(n)} className="cursor-pointer group">
                  <circle 
                    cx={n.x} 
                    cy={n.y} 
                    r={isRunning ? 26 : 22} 
                    className={`stroke-2 transition-all ${getStatusBorder(n.status)} ${getStatusFill(n.status)} ${isSelected ? "stroke-primary stroke-[3px]" : "group-hover:stroke-primary/70"} ${isRunning ? "animate-pulse" : ""}`} 
                  />
                  <foreignObject x={n.x - 10} y={n.y - 10} width="20" height="20" className="pointer-events-none">
                    <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-foreground">
                      {n.label.slice(0, 2).toUpperCase()}
                    </div>
                  </foreignObject>
                  <text 
                    x={n.x} 
                    y={n.y + 38} 
                    textAnchor="middle" 
                    className="font-display text-[9.5px] fill-foreground font-semibold max-w-[80px]"
                  >
                    {n.label.split(" ")[0]}
                  </text>
                </g>
              );
            })}
          </svg>
        </Card>

        {/* Selected Node Details Card */}
        <Card className="glass p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">Node Details</h3>
            {selectedNode ? (
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground block">Name</span>
                  <span className="font-mono text-xs font-bold text-foreground break-all">{selectedNode.label}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground block">ID</span>
                  <span className="font-mono text-[10px] text-muted-foreground break-all">{selectedNode.id}</span>
                </div>
                {selectedNode.type && (
                  <div>
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground block">Type</span>
                    <span className="font-mono text-[10px] text-muted-foreground break-all">{selectedNode.type}</span>
                  </div>
                )}
                {selectedNode.role && (
                  <div>
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground block">Role</span>
                    <span className="font-mono text-xs text-primary">{selectedNode.role}</span>
                  </div>
                )}
                <div>
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground block">Status</span>
                  <Badge variant="outline" className={`mt-1 font-bold text-[10px] uppercase ${
                    selectedNode.status.toLowerCase() === "running" || selectedNode.status.toLowerCase() === "healthy" || selectedNode.status.toLowerCase() === "success"
                      ? "bg-success/15 text-success border-success/35"
                      : selectedNode.status.toLowerCase() === "pending" || selectedNode.status.toLowerCase() === "stopped"
                      ? "bg-muted text-muted-foreground border-muted-foreground/30"
                      : "bg-destructive/15 text-destructive border-destructive/35"
                  }`}>
                    {selectedNode.status}
                  </Badge>
                </div>
                {selectedNode.cost !== undefined && selectedNode.cost > 0 && (
                  <div>
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground block">Monthly Cost</span>
                    <span className="font-mono text-xs text-success font-bold">${selectedNode.cost.toFixed(2)}/mo</span>
                  </div>
                )}
                {selectedNode.details && (
                  <div>
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground block">Details</span>
                    <span className="text-[11px] text-muted-foreground leading-relaxed">{selectedNode.details}</span>
                  </div>
                )}
                
                {view === "infrastructure" && (
                  <div className="pt-2 border-t border-border/40 text-[11px] text-muted-foreground leading-normal">
                    This resource is now set as the active conversation context for the AI Chat helper.
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic leading-relaxed">
                Click any node on the graph map to inspect properties, active status, and connection logs.
              </p>
            )}
          </div>
          
          {selectedNode && view === "infrastructure" && (
            <Button size="sm" className="w-full mt-4 bg-primary text-primary-foreground" onClick={() => {
              // Open chatbot directly via click selection
              const btn = document.getElementById("ask-ai-trigger");
              if (btn) btn.click();
            }}>
              Ask AI about this resource
            </Button>
          )}
        </Card>
      </div>
    </div>
  );
}
