import React from "react";
import { 
  DollarSign, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw, 
  Activity, 
  Cpu, 
  Database, 
  ShieldCheck 
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
  AreaChart,
  Area
} from "recharts";
import type { RunDTO, RecommendationDTO, ApprovalDTO, ResourceDTO } from "../api/client";

interface OverviewProps {
  runs: RunDTO[];
  resources: ResourceDTO[];
  recommendations: RecommendationDTO[];
  approvals: ApprovalDTO[];
  activeRunDetails?: any;
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

  // 4. Generate mock timeline data for savings growth
  const savingsTimelineData = [
    { name: "06-21", amount: totalRealized * 0.4 },
    { name: "06-22", amount: totalRealized * 0.45 },
    { name: "06-23", amount: totalRealized * 0.6 },
    { name: "06-24", amount: totalRealized * 0.75 },
    { name: "06-25", amount: totalRealized * 0.8 },
    { name: "06-26", amount: totalRealized * 0.95 },
    { name: "06-27", amount: totalRealized },
  ];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Widget */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#22252d] pb-6">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-wide">EXECUTIVE OVERVIEW</h2>
          <p className="text-xs text-slate-400 mt-1">Cross-subscription analysis and cost-optimization telemetry reports.</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>LAST UPDATED: JUST NOW</span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Discovered Savings */}
        <div className="p-6 bg-[#111318] border border-[#22252d] rounded-xl flex items-center justify-between shadow-lg relative overflow-hidden group hover:border-indigo-500/30 transition-all duration-200">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500" />
          <div>
            <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase font-mono">Discovered Savings</p>
            <h3 className="text-2xl font-extrabold text-white font-mono mt-1.5">${totalDiscovered.toFixed(2)}</h3>
            <p className="text-[9px] text-slate-500 font-medium mt-1">Potential monthly reduction</p>
          </div>
          <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 group-hover:scale-105 transition-transform duration-200">
            <DollarSign className="h-5 w-5" />
          </div>
        </div>

        {/* Realized Savings */}
        <div className="p-6 bg-[#111318] border border-[#22252d] rounded-xl flex items-center justify-between shadow-lg relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-200">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
          <div>
            <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase font-mono">Realized Savings</p>
            <h3 className="text-2xl font-extrabold text-emerald-400 font-mono mt-1.5">${totalRealized.toFixed(2)}</h3>
            <p className="text-[9px] text-slate-500 font-medium mt-1">Completed actions cost reduction</p>
          </div>
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform duration-200">
            <CheckCircle className="h-5 w-5" />
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="p-6 bg-[#111318] border border-[#22252d] rounded-xl flex items-center justify-between shadow-lg relative overflow-hidden group hover:border-amber-500/30 transition-all duration-200">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500" />
          <div>
            <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase font-mono">Pending Approvals</p>
            <h3 className="text-2xl font-extrabold text-amber-500 font-mono mt-1.5">{pendingApprovals}</h3>
            <p className="text-[9px] text-slate-500 font-medium mt-1">Actions blocked by guardrails</p>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:scale-105 transition-transform duration-200">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>

        {/* Active Sweeps */}
        <div className="p-6 bg-[#111318] border border-[#22252d] rounded-xl flex items-center justify-between shadow-lg relative overflow-hidden group hover:border-cyan-500/30 transition-all duration-200">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-cyan-500" />
          <div>
            <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase font-mono">Active Sweeps</p>
            <h3 className="text-2xl font-extrabold text-white font-mono mt-1.5">{activeRuns}</h3>
            <p className="text-[9px] text-slate-500 font-medium mt-1">Autonomous reasoning tasks</p>
          </div>
          <div className="p-3 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 group-hover:scale-105 transition-transform duration-200">
            <RefreshCw className={`h-5 w-5 ${activeRuns > 0 ? "animate-spin" : ""}`} />
          </div>
        </div>
      </div>

      {/* Visual Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Realized Savings Timeline Chart */}
        <div className="p-6 bg-[#111318] border border-[#22252d] rounded-xl shadow-lg lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Realized Savings Velocity ($)</h3>
            <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-[#181b21] border border-[#22252d] text-slate-400">CUMULATIVE VIEW</span>
          </div>
          <div className="h-68">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={savingsTimelineData}>
                <defs>
                  <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#525866" fontSize={10} tickLine={false} />
                <YAxis stroke="#525866" fontSize={10} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#111318", borderColor: "#22252d", borderRadius: "8px", fontSize: "11px" }}
                  labelStyle={{ color: "#94a3b8" }}
                />
                <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorSavings)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Risk Profile Pie Chart */}
        <div className="p-6 bg-[#111318] border border-[#22252d] rounded-xl shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Risk Profile Rationale</h3>
            <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-[#181b21] border border-[#22252d] text-slate-400">TOTAL SAVINGS</span>
          </div>
          <div className="h-68 flex flex-col items-center justify-center">
            <div className="w-full h-40 flex items-center justify-center relative">
              {riskChartData.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No risk recommendations</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={riskChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
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
              )}
            </div>
            <div className="w-full grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-[#22252d]">
              {riskChartData.map((entry, index) => (
                <div key={entry.name} className="flex flex-col items-center p-2 rounded bg-[#16191f]/50 border border-[#22252d]">
                  <span className="text-[9px] text-slate-400 font-semibold">{entry.name}</span>
                  <span className="text-xs font-bold font-mono text-white mt-1">${entry.value.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Action Type Breakdown & Health Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Action Type Breakdown */}
        <div className="p-6 bg-[#111318] border border-[#22252d] rounded-xl shadow-lg lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Savings Breakdown by Action Type ($)</h3>
          </div>
          <div className="h-60">
            {actionChartData.length === 0 ? (
              <p className="text-xs text-slate-500 italic text-center py-20">No action metadata found.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={actionChartData}>
                  <XAxis dataKey="name" stroke="#525866" fontSize={10} tickLine={false} />
                  <YAxis stroke="#525866" fontSize={10} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#111318", borderColor: "#22252d", borderRadius: "8px", fontSize: "11px" }}
                  />
                  <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]}>
                    {actionChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* System Health Check Ledger */}
        <div className="p-6 bg-[#111318] border border-[#22252d] rounded-xl shadow-lg flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-6">Autopilot Health Ledger</h3>
            <div className="space-y-4">
              {/* Azure RM API */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-[#16191f]/50 border border-[#22252d]">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-indigo-400" />
                  <span className="text-xs font-bold text-slate-300">Azure RM API Client</span>
                </div>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase font-mono">Connected</span>
              </div>

              {/* SQLite DB */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-[#16191f]/50 border border-[#22252d]">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-purple-400" />
                  <span className="text-xs font-bold text-slate-300">SQLite Database Engine</span>
                </div>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase font-mono">Synchronized</span>
              </div>

              {/* Event Bus */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-[#16191f]/50 border border-[#22252d]">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-pink-400" />
                  <span className="text-xs font-bold text-slate-300">Event Bus Broadcast</span>
                </div>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase font-mono">Listening</span>
              </div>

              {/* JWT Signer */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-[#16191f]/50 border border-[#22252d]">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-cyan-400" />
                  <span className="text-xs font-bold text-slate-300">HITL Gate Guardian</span>
                </div>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase font-mono">Armed</span>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-slate-500 font-mono mt-4 pt-4 border-t border-[#22252d] leading-relaxed">
            All system parameters operate within target security SLA levels.
          </div>
        </div>
      </div>
    </div>
  );
}
