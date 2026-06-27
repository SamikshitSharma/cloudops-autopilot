import React, { useEffect, useState } from "react";
import { 
  LayoutDashboard, 
  Database, 
  Network,
  Sparkles,
  Cpu,
  Activity,
  ShieldCheck,
  FileText,
  Sun,
  Moon,
  Zap,
  Lock
} from "lucide-react";
import { api } from "../api/client";

interface DashboardLayoutProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  children: React.ReactNode;
}

export function DashboardLayout({ currentTab, setCurrentTab, children }: DashboardLayoutProps) {
  const [darkMode, setDarkMode] = useState(true);
  const [dbStatus, setDbStatus] = useState<"healthy" | "unhealthy" | "loading">("loading");

  // Sync dark mode preference
  useEffect(() => {
    const root = window.document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [darkMode]);

  // Check health on load and periodically
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await api.getHealth();
        if (res.data.status === "healthy" && res.data.database === "healthy") {
          setDbStatus("healthy");
        } else {
          setDbStatus("unhealthy");
        }
      } catch (err) {
        setDbStatus("unhealthy");
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { id: "overview", label: "Executive Overview", icon: LayoutDashboard },
    { id: "inventory", label: "Asset Inventory", icon: Database },
    { id: "topology", label: "Resource Topology", icon: Network },
    { id: "recommendations", label: "AI Recommendations", icon: Sparkles },
    { id: "workflow", label: "Agent Workflows", icon: Cpu },
    { id: "eventbus", label: "Event Bus Live", icon: Activity },
    { id: "approvals", label: "Approval Center", icon: ShieldCheck },
    { id: "audit", label: "Audit Ledger", icon: FileText },
  ];

  return (
    <div className="flex h-screen bg-[#090b0f] text-[#f8fafc] overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-68 bg-[#111318] border-r border-[#22252d] flex flex-col justify-between z-20 shadow-xl">
        <div>
          {/* Logo / Header */}
          <div className="p-6 border-b border-[#22252d] flex items-center gap-3 bg-[#16191f]/50">
            <div className="p-2.5 rounded-lg bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 text-white shadow-lg shadow-indigo-500/25">
              <Zap className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h1 className="font-heading font-extrabold text-sm tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-pink-400 uppercase">CloudOps</h1>
              <p className="text-[10px] text-slate-400 font-semibold tracking-widest font-mono">AUTOPILOT COGNITIVE</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5 overflow-y-auto max-h-[calc(100vh-280px)] custom-scrollbar">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 group relative ${
                    isActive 
                      ? "bg-gradient-to-r from-[#22252d] to-[#1c1e24] text-indigo-400 border border-indigo-500/30 shadow-inner" 
                      : "hover:bg-[#181b21] text-slate-400 hover:text-slate-200 border border-transparent"
                  }`}
                >
                  <Icon className={`h-4.5 w-4.5 transition-transform duration-200 group-hover:scale-105 ${isActive ? "text-indigo-400" : "text-slate-400 group-hover:text-slate-200"}`} />
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/50" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Settings */}
        <div className="p-4 border-t border-[#22252d] space-y-3 bg-[#16191f]/35">
          {/* Health Status */}
          <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[#0e1014] border border-[#22252d] text-[10px]">
            <span className="text-slate-400 font-medium">Engine Connectivity</span>
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${
                dbStatus === "healthy" 
                  ? "bg-emerald-500 shadow-md shadow-emerald-500/50 animate-pulse" 
                  : dbStatus === "unhealthy" 
                    ? "bg-rose-500 shadow-md shadow-rose-500/50" 
                    : "bg-amber-500 animate-pulse"
              }`} />
              <span className="font-bold uppercase font-mono tracking-wider text-slate-200">{dbStatus}</span>
            </div>
          </div>

          {/* Theme Toggler */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-[#22252d] hover:bg-[#181b21] text-xs font-semibold transition-all duration-200 text-slate-300"
          >
            <div className="flex items-center gap-2">
              {darkMode ? <Moon className="h-3.5 w-3.5 text-indigo-400" /> : <Sun className="h-3.5 w-3.5 text-amber-500" />}
              <span>{darkMode ? "Dark Mode" : "Light Mode"}</span>
            </div>
            <span className="text-[9px] text-slate-500 font-mono tracking-wider border border-[#22252d] px-1.5 py-0.5 rounded bg-[#090b0f]">SYS</span>
          </button>

          {/* Capstone Credit */}
          <div className="text-[9px] text-slate-500 text-center pt-2 font-mono tracking-wider">
            Google x Kaggle AI Agents Capstone
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#090b0f]">
        {/* Top Navbar */}
        <header className="h-16 border-b border-[#22252d] bg-[#111318]/70 backdrop-blur-md px-8 flex items-center justify-between z-10">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold tracking-wide">
            <span className="font-mono text-[10px] text-indigo-400 uppercase tracking-widest">CONTROL PANEL</span>
            <span>/</span>
            <span className="text-slate-100 uppercase tracking-widest font-mono text-[10px]">
              {navItems.find((n) => n.id === currentTab)?.label}
            </span>
          </div>

          {/* Integration Status Badge */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-full bg-[#11241f] text-emerald-400 border border-emerald-500/20">
              <Lock className="h-3 w-3" />
              <span>Safety Guardrails Active</span>
            </div>
          </div>
        </header>

        {/* View Layout Container */}
        <section className="flex-1 overflow-y-auto p-8 bg-[#090b0f]">
          <div className="max-w-7xl mx-auto space-y-8 animate-fadeIn">
            {children}
          </div>
        </section>
      </main>
    </div>
  );
}
