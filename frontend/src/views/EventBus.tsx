import React, { useState, useMemo } from "react";
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

  // Collect all audit log events across all runs
  const allEvents = useMemo(() => {
    const list: any[] = [];
    runs.forEach(run => {
      if (run.audit_logs) {
        run.audit_logs.forEach((log: any) => {
          list.push({
            ...log,
            run_status: run.db_record.status,
            scenario: run.in_memory_state?.scenario_name
          });
        });
      }
    });
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [runs]);

  // Apply search query and filters
  const filteredEvents = useMemo(() => {
    return allEvents.filter(ev => {
      const searchString = `${ev.run_id} ${ev.step_name} ${ev.event_type} ${JSON.stringify(ev.payload)}`.toLowerCase();
      const matchesSearch = searchQuery === "" || searchString.includes(searchQuery.toLowerCase());
      const matchesAgent = selectedAgent === "all" || ev.agent_name === selectedAgent;
      return matchesSearch && matchesAgent;
    });
  }, [allEvents, searchQuery, selectedAgent]);

  // Aggregate agent contributions count
  const agentContributions = useMemo(() => {
    const counts: Record<string, number> = {};
    allEvents.forEach(ev => {
      counts[ev.agent_name] = (counts[ev.agent_name] || 0) + 1;
    });
    return counts;
  }, [allEvents]);

  const getAgentColor = (agentName: string) => {
    const name = agentName.toLowerCase();
    if (name.includes("telemetry")) return "text-cyan-400 bg-cyan-400/10 border-cyan-400/20";
    if (name.includes("decision")) return "text-primary bg-primary/10 border-primary/20";
    if (name.includes("execution")) return "text-amber-500 bg-amber-500/10 border-amber-500/20";
    if (name.includes("policy") || name.includes("audit")) return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
    return "text-muted-foreground bg-muted/20 border-border";
  };

  const getAgentIcon = (agentName: string) => {
    const name = agentName.toLowerCase();
    if (name.includes("telemetry")) return <Activity className="h-3 w-3" />;
    if (name.includes("decision")) return <Cpu className="h-3 w-3" />;
    if (name.includes("execution")) return <Zap className="h-3 w-3" />;
    if (name.includes("policy") || name.includes("audit")) return <Lock className="h-3 w-3" />;
    return <FileCode className="h-3 w-3" />;
  };

  return (
    <div className="space-y-6 flex h-[calc(100vh-140px)] flex-col fade-in-up">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h2 className="text-xl font-extrabold text-foreground uppercase">Global Event Broadcast</h2>
          <p className="text-xs text-muted-foreground mt-1">Real-time broadcast event stream capturing multi-agent swarm operations.</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-emerald-500 font-mono font-bold bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded">
          <Radio className="h-3.5 w-3.5 animate-pulse" />
          <span>Stream Active</span>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        
        {/* Left side filters panel (1 column) */}
        <div className="w-full lg:w-64 flex flex-col gap-4 flex-shrink-0">
          <div className="bg-card border border-border p-4 rounded space-y-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Filter logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-background border border-border rounded pl-8 pr-3 py-1.5 text-xs text-foreground placeholder-muted-foreground focus:outline-none"
              />
            </div>
            
            <h3 className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-primary" /> Filter Agent
            </h3>
            
            <div className="space-y-1 overflow-y-auto max-h-48 pr-1 custom-scrollbar">
              <button 
                onClick={() => setSelectedAgent("all")}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors ${
                  selectedAgent === "all" ? "bg-primary/10 text-primary font-bold" : "text-muted-foreground hover:bg-secondary/45"
                }`}
              >
                <span>All Agents</span>
                <span className="font-mono text-[9px] font-bold">{allEvents.length}</span>
              </button>
              
              {Object.entries(agentContributions).map(([agent, count]) => (
                <button 
                  key={agent}
                  onClick={() => setSelectedAgent(agent)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors ${
                    selectedAgent === agent ? "bg-primary/10 text-primary font-bold" : "text-muted-foreground hover:bg-secondary/45"
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden mr-2">
                    {getAgentIcon(agent)}
                    <span className="truncate uppercase font-mono text-[10px]">{agent.replace('_agent', '')}</span>
                  </div>
                  <span className="font-mono text-[9px] font-bold">{count as number}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Diagnostics Info card */}
          <div className="bg-card border border-border p-4 rounded mt-auto">
            <h3 className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-3 font-mono">Stream Latency</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-semibold">Error Ratio</span>
                <span className="font-mono font-bold text-foreground">
                  {allEvents.length > 0 ? ((allEvents.filter(e => e.status === "failure").length / allEvents.length) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-semibold">Stream Latency</span>
                <span className="font-mono font-bold text-emerald-500">12ms</span>
              </div>
            </div>
          </div>
        </div>

        {/* Console logs timeline viewport */}
        <div className="flex-1 bg-black/95 border border-border rounded flex flex-col overflow-hidden scanline-effect shadow-lg relative">
          
          <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-card/65 backdrop-blur z-10 select-none">
            <div className="flex items-center gap-2 text-slate-300 text-[10px] font-mono font-bold">
              <Terminal className="h-3.5 w-3.5 text-primary animate-pulse" />
              stdout@swarm-bus.service
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 font-mono text-[10.5px] leading-relaxed relative">
            <div className="absolute left-6 top-0 bottom-0 w-px bg-border/20 z-0 hidden md:block" />
            
            <div className="space-y-2.5 relative z-10">
              {filteredEvents.length === 0 ? (
                <div className="text-muted-foreground italic pl-6">Zero events matching query filters.</div>
              ) : (
                filteredEvents.map((log, idx) => {
                  const isError = log.status === "failure";
                  
                  return (
                    <div key={log.id || idx} className="flex gap-4 group hover:bg-white/5 p-1 rounded transition-colors relative">
                      
                      <div className="hidden md:flex flex-col items-center mt-1 shrink-0 w-4 select-none">
                        <div className={`h-1.5 w-1.5 rounded-full border ${isError ? 'bg-danger border-danger' : 'bg-background border-primary'}`} />
                      </div>

                      <div className="w-[60px] shrink-0 text-muted-foreground opacity-50 mt-0.5 select-none font-bold text-[9px]">
                        {new Date(log.timestamp).toISOString().split('T')[1].substring(0,8)}
                      </div>
                      
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded border flex items-center gap-1 font-bold text-[8px] uppercase tracking-wider ${getAgentColor(log.agent_name)}`}>
                            {getAgentIcon(log.agent_name)}
                            {log.agent_name.replace('_agent', '')}
                          </span>
                          
                          <span className="text-[9px] text-muted-foreground font-extrabold uppercase font-mono">
                            [{log.event_type}]
                          </span>
                          
                          {log.scenario && (
                            <span className="text-[8px] px-1.5 py-0.5 bg-secondary/35 text-slate-300 rounded font-bold uppercase border border-border">
                              {log.scenario}
                            </span>
                          )}
                        </div>
                        
                        <div className={`break-words ${isError ? 'text-danger font-bold' : 'text-slate-200 font-semibold'}`}>
                          {log.message}
                        </div>
                        
                        {log.details && (
                          <div className={`p-2 rounded border font-mono text-[9px] mt-1.5 ${
                            isError ? 'bg-danger/10 border-danger/20 text-danger' : 'bg-secondary/15 border-border/50 text-slate-400'
                          }`}>
                            {typeof log.details === 'object' ? JSON.stringify(log.details) : log.details}
                          </div>
                        )}
                        
                        {log.payload && Object.keys(log.payload).length > 0 && (
                          <details className="cursor-pointer select-none">
                            <summary className="text-[9px] text-primary/70 hover:text-primary font-bold uppercase tracking-wider">Inspect payload</summary>
                            <pre className="mt-1 p-2 rounded bg-black/85 border border-border/30 text-emerald-400 text-[9px] overflow-x-auto custom-scrollbar select-text">
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
