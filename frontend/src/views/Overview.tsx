import React from "react";
import { 
  DollarSign, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw, 
  Terminal 
} from "lucide-react";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from "recharts";
import type { RunDTO, RecommendationDTO, ApprovalDTO, ResourceDTO, RunDetailsDTO } from "../api/client";

interface OverviewProps {
  runs: RunDTO[];
  resources: ResourceDTO[];
  recommendations: RecommendationDTO[];
  approvals: ApprovalDTO[];
  activeRunDetails: RunDetailsDTO | null;
}

const COLORS = ["#6366f1", "#06b6d4", "#f43f5e", "#eab308"];

export function Overview({ runs, resources, recommendations, approvals, activeRunDetails }: OverviewProps) {
  
  // 1. Calculate Metrics
  const totalDiscovered = recommendations.reduce((acc, r) => acc + r.saving_amount, 0);
  const totalRealized = recommendations
    .filter(r => r.status === "executed" || r.status === "approved")
    .reduce((acc, r) => acc + r.saving_amount, 0);

  const pendingApprovals = approvals.filter(a => a.status === "pending").length;
  const activeRuns = runs.filter(r => r.status === "running").length;

  // 2. Prepare Chart Data (Savings by Action Type)
  const savingsByActionMap = recommendations.reduce((acc, r) => {
    acc[r.action_type] = (acc[r.action_type] || 0) + r.saving_amount;
    return acc;
  }, {} as Record<string, number>);

  const actionChartData = Object.entries(savingsByActionMap).map(([name, value]) => ({
    name: name.toUpperCase(),
    value,
  }));

  // 3. Prepare Chart Data (Savings by Risk Level)
  const savingsByRiskMap = recommendations.reduce((acc, r) => {
    acc[r.risk_level] = (acc[r.risk_level] || 0) + r.saving_amount;
    return acc;
  }, {} as Record<string, number>);

  const riskChartData = Object.entries(savingsByRiskMap).map(([name, value]) => ({
    name: name === "low" ? "Low Risk" : "High Risk",
    value,
  }));

  // 4. Collect Live Event Feed from running details or global log table
  // Flatten logs from active run or mock lists for display
  const liveEvents = activeRunDetails?.audit_logs || [
    {
      id: "mock-1",
      timestamp: new Date().toISOString(),
      agent_name: "telemetry_agent",
      step_name: "inventory_sweep",
      event_type: "ToolCompleted",
      payload: { tool_name: "list_resources", found_vms: 5 },
      status: "success"
    },
    {
      id: "mock-2",
      timestamp: new Date(Date.now() - 10000).toISOString(),
      agent_name: "decision_agent",
      step_name: "decision_making",
      event_type: "ToolStarted",
      payload: { tool_name: "estimate_cost", target_vm: "vm-dev-idle-01" },
      status: "success"
    },
    {
      id: "mock-3",
      timestamp: new Date(Date.now() - 30000).toISOString(),
      agent_name: "orchestrator",
      step_name: "inventory_sweep",
      event_type: "WorkflowStarted",
      payload: { scenario: "idle_vm" },
      status: "success"
    }
  ];

  return (
    <div className="space-y-8">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="p-6 bg-card border border-border rounded-xl flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted">Discovered Savings</p>
            <h3 className="text-3xl font-bold font-heading mt-1">${totalDiscovered.toFixed(2)}</h3>
            <p className="text-xs text-muted mt-1">Found across subscription</p>
          </div>
          <div className="p-3 rounded-lg bg-primary/10 text-primary">
            <DollarSign className="h-6 w-6" />
          </div>
        </div>

        <div className="p-6 bg-card border border-border rounded-xl flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted">Realized Savings</p>
            <h3 className="text-3xl font-bold font-heading mt-1 text-emerald-500">${totalRealized.toFixed(2)}</h3>
            <p className="text-xs text-muted mt-1">Successfully remediated</p>
          </div>
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-500">
            <CheckCircle className="h-6 w-6" />
          </div>
        </div>

        <div className="p-6 bg-card border border-border rounded-xl flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted">Pending Approvals</p>
            <h3 className="text-3xl font-bold font-heading mt-1 text-amber-500">{pendingApprovals}</h3>
            <p className="text-xs text-muted mt-1">Gated write actions</p>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 text-amber-500">
            <AlertTriangle className="h-6 w-6" />
          </div>
        </div>

        <div className="p-6 bg-card border border-border rounded-xl flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted">Active Sweeps</p>
            <h3 className="text-3xl font-bold font-heading mt-1">{activeRuns}</h3>
            <p className="text-xs text-muted mt-1">Running agent groups</p>
          </div>
          <div className="p-3 rounded-lg bg-cyan-500/10 text-cyan-500">
            <RefreshCw className="h-6 w-6 animate-spin-slow" />
          </div>
        </div>
      </div>

      {/* Visual Analytics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Action Type Bar Chart */}
        <div className="p-6 bg-card border border-border rounded-xl">
          <h3 className="font-heading font-semibold text-base mb-6">Savings by Action Type ($)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={actionChartData}>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
                  labelStyle={{ color: "var(--foreground)" }}
                />
                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Risk Level Pie Chart */}
        <div className="p-6 bg-card border border-border rounded-xl">
          <h3 className="font-heading font-semibold text-base mb-6">Savings by Risk Profile</h3>
          <div className="h-64 flex items-center justify-center">
            <div className="w-1/2 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={riskChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {riskChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-1/2 space-y-3">
              {riskChartData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: COLORS[index] }} />
                  <span className="text-sm font-medium">{entry.name}</span>
                  <span className="text-xs text-muted font-mono">(${entry.value.toFixed(2)})</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Live Event Bus Activity */}
      <div className="p-6 bg-card border border-border rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            <h3 className="font-heading font-semibold text-base">Event Bus Live Activity Ledger</h3>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-mono font-semibold animate-pulse">
            LIVE BROADCAST
          </span>
        </div>
        
        <div className="bg-black/90 rounded-lg p-4 font-mono text-xs text-emerald-400 space-y-2 h-64 overflow-y-auto border border-border/10">
          {liveEvents.map((log: any, idx) => (
            <div key={log.id || idx} className="hover:bg-white/5 p-1.5 rounded transition-all">
              <span className="text-slate-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{" "}
              <span className="text-cyan-400">({log.agent_name || "orchestrator"})</span>{" "}
              <span className="text-pink-400 font-bold">@{log.event_type}</span>{" "}
              <span className="text-yellow-400">[{log.step_name}]</span>{" "}
              <span className="text-slate-300">- {JSON.stringify(log.payload)}</span>{" "}
              <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                log.status === "success" 
                  ? "bg-emerald-500/20 text-emerald-400" 
                  : "bg-rose-500/20 text-rose-400"
              }`}>{log.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
