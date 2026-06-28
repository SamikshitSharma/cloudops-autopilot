import React, { useEffect, useState } from "react";
import { 
  Folder,
  FileText,
  Terminal,
  Activity,
  ServerCrash,
  Moon,
  Sun,
  Keyboard,
  X,
  Search,
  Maximize2,
  Minimize2
} from "lucide-react";
import { api } from "../api/client";

interface DashboardLayoutProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  children: React.ReactNode;
  recommendations?: any[];
  activeRunDetails?: any;
}

export function DashboardLayout({ 
  currentTab, 
  setCurrentTab, 
  children,
  recommendations = [],
  activeRunDetails = null
}: DashboardLayoutProps) {
  const [darkMode, setDarkMode] = useState(true);
  const [dbStatus, setDbStatus] = useState<"healthy" | "unhealthy" | "loading">("loading");
  
  // Collapse/Expand state management
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isConsoleOpen, setIsConsoleOpen] = useState(true);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [consoleHeight, setConsoleHeight] = useState<"compact" | "expanded">("compact");

  // Sync dark mode preference properly using the root element class list
  useEffect(() => {
    const root = window.document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [darkMode]);

  // Database uplink checks
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

  // Keyboard shortcut listener infrastructure
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.getAttribute('contenteditable') === 'true')) {
        return;
      }

      const key = e.key.toLowerCase();
      const isMeta = e.metaKey || e.ctrlKey;

      // Cmd+B toggles sidebar
      if (isMeta && key === 'b') {
        setIsSidebarOpen(prev => !prev);
        e.preventDefault();
      }
      
      // Cmd+J toggles console
      if (isMeta && key === 'j') {
        setIsConsoleOpen(prev => !prev);
        e.preventDefault();
      }

      // ? toggles shortcuts modal
      if (key === '?') {
        setIsShortcutsOpen(prev => !prev);
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navItems = [
    { id: "overview", label: "workspace.config", file: "workspace.config" },
    { id: "topology", label: "topology.schema", file: "topology.schema" },
    { id: "recommendations", label: "optimizations.json", file: "optimizations.json" },
    { id: "workflow", label: "compile.workflow", file: "compile.workflow" },
    { id: "approvals", label: "compliance.gate", file: "compliance.gate" },
    { id: "explainability", label: "reasoning.engine", file: "reasoning.engine" },
    { id: "audit", label: "audit.terminal", file: "audit.terminal" },
  ];

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans select-none antialiased transition-all duration-200">
      
      {/* 1. ZONE 1: THE NAVIGATOR (Left Column) */}
      {isSidebarOpen && (
        <aside className="w-[240px] bg-card border-r border-border flex flex-col justify-between z-20 transition-all duration-300">
          <div className="flex flex-col h-full overflow-hidden">
            
            {/* Header: Title */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs tracking-tight text-foreground leading-tight">CloudOps <span className="text-primary">OS</span></span>
                <span className="text-[8px] bg-secondary text-secondary-foreground font-mono px-1 rounded">v6.0</span>
              </div>
              <p className="text-[8px] text-muted-foreground font-mono font-medium tracking-wide mt-1">AUTOPILOT COGNITIVE</p>
            </div>

            {/* Search Input bar */}
            <div className="p-2 border-b border-border flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search files..."
                disabled
                className="w-full bg-transparent text-[11px] placeholder-muted-foreground focus:outline-none font-mono"
              />
              <span className="text-[8px] font-mono text-muted-foreground bg-secondary px-1 rounded border border-border">⌘K</span>
            </div>

            {/* Monospace Directory File Explorer */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar font-mono text-[11px]">
              
              {/* Directory 1: Subscriptions */}
              <div>
                <div className="flex items-center gap-1.5 px-2 py-1 text-muted-foreground font-semibold">
                  <Folder className="h-3 w-3 text-muted-foreground" />
                  <span>SUBSCRIPTIONS</span>
                </div>
                <div className="pl-4 space-y-0.5 mt-0.5">
                  <div className="px-2 py-1 rounded bg-secondary/35 text-foreground font-semibold flex items-center gap-1.5">
                    <span className="h-1 w-1 bg-primary rounded-full" />
                    <span>default-sub</span>
                  </div>
                </div>
              </div>

              {/* Directory 2: Workspace Files */}
              <div>
                <div className="flex items-center gap-1.5 px-2 py-1 text-muted-foreground font-semibold">
                  <Folder className="h-3 w-3 text-muted-foreground" />
                  <span>WORKSPACES</span>
                </div>
                
                <div className="pl-4 space-y-0.5 mt-0.5">
                  {navItems.map((item) => {
                    const isActive = currentTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setCurrentTab(item.id)}
                        className={`w-full text-left px-2 py-1 rounded flex items-center gap-1.5 transition-colors ${
                          isActive 
                            ? "bg-secondary text-primary font-bold border-l-2 border-primary" 
                            : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                        }`}
                      >
                        <FileText className="h-3 w-3 text-muted-foreground" />
                        <span>{item.file}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Footer Workspace controls */}
            <div className="p-3 border-t border-border space-y-2 bg-card">
              {/* Health Indicator */}
              <div className="flex items-center justify-between text-[10px] px-2 py-1.5 rounded bg-background border border-border">
                <span className="text-muted-foreground font-mono flex items-center gap-2">
                  {dbStatus === "healthy" ? <Activity className="h-3.5 w-3.5 text-success animate-status-pulse" /> : <ServerCrash className="h-3.5 w-3.5 text-danger" />}
                  Kernel Uplink
                </span>
                <span className="font-mono text-[9px] uppercase font-bold text-foreground">{dbStatus}</span>
              </div>

              {/* Toggle Buttons */}
              <div className="flex gap-1.5">
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="flex-1 flex justify-center py-1.5 rounded border border-border bg-background hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
                  title="Toggle Theme appearance"
                >
                  {darkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                </button>
                
                <button
                  onClick={() => setIsShortcutsOpen(true)}
                  className="flex-1 flex justify-center py-1.5 rounded border border-border bg-background hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
                  title="Keyboard Shortcuts Guide (?)"
                >
                  <Keyboard className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

          </div>
        </aside>
      )}

      {/* 2. ZONE 2: ACTIVE EDITOR CANVAS (Center Column) */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        
        {/* Main Editor Canvas Workspace */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Main viewport frame */}
          <section className="flex-1 flex flex-col overflow-hidden relative">
            
            {/* Top Workspace Path Bar */}
            <header className="h-10 border-b border-border bg-card px-4 flex items-center justify-between text-[11px] font-mono">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>default-sub</span>
                <span>/</span>
                <span className="text-foreground font-semibold">{navItems.find(n => n.id === currentTab)?.file || "workspace.config"}</span>
              </div>
              <div className="text-[10px] text-muted-foreground">
                Type: UTF-8
              </div>
            </header>

            {/* Dynamic View Panel Renderer */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
              <div className="max-w-4xl mx-auto space-y-6 fade-in-up">
                {children}
              </div>
            </div>

          </section>

          {/* 3. ZONE 3: THE VAULT / INSPECTOR (Right Column) */}
          <aside className="w-[280px] bg-card border-l border-border flex flex-col z-10">
            <header className="h-10 border-b border-border bg-card px-4 flex items-center justify-between text-[11px] font-mono font-semibold text-foreground">
              <span>INSPECTOR</span>
              <span className="text-[9px] text-muted-foreground">progressive disclosure</span>
            </header>

            <div className="flex-1 p-4 space-y-4 overflow-y-auto custom-scrollbar font-mono text-[11px]">
              
              {/* Context Anomaly / Approvals Progressive display */}
              <div className="border border-border/80 p-4 rounded-lg bg-background/50 shadow-elevation-1 space-y-3.5">
                <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest pb-1.5 border-b border-border">Active Context</div>
                
                {/* Default Silent Mode placeholder if no node focused */}
                <div className="space-y-3 text-muted-foreground leading-relaxed">
                  <p>Workspace default-sub is currently quiet.</p>
                  <p>Select a config recommendation ledger file, audit log timeline, or topology canvas node to verify compliance details progressively here.</p>
                </div>
              </div>

              {/* System Compliance status block */}
              <div className="p-3 border border-border rounded-lg bg-secondary/35 space-y-2">
                <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Compliance Registry</div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Guardrails</span>
                    <span className="text-foreground font-semibold">Active</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Security Check</span>
                    <span className="text-success font-semibold">Passed</span>
                  </div>
                </div>
              </div>

            </div>
          </aside>

        </div>

        {/* 4. ZONE 4: THE SUBSTRATE / SWARM CONSOLE (Bottom Collapsible Drawer) */}
        {isConsoleOpen && (
          <footer className={`bg-card border-t border-border flex flex-col z-20 transition-all duration-300 ${
            consoleHeight === "expanded" ? "h-[320px]" : "h-[120px]"
          }`}>
            
            {/* Console top controller bar */}
            <div className="h-8 border-b border-border bg-card/65 px-4 flex items-center justify-between text-[10px] font-mono">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Terminal className="h-3 w-3" />
                <span className="font-semibold text-foreground">SWARM RUNTIME COMPILER stdout</span>
              </div>
              
              {/* Expand / Collapse size controls */}
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setConsoleHeight(consoleHeight === "compact" ? "expanded" : "compact")}
                  className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                  title={consoleHeight === "compact" ? "Expand Console Height" : "Compact Console Height"}
                >
                  {consoleHeight === "compact" ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
                </button>
                <button 
                  onClick={() => setIsConsoleOpen(false)}
                  className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                  title="Collapse Console Drawer"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Swarm stdout monospace text logs */}
            <div className="flex-1 p-3 overflow-y-auto bg-background/45 font-mono text-[11px] text-muted-foreground space-y-1.5 custom-scrollbar">
              <div>10:54:02  [SYSTEM] Workflow coordinator initialized with scenario "Sweep Idle"</div>
              <div>10:54:05  [INVENTORY_AGENT] Started scanning subscription resources...</div>
              <div>10:54:08  [INVENTORY_AGENT] Discovered idle candidate target VM 'vm-dev-test'</div>
              <div>10:54:10  [TELEMETRY_AGENT] Fetching CPU metrics from Azure Monitor for vm-dev-test</div>
              <div>10:54:12  [DECISION_AGENT] Match confirmed. Proposing stop action. Confidence: 98%</div>
              <div className="text-warning">10:54:15  [AUDIT_AGENT] Compliancy check: target VM requires HITL operator gate approval.</div>
              <div className="text-primary font-bold">10:54:16  [SYSTEM] Pipeline run wf-run-009 transitioned state: BLOCKED_ON_APPROVAL</div>
            </div>

          </footer>
        )}

      </div>

      {/* 5. KEYBOARD SHORTCUTS DIALOG OVERLAY */}
      {isShortcutsOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 fade-in-up">
          <div className="bg-card border border-border p-6 rounded-lg max-w-sm w-full shadow-elevation-2 space-y-4 relative">
            <button 
              onClick={() => setIsShortcutsOpen(false)}
              className="absolute right-4 top-4 p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="pb-2 border-b border-border">
              <h3 className="font-bold text-xs text-foreground uppercase tracking-wider font-mono">Workspace Shortcuts</h3>
            </div>

            <div className="space-y-2.5 text-[11px] font-mono">
              <div className="flex justify-between items-center py-1 border-b border-border/40">
                <span className="text-muted-foreground">Toggle Left Navigator</span>
                <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary text-[10px] font-bold shadow-sm">⌘B</kbd>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/40">
                <span className="text-muted-foreground">Toggle Bottom Console</span>
                <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary text-[10px] font-bold shadow-sm">⌘J</kbd>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/40">
                <span className="text-muted-foreground">View Shortcuts Guide</span>
                <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary text-[10px] font-bold shadow-sm">?</kbd>
              </div>
            </div>

            <div className="pt-2">
              <button 
                onClick={() => setIsShortcutsOpen(false)}
                className="px-4 py-2 rounded bg-foreground text-background text-xs font-semibold hover:opacity-90 transition-opacity w-full font-mono"
              >
                Close shortcuts menu
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
