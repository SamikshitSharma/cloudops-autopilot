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
  Keyboard,
  X,
  FileText,
  Bell,
  Search,
  CheckCircle,
  HelpCircle as QuestionIcon,
  Radio
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
  const [notifications, setNotifications] = useState<Array<{ id: string; text: string; type: "info" | "success" | "warning" }>>([
    { id: "1", text: "Autopilot scanning routine activated.", type: "info" },
    { id: "2", text: "Awaiting approval for stop-VM payload.", type: "warning" }
  ]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const [chatMessages, setChatMessages] = useState<Array<{ sender: "ai" | "user", text: string }>>([
    { sender: "ai", text: "CloudOps OS kernel linked. Current sweep detected idle Compute and unattached Block Storage targets. Reasoning chain generated." }
  ]);

  // Keyboard shortcut listener
  useEffect(() => {
    let keyTimeout: any = null;
    let gPressed = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.getAttribute('contenteditable') === 'true')) {
        return;
      }

      const key = e.key.toLowerCase();

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
          case 'i':
            setCurrentTab('inventory');
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
          case 'b':
            setCurrentTab('eventbus');
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

  // Sync dark mode preference
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
      let aiText = "Active telemetry feeds are normal. Swarm compliance metrics are operational.";
      const lowerMsg = userMsg.toLowerCase();
      
      if (lowerMsg.includes("savings") || lowerMsg.includes("recommend")) {
        aiText = `Identified cost reductions amounting to $${projectedSavings.toFixed(2)}/mo. The largest optimizations require a manual gate signature in the **Approval Center**.`;
      } else if (lowerMsg.includes("vm") || lowerMsg.includes("idle")) {
        aiText = "Idle instances detected with under 2% average CPU utilization over 7 days. Stopping vm targets would secure maximum cost performance.";
      } else if (lowerMsg.includes("token") || lowerMsg.includes("approve")) {
        aiText = "Approval payloads require an operator cryptographic token signature. Confirm VM stop commands in the **Approval Center**.";
      } else if (lowerMsg.includes("why") || lowerMsg.includes("reason")) {
        aiText = "Autonomous analysis links low CPU usage and zero network connections to derive idle state heuristics.";
      }
      
      setChatMessages(prev => [...prev, { sender: "ai", text: aiText }]);
      setIsTyping(false);
    }, 1000);
  };

  const navItems = [
    { id: "overview", label: "Executive Control", category: "Governance & Control", icon: LayoutDashboard },
    { id: "inventory", label: "Resource Inventory", category: "Governance & Control", icon: Database },
    { id: "topology", label: "Tenant Topology", category: "Governance & Control", icon: Network },
    { id: "recommendations", label: "Cost Proposals", category: "Governance & Control", icon: Sparkles },
    { id: "workflow", label: "Orchestration Swarm", category: "Cognitive Engine", icon: Cpu },
    { id: "approvals", label: "Security Gates", category: "Cognitive Engine", icon: ShieldCheck },
    { id: "explainability", label: "Reasoning Path", category: "Cognitive Engine", icon: FileText },
    { id: "eventbus", label: "Event Bus", category: "Cognitive Engine", icon: Radio },
    { id: "audit", label: "Audit Ledger", category: "Cognitive Engine", icon: Activity },
  ];

  return (
    <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden font-sans bg-dot-pattern transition-all duration-200">
      
      {/* 1. COLLAPSIBLE SIDEBAR */}
      <aside className={`bg-card border-r border-border flex flex-col justify-between z-20 shadow-sm transition-all duration-300 ${isSidebarExpanded ? "w-60" : "w-16"}`}>
        <div className="flex flex-col h-full overflow-hidden">
          
          {/* Sidebar Brand Header */}
          <div className="p-4 border-b border-border flex items-center justify-between min-h-[57px]">
            <div className="flex items-center gap-2 overflow-hidden select-none">
              <div className="p-1.5 rounded bg-primary text-primary-foreground shadow flex-shrink-0 animate-pulse-ring">
                <Zap className="h-4 w-4" />
              </div>
              {isSidebarExpanded && (
                <div className="fade-in-up">
                  <h1 className="font-extrabold text-xs tracking-tight text-foreground uppercase leading-none">CloudOps <span className="text-primary">Autopilot</span></h1>
                  <span className="text-[8px] text-muted-foreground font-mono font-bold tracking-widest uppercase">SWARM CONTROL OS</span>
                </div>
              )}
            </div>
            
            {isSidebarExpanded && (
              <button 
                onClick={() => setIsSidebarExpanded(false)}
                className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                title="Collapse Panel"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Workspace tenant selector */}
          {isSidebarExpanded && (
            <div className="p-3 mx-3 my-2 bg-secondary/30 rounded border border-border/80 text-[10px] flex items-center justify-between">
              <div className="overflow-hidden">
                <p className="font-mono text-muted-foreground leading-none">TENANT_ID</p>
                <p className="font-mono font-bold text-foreground truncate mt-0.5">azure-production-west-01</p>
              </div>
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            </div>
          )}

          {/* Sidebar Navigation */}
          <nav className="p-2 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
            {/* Group: Governance & Control */}
            <div>
              {isSidebarExpanded && (
                <div className="px-3 pb-1 pt-1">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Governance & Control</span>
                </div>
              )}
              <div className="space-y-0.5">
                {navItems.filter(item => item.category === "Governance & Control").map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setCurrentTab(item.id)}
                      className={`w-full flex items-center rounded text-xs font-semibold transition-all duration-150 ${
                        isActive 
                          ? "bg-secondary text-primary font-bold border-l-2 border-primary" 
                          : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                      } ${isSidebarExpanded ? "px-3 py-2 gap-3" : "p-2.5 justify-center"}`}
                      title={!isSidebarExpanded ? item.label : undefined}
                    >
                      <Icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                      {isSidebarExpanded && <span>{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Group: Cognitive Engine */}
            <div>
              {isSidebarExpanded && (
                <div className="px-3 pb-1 pt-1">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Cognitive Engine</span>
                </div>
              )}
              <div className="space-y-0.5">
                {navItems.filter(item => item.category === "Cognitive Engine").map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setCurrentTab(item.id)}
                      className={`w-full flex items-center rounded text-xs font-semibold transition-all duration-150 relative ${
                        isActive 
                          ? "bg-secondary text-primary font-bold border-l-2 border-primary" 
                          : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                      } ${isSidebarExpanded ? "px-3 py-2 gap-3" : "p-2.5 justify-center"}`}
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
                        <span className={`absolute ${isSidebarExpanded ? "right-3" : "top-1.5 right-1.5"} flex h-2 w-2 rounded bg-warning animate-approval-glow`} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </nav>

          {/* Sidebar Footer Controls */}
          <div className="p-2 border-t border-border space-y-1.5 bg-muted/10">
            {!isSidebarExpanded && (
              <button
                onClick={() => setIsSidebarExpanded(true)}
                className="w-full flex items-center justify-center p-2 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                title="Expand Sidebar"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}

            {/* Platform health status check */}
            <div className={`flex items-center rounded bg-card border border-border text-[9px] ${isSidebarExpanded ? "px-2 py-1.5 justify-between" : "p-1.5 justify-center"}`}>
              <span className={`text-muted-foreground font-semibold flex items-center gap-1.5 ${isSidebarExpanded ? "" : "hidden"}`}>
                {dbStatus === "healthy" ? <Activity className="h-3 w-3 text-success" /> : <ServerCrash className="h-3 w-3 text-danger" />}
                Kernel Uplink
              </span>
              <div className="flex items-center gap-1">
                <span className={`h-1.5 w-1.5 rounded-full ${
                  dbStatus === "healthy" ? "bg-success shadow-[0_0_4px_rgba(16,185,129,0.8)] animate-success-glow" : "bg-danger shadow-[0_0_4px_rgba(239,68,68,0.8)]"
                }`} />
                {isSidebarExpanded && <span className="font-mono text-foreground uppercase tracking-widest font-extrabold">{dbStatus}</span>}
              </div>
            </div>

            {/* Dark Mode toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`w-full flex items-center rounded border border-border hover:bg-secondary/50 text-[10px] font-semibold text-muted-foreground transition-colors ${isSidebarExpanded ? "px-2.5 py-1.5 justify-between" : "p-2 justify-center"}`}
            >
              <div className="flex items-center gap-2">
                {darkMode ? <Moon className="h-3.5 w-3.5 text-primary" /> : <Sun className="h-3.5 w-3.5 text-warning" />}
                {isSidebarExpanded && <span>{darkMode ? "Dark Theme" : "Light Theme"}</span>}
              </div>
            </button>

            {/* Shortcuts Guide toggle */}
            <button
              onClick={() => setIsHelpOpen(true)}
              className={`w-full flex items-center rounded border border-border hover:bg-secondary/50 text-[10px] font-semibold text-muted-foreground transition-colors ${isSidebarExpanded ? "px-2.5 py-1.5 justify-between" : "p-2 justify-center"}`}
              title="Show Keyboard Shortcuts (?)"
            >
              <div className="flex items-center gap-2">
                <Keyboard className="h-3.5 w-3.5" />
                {isSidebarExpanded && <span>Shortcuts Guide</span>}
              </div>
              {isSidebarExpanded && <span className="text-[9px] font-mono px-1 rounded bg-secondary">?</span>}
            </button>
          </div>

        </div>
      </aside>

      {/* 2. MAIN VIEWPORT */}
      <main className="flex-1 flex flex-col overflow-hidden bg-background relative transition-all duration-200">
        
        {/* TOP STATUS HEADER */}
        <header className="h-14 border-b border-border bg-card/60 backdrop-blur px-6 flex items-center justify-between z-10 sticky top-0 transition-all duration-200">
          
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-semibold">
            <span className="text-[10px] tracking-wider uppercase font-extrabold text-muted-foreground/80">
              {navItems.find((n) => n.id === currentTab)?.category}
            </span>
            <span className="text-muted-foreground/30">/</span>
            <span className="text-foreground font-bold text-sm leading-none">
              {navItems.find((n) => n.id === currentTab)?.label}
            </span>
          </div>

          {/* Quick Metrics display */}
          <div className="hidden md:flex items-center gap-5 border border-border px-3.5 py-1.5 rounded-lg bg-card/85">
            <div className="flex items-center gap-2 border-r border-border pr-5">
              <span className="text-muted-foreground font-extrabold text-[9px] uppercase tracking-wider">Swarm Engine:</span>
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${
                  activeRunStatus === "running" ? "bg-primary animate-status-pulse" :
                  activeRunStatus === "blocked_on_approval" ? "bg-warning animate-approval-glow" :
                  activeRunStatus === "completed" ? "bg-success" :
                  activeRunStatus === "failed" ? "bg-danger" : "bg-muted-foreground/50"
                }`} />
                <span className="font-mono text-[10px] font-bold text-foreground uppercase">
                  {activeRunStatus === "running" ? `Running [${activeRunId?.slice(0, 8)}]` :
                   activeRunStatus === "blocked_on_approval" ? "Action Paused" :
                   activeRunStatus === "completed" ? "Synchronized" :
                   activeRunStatus === "failed" ? "Failed" : "Idle"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-extrabold text-[9px] uppercase tracking-wider">Identified Savings:</span>
              <span className="font-mono text-[11px] font-extrabold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                ${projectedSavings.toFixed(2)}/mo
              </span>
            </div>
          </div>

          {/* Action Center & Copilot Switch */}
          <div className="flex items-center gap-3">
            {/* Notification Center Trigger */}
            <div className="relative">
              <button 
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors relative"
              >
                <Bell className="h-4 w-4" />
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1 h-1.5 w-1.5 bg-danger rounded-full" />
                )}
              </button>

              {/* Notification Overlay Popover */}
              {isNotificationsOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-card border border-border rounded-lg shadow-2xl z-30 p-4 space-y-2 fade-in-up">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <span className="text-xs font-bold text-foreground">Alert Hub</span>
                    <button 
                      onClick={() => setNotifications([])}
                      className="text-[10px] text-primary font-bold hover:underline"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="space-y-2">
                    {notifications.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground italic text-center py-4">No new system alerts.</p>
                    ) : (
                      notifications.map((n) => (
                        <div key={n.id} className="p-2 bg-secondary/20 rounded border border-border text-[10px] flex justify-between items-start">
                          <p className="text-slate-300 font-semibold">{n.text}</p>
                          <span className={`h-1.5 w-1.5 rounded-full shrink-0 mt-1 ml-2 ${
                            n.type === "warning" ? "bg-warning" : "bg-primary"
                          }`} />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setIsCopilotOpen(!isCopilotOpen)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded border text-[10px] font-bold tracking-wider uppercase transition-all ${
                isCopilotOpen 
                  ? "bg-foreground text-background border-foreground shadow" 
                  : "bg-card text-foreground border-border hover:bg-secondary/50"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Copilot</span>
            </button>
          </div>
        </header>

        {/* 3. CORE PAGE AREA */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Scrollable view container */}
          <section className="flex-1 overflow-y-auto p-6 lg:p-8 custom-scrollbar">
            <div className="max-w-6xl mx-auto space-y-6 fade-in-up">
              {children}
            </div>
          </section>

          {/* AI Copilot Panel */}
          {isCopilotOpen && (
            <aside className="w-80 bg-card border-l border-border flex flex-col justify-between z-10 shadow-lg slide-in-right transition-all">
              
              {/* Copilot Header */}
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded bg-secondary text-foreground">
                      <Sparkle className="h-4 w-4 text-primary" />
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Autopilot Swarm</h3>
                  </div>
                  <span className="flex h-1.5 w-1.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success"></span>
                  </span>
                </div>

                {/* Sub-Agent cluster status monitor */}
                <div className="mt-3 p-3 bg-secondary/20 border border-border rounded-lg">
                  <div className="text-[8px] font-extrabold text-muted-foreground uppercase tracking-widest mb-2">Cognitive Nodes</div>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[10px] font-semibold font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-foreground">Audit Agent</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-success animate-success-glow" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-foreground">Decision Agent</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-ring" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Telemetry Node</span>
                      <span className="h-1.5 w-1.5 rounded bg-muted-foreground/30" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Risk Policy</span>
                      <span className="h-1.5 w-1.5 rounded bg-muted-foreground/30" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Chat Log threads */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar bg-secondary/5">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex gap-2.5 ${msg.sender === "user" ? "flex-row-reverse" : "flex-row"}`}>
                    <div className={`flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold font-mono ${
                      msg.sender === 'user' ? 'bg-secondary text-foreground border border-border' : 'bg-foreground text-background'
                    }`}>
                      {msg.sender === 'user' ? 'OP' : 'AI'}
                    </div>
                    <div className={`flex flex-col max-w-[80%] ${msg.sender === "user" ? "items-end" : "items-start"}`}>
                      <div className={`px-3 py-2 rounded-lg text-xs leading-relaxed ${
                        msg.sender === "user" 
                          ? "bg-primary text-primary-foreground shadow-sm font-semibold" 
                          : "bg-card border border-border text-foreground shadow-sm"
                      }`}>
                        {msg.text.split('`').map((chunk, i) => 
                          i % 2 === 1 ? <code key={i} className="font-mono text-[9px] px-1 py-0.5 rounded bg-secondary text-primary font-bold">{chunk}</code> : chunk
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
                    <div className="px-3 py-2 rounded-lg bg-card border border-border flex items-center gap-1 shadow">
                      <span className="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce"></span>
                      <span className="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                      <span className="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input form */}
              <form onSubmit={handleSendChat} className="p-3 bg-card border-t border-border relative">
                <input
                  type="text"
                  placeholder="Ask Autopilot Copilot..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={isTyping}
                  className="w-full bg-background border border-border rounded pl-3 pr-8 py-2 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all disabled:opacity-50 font-mono"
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

      {/* 4. HELP COMMAND OVERLAY MODAL */}
      {isHelpOpen && (
        <div className="fixed inset-0 bg-background/90 backdrop-blur-sm flex items-center justify-center z-50 fade-in-up">
          <div className="bg-card border border-border p-6 rounded-xl max-w-md w-full shadow-2xl space-y-4 relative">
            <button 
              onClick={() => setIsHelpOpen(false)}
              className="absolute right-4 top-4 p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <Keyboard className="h-5 w-5 text-primary" />
              <h3 className="font-extrabold text-sm text-foreground uppercase tracking-wider">Keyboard Navigation shortcuts</h3>
            </div>

            <div className="space-y-3.5 text-xs">
              <p className="text-muted-foreground leading-normal font-semibold">
                Use the following sequential key combinations to immediately navigate layout tabs:
              </p>
              
              <div className="space-y-2 font-mono text-[11px]">
                <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground font-sans">Executive Overview</span>
                  <div className="flex gap-1">
                    <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary text-[10px] font-bold shadow-sm">G</kbd>
                    <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary text-[10px] font-bold shadow-sm">O</kbd>
                  </div>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground font-sans">Resource Inventory</span>
                  <div className="flex gap-1">
                    <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary text-[10px] font-bold shadow-sm">G</kbd>
                    <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary text-[10px] font-bold shadow-sm">I</kbd>
                  </div>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground font-sans">Tenant Topology Map</span>
                  <div className="flex gap-1">
                    <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary text-[10px] font-bold shadow-sm">G</kbd>
                    <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary text-[10px] font-bold shadow-sm">T</kbd>
                  </div>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground font-sans">Cost Proposals</span>
                  <div className="flex gap-1">
                    <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary text-[10px] font-bold shadow-sm">G</kbd>
                    <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary text-[10px] font-bold shadow-sm">R</kbd>
                  </div>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground font-sans">Orchestration Swarm (Pipeline)</span>
                  <div className="flex gap-1">
                    <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary text-[10px] font-bold shadow-sm">G</kbd>
                    <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary text-[10px] font-bold shadow-sm">W</kbd>
                  </div>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground font-sans">Security Gates (Approvals)</span>
                  <div className="flex gap-1">
                    <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary text-[10px] font-bold shadow-sm">G</kbd>
                    <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary text-[10px] font-bold shadow-sm">A</kbd>
                  </div>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground font-sans">AI Reasoning Explainability</span>
                  <div className="flex gap-1">
                    <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary text-[10px] font-bold shadow-sm">G</kbd>
                    <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary text-[10px] font-bold shadow-sm">E</kbd>
                  </div>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground font-sans">Event Bus Stream</span>
                  <div className="flex gap-1">
                    <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary text-[10px] font-bold shadow-sm">G</kbd>
                    <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary text-[10px] font-bold shadow-sm">B</kbd>
                  </div>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground font-sans">Audit Ledger Store</span>
                  <div className="flex gap-1">
                    <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary text-[10px] font-bold shadow-sm">G</kbd>
                    <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary text-[10px] font-bold shadow-sm">L</kbd>
                  </div>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-border/40 font-sans">
                  <span className="text-muted-foreground">Toggle shortcuts guide modal</span>
                  <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary text-[10px] font-mono font-bold shadow-sm">?</kbd>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button 
                onClick={() => setIsHelpOpen(false)}
                className="px-4 py-2 rounded bg-foreground text-background text-xs font-bold hover:opacity-90 transition-opacity w-full uppercase tracking-wider"
              >
                Close Shortcuts
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
