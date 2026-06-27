import React, { useEffect, useState } from "react";
import { 
  LayoutDashboard, 
  Play, 
  Database, 
  CheckSquare, 
  FileText, 
  HelpCircle, 
  Sun, 
  Moon, 
  Activity, 
  ShieldCheck 
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
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "execution", label: "Workflow Run", icon: Play },
    { id: "inventory", label: "Resource Inventory", icon: Database },
    { id: "recommendations", label: "Approval Center", icon: CheckSquare },
    { id: "explainability", label: "Explainability Traces", icon: HelpCircle },
    { id: "logs", label: "System Audit Logs", icon: FileText },
  ];

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col justify-between">
        <div>
          {/* Logo / Header */}
          <div className="p-6 border-b border-border flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary text-primary-foreground">
              <Activity className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <h1 className="font-heading font-bold text-lg leading-tight">CloudOps</h1>
              <p className="text-xs text-muted">AI-Driven Autopilot</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    isActive 
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/10" 
                      : "hover:bg-muted/30 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Settings */}
        <div className="p-4 border-t border-border space-y-3">
          {/* Health Status */}
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/20 text-xs">
            <span className="text-muted-foreground">Engine Connectivity</span>
            <div className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${
                dbStatus === "healthy" 
                  ? "bg-emerald-500 animate-pulse" 
                  : dbStatus === "unhealthy" 
                    ? "bg-rose-500" 
                    : "bg-amber-500"
              }`} />
              <span className="font-semibold capitalize text-foreground">{dbStatus}</span>
            </div>
          </div>

          {/* Theme Toggler */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-border hover:bg-muted/30 text-sm font-medium transition-all"
          >
            <div className="flex items-center gap-2">
              {darkMode ? <Moon className="h-4 w-4 text-primary" /> : <Sun className="h-4 w-4 text-amber-500" />}
              <span>{darkMode ? "Dark Theme" : "Light Theme"}</span>
            </div>
            <span className="text-xs text-muted-foreground font-mono">TOGGLE</span>
          </button>

          {/* Capstone Credit */}
          <div className="text-[10px] text-muted-foreground text-center pt-2 border-t border-border/50">
            Google x Kaggle AI Agents Capstone
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm px-8 flex items-center justify-between z-10">
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
            <span>Autopilot Control Plane</span>
            <span>/</span>
            <span className="text-foreground font-semibold capitalize">
              {navItems.find((n) => n.id === currentTab)?.label}
            </span>
          </div>

          {/* User Profile / Mock Integration Status */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <ShieldCheck className="h-4 w-4" />
              <span>Guardrails Enabled</span>
            </div>
          </div>
        </header>

        {/* View Layout Container */}
        <section className="flex-1 overflow-y-auto p-8 bg-background/50">
          {children}
        </section>
      </main>
    </div>
  );
}
