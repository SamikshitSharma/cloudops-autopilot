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
    <div className="space-y-8">
      
      {/* Filters Toolbar */}
      <div className="p-6 bg-card border border-border rounded-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h3 className="font-heading font-semibold text-base">Autopilot System Audit Ledger</h3>
          </div>
          
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border text-xs hover:bg-muted font-medium transition-all"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Sync Ledger</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search bar */}
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
            <input
              type="text"
              placeholder="Search by Run ID, step, payload content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 w-full bg-muted/20 border border-border rounded-lg text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>

          {/* Filter Agent */}
          <select
            value={filterAgent}
            onChange={(e) => setFilterAgent(e.target.value)}
            className="px-3 py-2 bg-muted/20 border border-border rounded-lg text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
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
            className="px-3 py-2 bg-muted/20 border border-border rounded-lg text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Logs Table List */}
        <div className="lg:col-span-2 p-6 bg-card border border-border rounded-xl">
          <div className="overflow-x-auto max-h-[480px] overflow-y-auto pr-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border text-muted uppercase font-bold text-[10px] tracking-wider sticky top-0 bg-card z-15">
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Run ID</th>
                  <th className="py-3 px-4">Agent</th>
                  <th className="py-3 px-4">Event</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Inspect</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted italic">
                      No matching audit logs found.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="border-b border-border hover:bg-muted/10 transition-all">
                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-muted-foreground truncate max-w-[100px]" title={log.run_id}>
                        {log.run_id}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-foreground capitalize">{log.agent_name}</span>
                      </td>
                      <td className="py-3.5 px-4 text-pink-400 font-bold font-mono">{log.event_type}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold ${
                          log.status === "success" 
                            ? "bg-emerald-500/10 text-emerald-500" 
                            : "bg-rose-500/10 text-rose-500"
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="p-1 rounded hover:bg-muted text-primary hover:text-primary-foreground transition-all"
                        >
                          <Eye className="h-4 w-4" />
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
        <div className="p-6 bg-card border border-border rounded-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4 border-b border-border pb-3">
              <FileText className="h-5 w-5 text-primary" />
              <h4 className="font-heading font-semibold text-sm">Audit Payload Inspector</h4>
            </div>

            {selectedLog ? (
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-bold uppercase text-muted block">Run ID</span>
                  <span className="text-xs text-foreground font-mono font-bold">{selectedLog.run_id}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-muted block">Triggered By</span>
                  <span className="text-xs text-foreground font-mono">{selectedLog.agent_name} [{selectedLog.step_name}]</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-muted block">Event Type</span>
                  <span className="text-xs text-pink-400 font-mono font-bold">{selectedLog.event_type}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-muted block mb-1">Payload Content</span>
                  <div className="bg-black/95 rounded-lg p-3 font-mono text-[10px] text-emerald-400 overflow-x-auto max-h-60 border border-border/10">
                    <pre>{JSON.stringify(selectedLog.payload, null, 2)}</pre>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted italic text-center py-20">Click the eye button on any log entry row to view details.</p>
            )}
          </div>

          <div className="pt-4 border-t border-border/40 text-[10px] text-muted-foreground">
            Audit logging records are collected dynamically via event subscription hooks.
          </div>
        </div>

      </div>
    </div>
  );
}
