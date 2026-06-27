import React, { useState } from "react";
import { 
  Activity, 
  Terminal, 
  Search, 
  Filter, 
  Cpu,
  Radio,
  FileCode,
  Zap,
  Lock,
  GitCommit
} from "lucide-react";
import type { RunDetailsDTO } from "../api/client";

interface EventBusProps {
  runs: RunDetailsDTO[];
  activeRunDetails: RunDetailsDTO | null;
}

export function EventBus({ runs }: EventBusProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("all");

  // Collect all events across all runs
  const allEvents = runs.reduce((acc, run) => {
    if (run.audit_logs) {
      const logsWithRun = run.audit_logs.map((l: any) => ({ 
        ...l, 
        run_status: run.db_record.status,
        scenario: run.in_memory_state?.scenario_name
      }));
      return [...acc, ...logsWithRun];
    }
    return acc;
  }, [] as any[]);

  // Sort events chronologically descending
  const sortedEvents = [...allEvents].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Apply filters
  const filteredEvents = sortedEvents.filter(ev => {
    const searchString = `${ev.run_id} ${ev.step_name} ${ev.event_type} ${ev.message} ${JSON.stringify(ev.payload)}`.toLowerCase();
    const matchesSearch = searchQuery === "" || searchString.includes(searchQuery.toLowerCase());
    const matchesAgent = selectedAgent === "all" || ev.agent_name === selectedAgent;
    return matchesSearch && matchesAgent;
  });

  const agentContributions = allEvents.reduce((acc, ev) => {
    acc[ev.agent_name] = (acc[ev.agent_name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const getAgentColor = (agentName: string) => {
    if (agentName === "telemetry_agent") return "text-cyan-400 bg-cyan-400/10 border-cyan-400/20";
    if (agentName === "decision_agent") return "text-primary bg-primary/10 border-primary/20";
    if (agentName === "execution_agent") return "text-amber-500 bg-amber-500/10 border-amber-500/20";
    if (agentName === "policy_agent") return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
    return "text-muted-foreground bg-muted/20 border-border";
  };

  const getAgentIcon = (agentName: string) => {
    if (agentName === "telemetry_agent") return <Activity className="h-3 w-3" />;
    if (agentName === "decision_agent") return <Cpu className="h-3 w-3" />;
    if (agentName === "execution_agent") return <Zap className="h-3 w-3" />;
    if (agentName === "policy_agent") return <Lock className="h-3 w-3" />;
    return <FileCode className="h-3 w-3" />;
  };

  return (
    <div className="space-y-6 flex h-[calc(100vh-140px)] flex-col">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Global Event Timeline</h2>
          <p className="text-sm text-muted-foreground mt-1">Real-time broadcast event stream capturing all agent activities across the swarm.</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-emerald-500 font-mono bg-emerald-500/10 px-3 py-1.5 rounded-md border border-emerald-500/20">
          <Radio className="h-3.5 w-3.5 animate-pulse" />
          <span>BROADCASTING</span>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        
        {/* Left sidebar filters */}
        <div className="w-full lg:w-64 flex flex-col gap-4">
          <div className="glass-panel p-4 rounded-xl border border-border">
            <div className="relative mb-4">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Filter logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-background border border-border rounded-lg pl-8 pr-3 py-2 text-xs text-foreground placeholder-muted-foreground focus:ring-1 focus:ring-primary focus:border-primary transition-all"
              />
            </div>
            
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
              <Filter className="h-3 w-3" /> Filter by Agent
            </h3>
            
            <div className="space-y-1.5">
              <button 
                onClick={() => setSelectedAgent("all")}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs transition-colors ${
                  selectedAgent === "all" ? "bg-primary/10 text-primary font-bold" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <span>All Agents</span>
                <span className="font-mono text-[10px]">{allEvents.length}</span>
              </button>
              
              {Object.entries(agentContributions).map(([agent, count]) => (
                <button 
                  key={agent}
                  onClick={() => setSelectedAgent(agent)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs transition-colors ${
                    selectedAgent === agent ? "bg-primary/10 text-primary font-bold" : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {getAgentIcon(agent)}
                    <span className="truncate w-24 text-left">{agent.replace('_agent', '')}</span>
                  </div>
                  <span className="font-mono text-[10px]">{count as number}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="glass-panel p-4 rounded-xl border border-border mt-auto">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Pipeline Activity</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Error Rate</span>
                <span className="text-xs font-mono font-bold text-foreground">
                  {allEvents.length > 0 ? ((allEvents.filter(e => e.status === "failure").length / allEvents.length) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Avg Latency</span>
                <span className="text-xs font-mono font-bold text-emerald-500">24ms</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Terminal View */}
        <div className="flex-1 bg-black/60 border border-border rounded-xl flex flex-col overflow-hidden scanline-effect shadow-2xl relative">
          
          <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-background/50 backdrop-blur-md z-10">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-mono">
              <Terminal className="h-4 w-4" />
              systemd[1]: cloudops-autopilot.service
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 font-mono text-[11px] leading-relaxed relative">
            <div className="absolute left-6 top-0 bottom-0 w-px bg-border/50 z-0 hidden md:block"></div>
            
            <div className="space-y-1 relative z-10">
              {filteredEvents.length === 0 ? (
                <div className="text-muted-foreground italic pl-6 py-4">No events matching the current filters.</div>
              ) : (
                filteredEvents.map((log, idx) => {
                  const isError = log.status === "failure";
                  
                  return (
                    <div key={log.id || idx} className="flex gap-4 group hover:bg-white/5 p-1 -mx-1 rounded transition-colors relative">
                      
                      <div className="hidden md:flex flex-col items-center mt-1.5 shrink-0 w-4">
                        <div className={`h-2 w-2 rounded-full border ${isError ? 'bg-destructive border-destructive' : 'bg-background border-primary'}`}></div>
                      </div>

                      <div className="w-[70px] shrink-0 text-muted-foreground opacity-50 mt-0.5">
                        {new Date(log.timestamp).toISOString().split('T')[1].substring(0,11)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-0.5">
                          <span className={`px-1.5 py-0.5 rounded border flex items-center gap-1 font-bold text-[9px] uppercase tracking-widest ${getAgentColor(log.agent_name)}`}>
                            {getAgentIcon(log.agent_name)}
                            {log.agent_name.replace('_agent', '')}
                          </span>
                          
                          <span className="text-[10px] text-muted-foreground font-bold">
                            [{log.event_type}]
                          </span>
                          
                          {log.scenario && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded">
                              {log.scenario}
                            </span>
                          )}
                        </div>
                        
                        <div className={`break-words ${isError ? 'text-destructive font-bold' : 'text-foreground'}`}>
                          {log.message}
                        </div>
                        
                        {log.details && (
                          <div className={`mt-1 p-2 rounded bg-background/50 border ${isError ? 'border-destructive/30 text-destructive/90' : 'border-border/50 text-muted-foreground'}`}>
                            {typeof log.details === 'object' ? JSON.stringify(log.details) : log.details}
                          </div>
                        )}
                        
                        {/* Expandable Payload Debug */}
                        {log.payload && Object.keys(log.payload).length > 0 && (
                          <details className="mt-1 cursor-pointer">
                            <summary className="text-[10px] text-primary/70 hover:text-primary select-none w-fit">Show Payload</summary>
                            <pre className="mt-1 p-2 rounded bg-background/80 border border-border/50 text-muted-foreground text-[10px] overflow-x-auto custom-scrollbar">
                              {JSON.stringify(log.payload, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
