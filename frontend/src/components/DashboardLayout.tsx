import React, { useEffect, useState } from "react";
import { 
  LayoutDashboard, 
  Database, 
  Network,
  Sparkles,
  Cpu,
  Activity,
  ShieldCheck,
  Sun,
  Moon,
  Zap,
  Lock,
  MessageSquare,
  Send,
  Sparkle,
  ServerCrash,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Keyboard,
  X,
  FileText
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
  const [isCopilotOpen, setIsCopilotOpen] = useState(true);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ sender: "ai" | "user", text: string }>>([
    { sender: "ai", text: "Autopilot initialized. The active sweep has detected 4 idle VMs and 2 unattached disks. I've prepared a cost optimization reasoning chain." }
  ]);

  // Keyboard shortcut listener (Linear/Raycast inspired)
  useEffect(() => {
    let keyTimeout: any = null;
    let gPressed = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.getAttribute('contenteditable') === 'true')) {
        return;
      }

      const key = e.key.toLowerCase();

      // Show/hide keyboard shortcuts cheat sheet
      if (key === '?') {
        setIsHelpOpen(prev => !prev);
        e.preventDefault();
        return;
      }

      if (key === 'g') {
        gPressed = true;
        if (keyTimeout) clearTimeout(keyTimeout);
        keyTimeout = setTimeout(() => {
          gPressed = false;
        }, 1000);
        return;
      }

      if (gPressed) {
        switch (key) {
          case 'o':
            setCurrentTab('overview');
            e.preventDefault();
            break;
          case 't':
            setCurrentTab('topology');
            e.preventDefault();
            break;
          case 'r':
            setCurrentTab('recommendations');
            e.preventDefault();
            break;
          case 'w':
            setCurrentTab('workflow');
            e.preventDefault();
            break;
          case 'a':
            setCurrentTab('approvals');
            e.preventDefault();
            break;
          case 'e':
          case 'x':
            setCurrentTab('explainability');
            e.preventDefault();
            break;
          case 'l':
            setCurrentTab('audit');
            e.preventDefault();
            break;
        }
        gPressed = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (keyTimeout) clearTimeout(keyTimeout);
    };
  }, [setCurrentTab]);

  // Sync dark mode preference properly
  useEffect(() => {
    const root = window.document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [darkMode]);

  // Database Connection Health check
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

  // Compute stats for top telemetry bar
  const projectedSavings = recommendations.reduce((sum, r) => {
    if (r.status !== 'rolled_back' && r.status !== 'denied') {
      return sum + (r.saving_amount || 0);
    }
    return sum;
  }, 0);

  const activeRunId = activeRunDetails?.db_record?.id;
  const activeRunStatus = activeRunDetails?.db_record?.status || "idle";

  // Simulate Copilot conversation
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    setChatMessages(prev => [...prev, { sender: "user", text: userMsg }]);
    setChatInput("");
    setIsTyping(true);

    setTimeout(() => {
      let aiText = "I am continuously monitoring the active telemetry stream. Governance policies are currently enforced.";
      const lowerMsg = userMsg.toLowerCase();
      
      if (lowerMsg.includes("savings") || lowerMsg.includes("recommend")) {
        aiText = `Based on our latest sweeps, there is a total potential saving of $${projectedSavings.toFixed(2)} available. The highest savings action is pending approval. Tokens are prepared.`;
      } else if (lowerMsg.includes("vm") || lowerMsg.includes("idle")) {
        aiText = "Discovered idle Compute targets. Telemetry indicates average CPU is below 2% over 14 days. I have constructed resize/stop execution plans.";
      } else if (lowerMsg.includes("token") || lowerMsg.includes("approve")) {
        aiText = "Approvals require a signed JWT token with an operator signature. payloads are generated and can be signed from the **Approval Center** tab.";
      } else if (lowerMsg.includes("why")) {
        aiText = "Heuristic cross-reference between Azure Monitor metrics and FinOps baseline indicates these resources are underutilized with no active TCP connections.";
      }
      
      setChatMessages(prev => [...prev, { sender: "ai", text: aiText }]);
      setIsTyping(false);
    }, 1200);
  };

  const navItems = [
    { id: "overview", label: "Executive Overview", category: "Platform", icon: LayoutDashboard },
    { id: "topology", label: "Resource Topology", category: "Platform", icon: Network },
    { id: "recommendations", label: "Cost Recommendations", category: "Platform", icon: Sparkles },
    { id: "workflow", label: "Workflow Pipeline", category: "Autonomous Engine", icon: Cpu },
    { id: "approvals", label: "Security Gates", category: "Autonomous Engine", icon: ShieldCheck },
    { id: "explainability", label: "Reasoning Engine", category: "Autonomous Engine", icon: FileText },
    { id: "audit", label: "Audit Ledger", category: "Autonomous Engine", icon: Activity },
  ];

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans bg-dot-pattern transition-all duration-200">
      
      {/* 1. COLLAPSIBLE SIDEBAR NAVIGATION RAIL */}
      <aside className={`bg-card border-r border-border flex flex-col justify-between z-20 shadow-sm transition-all duration-300 ${isSidebarExpanded ? "w-[240px]" : "w-[68px]"}`}>
        <div className="flex flex-col h-full overflow-hidden">
          
          {/* Brand header / collapsible trigger */}
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="p-1.5 rounded-md bg-foreground text-background shadow-sm flex-shrink-0">
                <Zap className="h-4 w-4" />
              </div>
              {isSidebarExpanded && (
                <div className="fade-in-up">
                  <h1 className="font-bold text-xs tracking-tight text-foreground leading-tight">CloudOps <span className="text-primary">OS</span></h1>
                  <p className="text-[8px] text-muted-foreground font-mono font-medium tracking-wide">AUTOPILOT COGNITIVE</p>
                </div>
              )}
            </div>
            
            {isSidebarExpanded && (
              <button 
                onClick={() => setIsSidebarExpanded(false)}
                className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                title="Collapse Sidebar"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="p-2.5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
            {/* Category: Platform */}
            <div>
              {isSidebarExpanded && (
                <div className="px-3 pb-1 pt-2">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Platform</span>
                </div>
              )}
              <div className="space-y-0.5">
                {navItems.filter(item => item.category === "Platform").map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setCurrentTab(item.id)}
                      className={`w-full flex items-center rounded-md text-xs font-medium transition-all duration-200 ${
                        isActive 
                          ? "bg-secondary text-foreground font-semibold" 
                          : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                      } ${isSidebarExpanded ? "px-3 py-2 gap-2.5" : "p-2.5 justify-center"}`}
                      title={!isSidebarExpanded ? item.label : undefined}
                    >
                      <Icon className={`h-4 w-4 ${isActive ? "text-primary animate-status-pulse" : "text-muted-foreground"}`} />
                      {isSidebarExpanded && <span>{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Category: Autonomous Engine */}
            <div>
              {isSidebarExpanded && (
                <div className="px-3 pb-1 pt-2">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Autonomous Engine</span>
                </div>
              )}
              <div className="space-y-0.5">
                {navItems.filter(item => item.category === "Autonomous Engine").map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setCurrentTab(item.id)}
                      className={`w-full flex items-center rounded-md text-xs font-medium transition-all duration-200 relative ${
                        isActive 
                          ? "bg-secondary text-foreground font-semibold" 
                          : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                      } ${isSidebarExpanded ? "px-3 py-2 gap-2.5" : "p-2.5 justify-center"}`}
                      title={!isSidebarExpanded ? item.label : undefined}
                    >
                      <Icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                      {isSidebarExpanded && <span>{item.label}</span>}
                      {item.id === 'workflow' && activeRunStatus === 'running' && (
                        <span className={`absolute ${isSidebarExpanded ? "right-3" : "top-1.5 right-1.5"} flex h-1.5 w-1.5`}>
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
                        </span>
                      )}
                      {item.id === 'approvals' && activeRunStatus === 'blocked_on_approval' && (
                        <span className={`absolute ${isSidebarExpanded ? "right-3" : "top-1.5 right-1.5"} flex h-2 w-2 rounded-full bg-warning animate-approval-glow`} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </nav>

          {/* Footer Controls */}
          <div className="p-2.5 border-t border-border space-y-1.5 bg-muted/10">
            {/* Expand toggle when collapsed */}
            {!isSidebarExpanded && (
              <button
                onClick={() => setIsSidebarExpanded(true)}
                className="w-full flex items-center justify-center p-2 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                title="Expand Sidebar"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}

            {/* Health / Kernel Uplink indicator */}
            <div className={`flex items-center rounded-md bg-card border border-border text-[10px] ${isSidebarExpanded ? "px-2.5 py-1.5 justify-between" : "p-2 justify-center"}`}>
              <span className={`text-muted-foreground font-medium flex items-center gap-2 ${isSidebarExpanded ? "" : "hidden"}`}>
                {dbStatus === "healthy" ? <Activity className="h-3 w-3 text-success" /> : <ServerCrash className="h-3 w-3 text-danger" />}
                Kernel Uplink
              </span>
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${
                  dbStatus === "healthy" ? "bg-success shadow-[0_0_4px_rgba(16,185,129,0.8)] animate-status-pulse" : "bg-danger shadow-[0_0_4px_rgba(239,68,68,0.8)]"
                }`} />
                {isSidebarExpanded && <span className="font-semibold uppercase tracking-wider text-foreground text-[8px]">{dbStatus}</span>}
              </div>
            </div>

            {/* Theme Toggle Button */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`w-full flex items-center rounded-md border border-border hover:bg-secondary/50 text-[10px] font-medium text-muted-foreground transition-colors ${isSidebarExpanded ? "px-2.5 py-1.5 justify-between" : "p-2 justify-center"}`}
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              <div className="flex items-center gap-2">
                {darkMode ? <Moon className="h-3 w-3 text-primary" /> : <Sun className="h-3 w-3 text-warning" />}
                {isSidebarExpanded && <span>{darkMode ? "Dark Appearance" : "Light Appearance"}</span>}
              </div>
            </button>

            {/* Help / Shortcuts Button */}
            <button
              onClick={() => setIsHelpOpen(true)}
              className={`w-full flex items-center rounded-md border border-border hover:bg-secondary/50 text-[10px] font-medium text-muted-foreground transition-colors ${isSidebarExpanded ? "px-2.5 py-1.5 justify-between" : "p-2 justify-center"}`}
              title="Show Keyboard Shortcuts (?)"
            >
              <div className="flex items-center gap-2">
                <Keyboard className="h-3 w-3" />
                {isSidebarExpanded && <span>Shortcuts Guide</span>}
              </div>
              {isSidebarExpanded && <span className="text-[9px] font-mono px-1 rounded bg-secondary">?</span>}
            </button>
          </div>

        </div>
      </aside>

      {/* 2. MAIN VIEWPORT & HEADER CONTAINER */}
      <main className="flex-1 flex flex-col overflow-hidden bg-background relative transition-all duration-200">
        
        {/* TOP TELEMETRY BAR */}
        <header className="h-14 border-b border-border bg-background/80 backdrop-blur-md px-6 flex items-center justify-between z-10 sticky top-0 transition-all duration-200">
          
          {/* Breadcrumbs / Page name */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
            <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground/80">
              {navItems.find((n) => n.id === currentTab)?.category}
            </span>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-foreground font-semibold">
              {navItems.find((n) => n.id === currentTab)?.label}
            </span>
          </div>

          {/* Core Operating System Telemetry stats */}
          <div className="hidden lg:flex items-center gap-6 text-xs border border-border/80 px-4 py-1.5 rounded-lg bg-card/60">
            {/* Telemetry Indicator 1: Run Status */}
            <div className="flex items-center gap-2 border-r border-border pr-5">
              <span className="text-muted-foreground font-medium text-[10px] uppercase tracking-wider">Run Status:</span>
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${
                  activeRunStatus === "running" ? "bg-primary animate-status-pulse" :
                  activeRunStatus === "blocked_on_approval" ? "bg-warning animate-approval-glow" :
                  activeRunStatus === "completed" ? "bg-success" :
                  activeRunStatus === "failed" ? "bg-danger" : "bg-muted-foreground"
                }`} />
                <span className="font-mono text-[11px] font-semibold text-foreground uppercase">
                  {activeRunStatus === "running" ? `Running (${activeRunId?.slice(0, 8)})` :
                   activeRunStatus === "blocked_on_approval" ? "Blocked on Gate" :
                   activeRunStatus === "completed" ? "Ready / Finished" :
                   activeRunStatus === "failed" ? "Failed" : "Idle State"}
                </span>
              </div>
            </div>

            {/* Telemetry Indicator 2: Projected Savings */}
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-medium text-[10px] uppercase tracking-wider">Projected Savings:</span>
              <span className="font-mono text-xs font-bold text-foreground text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                ${projectedSavings.toFixed(2)}/mo
              </span>
            </div>
          </div>

          {/* Collapsible Copilot toggle + Security Status */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-md bg-success/10 text-success border border-success/20">
              <Lock className="h-3 w-3" />
              <span>Guardrails Active</span>
            </div>
            
            <button
              onClick={() => setIsCopilotOpen(!isCopilotOpen)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-[10px] font-semibold transition-all duration-200 ${
                isCopilotOpen 
                  ? "bg-foreground text-background border-foreground shadow-sm" 
                  : "bg-card text-foreground border-border hover:bg-secondary/50"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Copilot Sidebar</span>
            </button>
          </div>
        </header>

        {/* 3. SUB-VIEW PANEL LAYOUT SYSTEM */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Main scrollable view panel */}
          <section className="flex-1 overflow-y-auto p-6 lg:p-8 custom-scrollbar">
            <div className="max-w-6xl mx-auto space-y-6 fade-in-up">
              {children}
            </div>
          </section>

          {/* sliding Copilot Sidebar container */}
          {isCopilotOpen && (
            <aside className="w-[320px] bg-card border-l border-border flex flex-col justify-between z-10 shadow-sm slide-in-right transition-all duration-200">
              
              {/* Copilot Header */}
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded bg-secondary text-foreground">
                      <Sparkle className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <h3 className="text-xs font-semibold text-foreground">Autopilot Copilot</h3>
                  </div>
                  <span className="flex h-1.5 w-1.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success"></span>
                  </span>
                </div>

                {/* Sub-Agent Swarm Monitor */}
                <div className="mt-3 p-2.5 bg-secondary/30 border border-border rounded-lg">
                  <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Swarm Agent Status</div>
                  <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-[10px] font-medium font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-foreground">Audit Agent</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-success animate-status-pulse" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-foreground">Decision Agent</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-status-pulse" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Telemetry</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Orchestrator</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Chat Thread */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 custom-scrollbar bg-muted/5">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex gap-2.5 ${msg.sender === "user" ? "flex-row-reverse" : "flex-row"}`}>
                    <div className={`flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-[10px] ${
                      msg.sender === 'user' ? 'bg-secondary text-foreground border border-border font-mono' : 'bg-foreground text-background font-mono'
                    }`}>
                      {msg.sender === 'user' ? 'OP' : 'AI'}
                    </div>
                    <div className={`flex flex-col max-w-[80%] ${msg.sender === "user" ? "items-end" : "items-start"}`}>
                      <div className={`px-2.5 py-1.5 rounded-lg text-xs leading-relaxed ${
                        msg.sender === "user" 
                          ? "bg-primary text-primary-foreground shadow-sm" 
                          : "bg-card border border-border text-foreground shadow-sm"
                      }`}>
                        {msg.text.split('`').map((chunk, i) => 
                          i % 2 === 1 ? <code key={i} className="font-mono text-[10px] px-1 py-0.5 rounded bg-secondary text-primary font-semibold">{chunk}</code> : chunk
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex gap-2.5 flex-row">
                    <div className="flex-shrink-0 h-6 w-6 rounded-full bg-foreground text-background flex items-center justify-center font-mono text-[10px]">
                      AI
                    </div>
                    <div className="px-2.5 py-2 rounded-lg bg-card border border-border flex items-center gap-1 shadow-sm">
                      <span className="h-1 w-1 bg-muted-foreground rounded-full animate-bounce"></span>
                      <span className="h-1 w-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                      <span className="h-1 w-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input form */}
              <form onSubmit={handleSendChat} className="p-3 bg-card border-t border-border relative">
                <input
                  type="text"
                  placeholder="Ask Copilot to analyze optimizations..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={isTyping}
                  className="w-full bg-background border border-border rounded-md pl-3 pr-8 py-2 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all disabled:opacity-50 font-mono"
                />
                <button 
                  type="submit"
                  disabled={isTyping || !chatInput.trim()}
                  className="absolute right-5 top-5 text-muted-foreground hover:text-primary disabled:opacity-50 transition-colors"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            </aside>
          )}

        </div>
      </main>

      {/* 4. KEYBOARD SHORTCUTS CHEATSHEET OVERLAY MODAL */}
      {isHelpOpen && (
        <div className="fixed inset-0 bg-background/85 backdrop-blur-md flex items-center justify-center z-50 fade-in-up">
          <div className="bg-card border border-border p-6 rounded-xl max-w-md w-full shadow-2xl space-y-4 relative">
            <button 
              onClick={() => setIsHelpOpen(false)}
              className="absolute right-4 top-4 p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <Keyboard className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-sm text-foreground">Global Shortkeys & Commands</h3>
            </div>

            <div className="space-y-3.5 text-xs">
              <p className="text-muted-foreground leading-relaxed">
                Press the sequence keys consecutively to navigate. Similar to Linear and Raycast commands:
              </p>
              
              <div className="space-y-2 font-mono">
                <div className="flex justify-between items-center py-1 border-b border-border/40">
                  <span className="text-muted-foreground font-sans">Executive Overview</span>
                  <div className="flex gap-1">
                    <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary text-[10px] font-bold shadow-sm">G</kbd>
                    <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary text-[10px] font-bold shadow-sm">O</kbd>
                  </div>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border/40">
                  <span className="text-muted-foreground font-sans">Resource Topology Map</span>
                  <div className="flex gap-1">
                    <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary text-[10px] font-bold shadow-sm">G</kbd>
                    <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary text-[10px] font-bold shadow-sm">T</kbd>
                  </div>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border/40">
                  <span className="text-muted-foreground font-sans">Cost Recommendations</span>
                  <div className="flex gap-1">
                    <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary text-[10px] font-bold shadow-sm">G</kbd>
                    <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary text-[10px] font-bold shadow-sm">R</kbd>
                  </div>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border/40">
                  <span className="text-muted-foreground font-sans">Workflow Execution Pipeline</span>
                  <div className="flex gap-1">
                    <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary text-[10px] font-bold shadow-sm">G</kbd>
                    <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary text-[10px] font-bold shadow-sm">W</kbd>
                  </div>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border/40">
                  <span className="text-muted-foreground font-sans">Security Approvals Gates</span>
                  <div className="flex gap-1">
                    <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary text-[10px] font-bold shadow-sm">G</kbd>
                    <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary text-[10px] font-bold shadow-sm">A</kbd>
                  </div>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border/40">
                  <span className="text-muted-foreground font-sans">Reasoning Explainability</span>
                  <div className="flex gap-1">
                    <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary text-[10px] font-bold shadow-sm">G</kbd>
                    <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary text-[10px] font-bold shadow-sm">E</kbd>
                  </div>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border/40">
                  <span className="text-muted-foreground font-sans">Audit Ledger & Events</span>
                  <div className="flex gap-1">
                    <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary text-[10px] font-bold shadow-sm">G</kbd>
                    <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary text-[10px] font-bold shadow-sm">L</kbd>
                  </div>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border/40 font-sans">
                  <span className="text-muted-foreground">Toggle this Guide</span>
                  <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary text-[10px] font-mono font-bold shadow-sm">?</kbd>
                </div>
              </div>
            </div>

            <div className="pt-2 text-center">
              <button 
                onClick={() => setIsHelpOpen(false)}
                className="px-4 py-2 rounded bg-foreground text-background text-xs font-semibold hover:opacity-90 transition-opacity w-full"
              >
                Close Shortcuts Guide
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
