import React, { useState, useMemo } from "react";
import { FileText, Search, RefreshCw, Eye, Download, ShieldCheck, HelpCircle } from "lucide-react";
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
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Extract and flatten logs from runs
  const allLogs: AuditLogDTO[] = useMemo(() => {
    const logsList: AuditLogDTO[] = [];
    runs.forEach(run => {
      if (run.audit_logs) {
        run.audit_logs.forEach((log: any) => {
          logsList.push({
            ...log,
            // Include correlation or workflow context if available
            run_id: run.db_record.id
          });
        });
      }
    });
    return logsList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [runs]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return allLogs.filter(log => {
      const matchesAgent = filterAgent === "all" || log.agent_name === filterAgent;
      const matchesEvent = filterEvent === "all" || log.event_type === filterEvent;
      const searchStr = `${log.run_id} ${log.step_name} ${log.event_type} ${JSON.stringify(log.payload)}`.toLowerCase();
      const matchesSearch = searchQuery === "" || searchStr.includes(searchQuery.toLowerCase());
      
      return matchesAgent && matchesEvent && matchesSearch;
    });
  }, [allLogs, filterAgent, filterEvent, searchQuery]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Mock Export as CSV function
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;
    const headers = ["ID", "Run ID", "Timestamp", "Agent", "Step", "Event Type", "Status", "Payload"];
    const rows = filteredLogs.map(log => [
      log.id,
      log.run_id,
      log.timestamp,
      log.agent_name,
      log.step_name,
      log.event_type,
      log.status,
      JSON.stringify(log.payload).replace(/"/g, '""')
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `cloudops_audit_ledger_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 fade-in-up">
      
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h2 className="text-xl font-extrabold text-foreground uppercase">System Audit Ledger</h2>
          <p className="text-xs text-muted-foreground mt-1">Immutable execution records mapping orchestrator steps, policy checks, and cloud dispatches.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={filteredLogs.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border bg-card text-xs hover:bg-secondary/45 text-slate-300 font-bold uppercase transition-all disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border bg-card text-xs hover:bg-secondary/45 text-slate-300 font-bold uppercase transition-all"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Sync Ledger</span>
          </button>
        </div>
      </div>

      {/* Query Filter Toolbar */}
      <div className="p-4 bg-card border border-border rounded shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-foreground">
            <FileText className="h-4 w-4 text-primary" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider font-mono">Ledger Query Engine</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search field */}
          <div className="relative md:col-span-2">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by Run ID, event types, payload metadata..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 w-full bg-background border border-border rounded text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Filter Agent */}
          <select
            value={filterAgent}
            onChange={(e) => setFilterAgent(e.target.value)}
            className="px-2 py-1.5 bg-background border border-border rounded text-xs text-foreground focus:outline-none cursor-pointer font-semibold"
          >
            <option value="all">All Cognitive Nodes</option>
            <option value="orchestrator">Orchestrator Swarm</option>
            <option value="telemetry_agent">Telemetry Node</option>
            <option value="decision_agent">Decision Node</option>
            <option value="execution_agent">Execution Node</option>
            <option value="audit_agent">Audit Node</option>
          </select>

          {/* Filter Event */}
          <select
            value={filterEvent}
            onChange={(e) => setFilterEvent(e.target.value)}
            className="px-2 py-1.5 bg-background border border-border rounded text-xs text-foreground focus:outline-none cursor-pointer font-semibold"
          >
            <option value="all">All Event Classes</option>
            <option value="WorkflowStarted">WorkflowStarted</option>
            <option value="WorkflowCompleted">WorkflowCompleted</option>
            <option value="ToolStarted">ToolStarted</option>
            <option value="ToolCompleted">ToolCompleted</option>
            <option value="ToolFailed">ToolFailed</option>
          </select>
        </div>
      </div>

      {/* Grid list and Inspector split panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Table List (2 columns) */}
        <div className="lg:col-span-2 bg-card border border-border rounded shadow-sm">
          <div className="overflow-x-auto max-h-[480px] overflow-y-auto pr-1 custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-secondary/15 text-muted-foreground uppercase font-bold text-[10px] tracking-wider sticky top-0 bg-card z-10">
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Run ID</th>
                  <th className="py-3 px-4">Agent Node</th>
                  <th className="py-3 px-4">Event Tag</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Inspect</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground italic font-mono">
                      Zero matching records indexed in the local system audit store.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="border-b border-border/50 hover:bg-secondary/10 transition-colors">
                      <td className="py-3 px-4 font-mono text-muted-foreground">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-4 font-mono text-muted-foreground truncate max-w-[80px]" title={log.run_id}>
                        {log.run_id.substring(0, 8)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-extrabold text-foreground font-mono text-[9px] uppercase tracking-wider">{log.agent_name.replace('_agent', '')}</span>
                      </td>
                      <td className="py-3 px-4 text-primary font-bold font-mono text-[9px]">{log.event_type}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase font-mono border ${
                          log.status === "success" 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                            : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className={`p-1 rounded border transition-all ${
                            selectedLog?.id === log.id ? 'bg-primary border-primary text-primary-foreground' : 'bg-card border-border hover:bg-secondary text-muted-foreground hover:text-foreground'
                          }`}
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

        {/* Payload inspector (1 column) */}
        <div className="bg-card border border-border p-5 rounded flex flex-col justify-between shadow-sm min-h-[400px]">
          <div>
            <div className="flex items-center gap-2 mb-5 border-b border-border pb-3">
              <FileText className="h-4.5 w-4.5 text-primary" />
              <h4 className="font-bold text-xs uppercase tracking-wider text-foreground">Payload Inspector</h4>
            </div>

            {selectedLog ? (
              <div className="space-y-4 text-xs">
                <div>
                  <span className="text-[8px] text-muted-foreground uppercase block font-bold font-mono">Run ID Correlation</span>
                  <span className="text-xs text-foreground font-mono font-bold">{selectedLog.run_id}</span>
                </div>
                <div>
                  <span className="text-[8px] text-muted-foreground uppercase block font-bold font-mono">Trigger Target</span>
                  <span className="text-xs text-slate-300 font-mono font-semibold">{selectedLog.agent_name} [{selectedLog.step_name}]</span>
                </div>
                <div>
                  <span className="text-[8px] text-muted-foreground uppercase block font-bold font-mono">Event Type Tag</span>
                  <span className="text-xs text-primary font-mono font-bold uppercase">{selectedLog.event_type}</span>
                </div>
                <div>
                  <span className="text-[8px] text-muted-foreground uppercase block font-bold font-mono mb-1.5">Event Details Payload</span>
                  <div className="bg-black/95 rounded p-3 font-mono text-[9px] text-emerald-400 overflow-x-auto max-h-56 border border-border/50 custom-scrollbar scanline-effect relative">
                    <pre>{JSON.stringify(selectedLog.payload, null, 2)}</pre>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-20">
                <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3 animate-pulse" />
                <p className="text-xs text-muted-foreground font-bold uppercase">No log selected</p>
                <p className="text-[10px] text-muted-foreground mt-1 leading-normal max-w-[160px] mx-auto">Click the inspect eye icon next to any ledger entry.</p>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-border text-[8px] text-muted-foreground font-mono leading-relaxed mt-4">
            Audit logs are digitally cached and immutable inside local database files.
          </div>
        </div>

      </div>
    </div>
  );
}
