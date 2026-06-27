import React, { useState } from "react";
import { FileText, Search, RefreshCw, Eye } from "lucide-react";
import type { AuditLogDTO } from "../api/client";

interface AuditLogsProps {
  runs: any[];
  refresh: () => Promise<any>;
}

export function AuditLogs({ runs, refresh }: AuditLogsProps) {
  const [filterAgent, setFilterAgent] = useState("all");
  const [filterEvent, setFilterEvent] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLogDTO | null>(null);

  // Flatten all logs from runs data for display
  const allLogs: AuditLogDTO[] = runs.reduce((acc, run) => {
    if (run.audit_logs) {
      return [...acc, ...run.audit_logs];
    }
    return acc;
  }, [] as AuditLogDTO[]);

  // Sort logs by timestamp desc
  const sortedLogs = [...allLogs].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Filter logs
  const filteredLogs = sortedLogs.filter(log => {
    const matchesAgent = filterAgent === "all" || log.agent_name === filterAgent;
    const matchesEvent = filterEvent === "all" || log.event_type === filterEvent;
    const matchesSearch = searchQuery === "" || 
      log.run_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.step_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      JSON.stringify(log.payload).toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesAgent && matchesEvent && matchesSearch;
  });

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Widget */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#22252d] pb-6">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-wide">SYSTEM AUDIT LEDGER</h2>
          <p className="text-xs text-slate-400 mt-1">Immutable ledger logs capturing all orchestrator steps and dry-run execution results.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#22252d] bg-[#181b21] text-xs hover:bg-[#1c1e24] text-slate-200 font-bold uppercase transition-all duration-150"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Sync Ledger</span>
          </button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="p-6 bg-[#111318] border border-[#22252d] rounded-xl space-y-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4.5 w-4.5 text-indigo-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Ledger Query Filter</h3>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search bar */}
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search by Run ID, step, event types, payloads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 w-full bg-[#090b0f] border border-[#22252d] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:border-indigo-500/50 focus:outline-none focus:ring-0"
            />
          </div>

          {/* Filter Agent */}
          <select
            value={filterAgent}
            onChange={(e) => setFilterAgent(e.target.value)}
            className="px-3 py-2 bg-[#090b0f] border border-[#22252d] rounded-lg text-xs text-slate-200 focus:border-indigo-500/50 focus:outline-none focus:ring-0 cursor-pointer"
          >
            <option value="all">All Agents</option>
            <option value="orchestrator">Orchestrator</option>
            <option value="telemetry_agent">Telemetry Agent</option>
            <option value="decision_agent">Decision Agent</option>
            <option value="execution_agent">Execution Agent</option>
            <option value="audit_agent">Audit Agent</option>
          </select>

          {/* Filter Event */}
          <select
            value={filterEvent}
            onChange={(e) => setFilterEvent(e.target.value)}
            className="px-3 py-2 bg-[#090b0f] border border-[#22252d] rounded-lg text-xs text-slate-200 focus:border-indigo-500/50 focus:outline-none focus:ring-0 cursor-pointer"
          >
            <option value="all">All Events</option>
            <option value="WorkflowStarted">WorkflowStarted</option>
            <option value="WorkflowCompleted">WorkflowCompleted</option>
            <option value="ToolStarted">ToolStarted</option>
            <option value="ToolCompleted">ToolCompleted</option>
            <option value="ToolFailed">ToolFailed</option>
          </select>
        </div>
      </div>

      {/* Grid List and Inspector Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Logs Table List */}
        <div className="lg:col-span-2 p-6 bg-[#111318] border border-[#22252d] rounded-xl shadow-lg">
          <div className="overflow-x-auto max-h-[480px] overflow-y-auto pr-1 custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#22252d] text-slate-400 uppercase font-bold text-[10px] tracking-wider sticky top-0 bg-[#111318] z-15">
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Run ID</th>
                  <th className="py-3 px-4">Agent Name</th>
                  <th className="py-3 px-4">Event Tag</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Inspect</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500 italic">
                      No matching audit logs found in the systems directory.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="border-b border-[#1c1e24]/60 hover:bg-[#16191f]/50 transition-all duration-150">
                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-400 truncate max-w-[100px]" title={log.run_id}>
                        {log.run_id}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-extrabold text-slate-200 capitalize font-mono text-[10px] tracking-wide">{log.agent_name}</span>
                      </td>
                      <td className="py-3.5 px-4 text-pink-400 font-extrabold font-mono text-[10px]">{log.event_type}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border ${
                          log.status === "success" 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                            : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="p-1 rounded bg-[#181b21] hover:bg-indigo-500 text-slate-400 hover:text-white border border-[#22252d] transition-all"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit Inspector Panel */}
        <div className="p-6 bg-[#111318] border border-[#22252d] rounded-xl flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center gap-2 mb-6 border-b border-[#22252d] pb-4">
              <FileText className="h-4.5 w-4.5 text-indigo-400" />
              <h4 className="font-heading font-extrabold text-xs uppercase tracking-wider text-slate-200">Payload Inspector</h4>
            </div>

            {selectedLog ? (
              <div className="space-y-5">
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block font-mono">Workflow Run ID</span>
                  <span className="text-xs text-white font-mono font-bold">{selectedLog.run_id}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block font-mono">Trigger Instance</span>
                  <span className="text-xs text-slate-300 font-mono font-semibold">{selectedLog.agent_name} [{selectedLog.step_name}]</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block font-mono">Event Class</span>
                  <span className="text-xs text-pink-400 font-mono font-bold">{selectedLog.event_type}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block font-mono mb-2">Payload Content</span>
                  <div className="bg-[#090b0f] rounded-lg p-4 font-mono text-[10px] text-emerald-400 overflow-x-auto max-h-56 border border-[#22252d] custom-scrollbar">
                    <pre>{JSON.stringify(selectedLog.payload, null, 2)}</pre>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-20">
                <FileText className="h-8 w-8 text-slate-600 mx-auto mb-3 animate-pulse" />
                <p className="text-xs text-slate-400 font-medium">Select a ledger entry</p>
                <p className="text-[10px] text-slate-500 mt-1 leading-normal">Inspect metadata payloads from the table lists.</p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-[#22252d] text-[9px] text-slate-500 font-mono leading-relaxed">
            Ledger log tracking records are stored immutably inside the local databases.
          </div>
        </div>

      </div>
    </div>
  );
}
