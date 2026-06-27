import React, { useState } from "react";
import { 
  Activity, 
  Terminal, 
  Search, 
  Filter, 
  ArrowDown,
  Cpu
} from "lucide-react";
import type { RunDTO, RunDetailsDTO } from "../api/client";

interface EventBusProps {
  runs: RunDetailsDTO[];
  activeRunDetails: RunDetailsDTO | null;
}

export function EventBus({ runs, activeRunDetails }: EventBusProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("all");

  // Collect all events across all runs
  const allEvents = runs.reduce((acc, run) => {
    if (run.audit_logs) {
      const logsWithRun = run.audit_logs.map((l: any) => ({ ...l, run_status: run.db_record.status }));
      return [...acc, ...logsWithRun];
    }
    return acc;
  }, [] as any[]);

  // Sort events chronologically descending (newest first)
  const sortedEvents = [...allEvents].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Apply filters
  const filteredEvents = sortedEvents.filter(ev => {
    const matchesSearch = searchQuery === "" || 
      ev.run_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.step_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.event_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      JSON.stringify(ev.payload).toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAgent = selectedAgent === "all" || ev.agent_name === selectedAgent;

    return matchesSearch && matchesAgent;
  });

  // Calculate statistics
  const totalEvents = allEvents.length;
  const agentContributions = allEvents.reduce((acc, ev) => {
    acc[ev.agent_name] = (acc[ev.agent_name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Widget */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#22252d] pb-6">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-wide">EVENT BUS LIVE ACTIVITY</h2>
          <p className="text-xs text-slate-400 mt-1">Real-time broadcast event stream capturing agent reasoning state changes and tool executions.</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>LIVE BROADCAST ACTIVE</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-[#111318] border border-[#22252d] rounded-lg">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono">Total Broadcast Signals</span>
          <h4 className="text-lg font-extrabold text-white font-mono mt-1">{totalEvents}</h4>
        </div>
        {Object.entries(agentContributions).slice(0, 3).map(([agent, count]) => (
          <div key={agent} className="p-4 bg-[#111318] border border-[#22252d] rounded-lg">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono">{agent} Load</span>
            <h4 className="text-lg font-extrabold text-indigo-400 font-mono mt-1">{(count as any)} events</h4>
          </div>
        ))}
      </div>

      {/* Filters Toolbar */}
      <div className="p-6 bg-[#111318] border border-[#22252d] rounded-xl space-y-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4.5 w-4.5 text-indigo-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Event Stream Filter</h3>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search bar */}
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search event content, payloads, step names, run IDs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 w-full bg-[#090b0f] border border-[#22252d] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:border-indigo-500/50 focus:outline-none focus:ring-0"
            />
          </div>

          {/* Filter Agent */}
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="px-3 py-2 bg-[#090b0f] border border-[#22252d] rounded-lg text-xs text-slate-200 focus:border-indigo-500/50 focus:outline-none focus:ring-0 cursor-pointer"
          >
            <option value="all">All Agents</option>
            {Object.keys(agentContributions).map(agent => (
              <option key={agent} value={agent}>{agent}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Terminal Timelines Ledger */}
      <div className="p-6 bg-[#111318] border border-[#22252d] rounded-xl shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-[#22252d] pb-3">
          <div className="flex items-center gap-2">
            <Terminal className="h-4.5 w-4.5 text-indigo-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Timeline Activity Log</h3>
          </div>
          <ArrowDown className="h-4 w-4 text-slate-500 animate-bounce" />
        </div>

        <div className="bg-[#090b0f] rounded-lg p-6 font-mono text-xs text-emerald-400 space-y-3 h-[480px] overflow-y-auto border border-[#22252d] custom-scrollbar">
          {filteredEvents.length === 0 ? (
            <p className="text-slate-500 italic text-center py-20">No broadcast events found matching search criteria.</p>
          ) : (
            filteredEvents.map((log: any, idx) => {
              const isTelemetry = log.agent_name === "telemetry_agent";
              const isDecision = log.agent_name === "decision_agent";
              const isExecution = log.agent_name === "execution_agent";

              return (
                <div key={log.id || idx} className="hover:bg-white/5 p-2 rounded transition-all duration-100 flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-[#1c1e24]/30 pb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-slate-500 font-bold">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{" "}
                    <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                      isTelemetry
                        ? "bg-cyan-500/10 text-cyan-400"
                        : isDecision
                          ? "bg-indigo-500/10 text-indigo-400"
                          : isExecution
                            ? "bg-pink-500/10 text-pink-400"
                            : "bg-slate-500/10 text-slate-400"
                    }`}>
                      {log.agent_name}
                    </span>{" "}
                    <span className="text-pink-400 font-bold">@{log.event_type}</span>{" "}
                    <span className="text-yellow-400 font-bold">[{log.step_name}]</span>{" "}
                    <span className="text-slate-300 truncate max-w-lg" title={JSON.stringify(log.payload)}>- {JSON.stringify(log.payload)}</span>
                  </div>
                  <span className={`text-[9px] uppercase font-extrabold px-2 py-0.5 rounded-full ${
                    log.status === "success" 
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                      : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                  }`}>{log.status}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
