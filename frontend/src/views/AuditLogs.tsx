import React, { useState } from "react";
import type { AuditLogDTO } from "../api/client";

interface AuditLogsProps {
  runs: any[];
  refresh: () => Promise<any>;
}

export function AuditLogs({ runs, refresh }: AuditLogsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLogDTO | null>(null);
  const [syncing, setSyncing] = useState(false);

  const getLogMessage = (log: AuditLogDTO) => {
    if (log.payload && typeof log.payload === 'object') {
      if (log.payload.message) return log.payload.message;
      if (log.payload.tool_name) return `Executed tool '${log.payload.tool_name}'`;
      if (log.payload.scenario) return `Started sweep scenario '${log.payload.scenario}'`;
    }
    return `${log.event_type} event triggered`;
  };

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

  const filteredLogs = sortedLogs.filter(log => {
    const matchesSearch = searchQuery === "" || 
      log.run_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.step_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.agent_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      JSON.stringify(log.payload).toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

  const handleRefresh = async () => {
    setSyncing(true);
    try {
      await refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6 font-mono text-[11px] leading-relaxed text-muted-foreground fade-in-up">
      
      {/* Header index */}
      <div className="pb-4 border-b border-border flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-foreground tracking-tight font-sans">audit.terminal</h2>
          <p className="text-[10px] text-muted-foreground mt-1 uppercase font-semibold">Immutable Operations Event Audit Ledger Logs</p>
        </div>
        
        {/* Sync Trigger button */}
        <button
          onClick={handleRefresh}
          disabled={syncing}
          className="px-3 py-1.5 border border-border bg-card hover:bg-secondary/40 text-foreground font-semibold rounded shadow-elevation-1 transition-all disabled:opacity-50"
        >
          {syncing ? "[ SYNCING... ]" : "[ SYNC LEDGER ]"}
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex gap-4 items-center bg-card/25 p-3 border border-border rounded-lg shadow-elevation-1">
        <input 
          type="text" 
          placeholder="Filter ledger transactions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-transparent text-[11px] placeholder-muted-foreground focus:outline-none font-mono text-foreground"
        />
        <span className="text-[9px] text-muted-foreground uppercase font-bold">Matches: {filteredLogs.length}</span>
      </div>

      {/* Grid: 2 Columns Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Column: Logs list list */}
        <div className="lg:col-span-2 space-y-2 max-h-[380px] overflow-y-auto custom-scrollbar pr-2">
          
          <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest pb-1 border-b border-border">
            LEDGER TRANSACTION BLOCKS
          </div>

          <div className="space-y-1.5 mt-3">
            {filteredLogs.map((log, idx) => {
              const isActive = selectedLog?.timestamp === log.timestamp && selectedLog?.run_id === log.run_id;
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedLog(isActive ? null : log)}
                  className={`w-full text-left p-2.5 rounded border flex justify-between items-center transition-all ${
                    isActive 
                      ? "bg-secondary border-primary text-foreground font-bold shadow-elevation-1" 
                      : "bg-card/45 border-border hover:bg-secondary/40 text-muted-foreground"
                  }`}
                >
                  <div className="space-y-0.5 max-w-sm truncate">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      <span className="text-foreground font-bold">{log.agent_name.toUpperCase()}</span>
                      <span className="text-[9px] text-muted-foreground">({log.step_name})</span>
                    </div>
                    <div className="text-[10px] truncate">{getLogMessage(log)}</div>
                  </div>
                  
                  <div className="text-right text-[9px] flex flex-col items-end gap-0.5">
                    <span className="text-foreground font-semibold font-mono">{log.run_id.substring(0, 8)}</span>
                    <span>{log.timestamp ? log.timestamp.split('T')[1]?.substring(0, 8) : ""}</span>
                  </div>
                </button>
              );
            })}

            {filteredLogs.length === 0 && (
              <div className="p-8 border border-border border-dashed rounded text-center text-muted-foreground">
                No ledger transactions found matching parameters.
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Log payload Inspector details */}
        <div className="space-y-4">
          
          <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest pb-1 border-b border-border">
            TRANSACTION PAYLOAD
          </div>

          {selectedLog ? (
            <div className="space-y-4">
              
              <div className="p-4 border border-border rounded bg-card/15 shadow-elevation-1 space-y-3">
                <div className="space-y-1.5 text-[10px]">
                  <div>Agent Source: <span className="text-foreground font-bold">{selectedLog.agent_name}</span></div>
                  <div>Pipeline Run ID: <span className="text-foreground select-all font-mono">{selectedLog.run_id}</span></div>
                  <div>Step Context: <span className="text-foreground">{selectedLog.step_name}</span></div>
                  <div>Event Type: <span className="text-foreground uppercase font-bold">{selectedLog.event_type}</span></div>
                </div>

                <div className="pt-2 border-t border-border space-y-1">
                  <div className="text-muted-foreground text-[9px] uppercase tracking-wider font-bold">Metadata Claims</div>
                  <pre className="p-2.5 bg-background border border-border rounded text-[10px] leading-relaxed overflow-x-auto select-text font-mono max-h-[160px] custom-scrollbar">
                    {JSON.stringify(selectedLog.payload, null, 2)}
                  </pre>
                </div>
              </div>

            </div>
          ) : (
            <div className="p-8 border border-border border-dashed rounded text-center text-muted-foreground">
              Select a ledger block entry to inspect the payload claims metadata parameters.
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
