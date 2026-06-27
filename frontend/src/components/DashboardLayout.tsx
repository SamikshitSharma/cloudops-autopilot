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
  Lock,
  MessageSquare,
  Send,
  Sparkle,
  ServerCrash
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
  const [isCopilotOpen, setIsCopilotOpen] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ sender: "ai" | "user", text: string }>>([
    { sender: "ai", text: "Autopilot initialized. The active sweep has detected 4 idle VMs and 2 unattached disks. I've prepared a cost optimization reasoning chain." }
  ]);

  // Sync dark mode preference properly using the new root variables
  useEffect(() => {
    const root = window.document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [darkMode]);

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

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    setChatMessages(prev => [...prev, { sender: "user", text: userMsg }]);
    setChatInput("");
    setIsTyping(true);

    // Simulate AI intelligent reasoning response
    setTimeout(() => {
      let aiText = "I am continuously monitoring the active telemetry stream. Governance policies are currently enforced.";
      const lowerMsg = userMsg.toLowerCase();
      
      if (lowerMsg.includes("savings") || lowerMsg.includes("recommend")) {
        aiText = "Based on our latest sweeps, there is a total potential saving of $105.00 available. The highest saver is `vm-idle-01` in `rg-prod` ($50.00). Tokens are prepared for operator approval.";
      } else if (lowerMsg.includes("vm") || lowerMsg.includes("idle")) {
        aiText = "Discovered idle Compute VM `vm-idle-01` in Resource Group `rg-prod`. Telemetry indicates <2% CPU for 7 days. I have constructed a resize/stop execution plan.";
      } else if (lowerMsg.includes("token") || lowerMsg.includes("approve")) {
        aiText = "Approvals require a signed JWT token with an operator signature. I have prepared the cryptographic payloads. Sign-offs can be granted from the **Approval Center** tab.";
      } else if (lowerMsg.includes("why")) {
        aiText = "The orchestrator agent executed a heuristic cross-reference between Azure Monitor metrics and our FinOps baseline. The risk profile is calculated as 'low' because the asset has no active network connections.";
      }
      
      setChatMessages(prev => [...prev, { sender: "ai", text: aiText }]);
      setIsTyping(false);
    }, 1500);
  };

  const navItems = [
    { id: "overview", label: "Executive Overview", icon: LayoutDashboard },
    { id: "inventory", label: "Asset Inventory", icon: Database },
    { id: "topology", label: "Resource Topology", icon: Network },
    { id: "recommendations", label: "AI Recommendations", icon: Sparkles },
    { id: "workflow", label: "Execution Pipeline", icon: Cpu },
    { id: "eventbus", label: "Global Event Timeline", icon: Activity },
    { id: "approvals", label: "Approval Center", icon: ShieldCheck },
  ];

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans bg-dot-pattern">
      {/* Vercel-style Dense Sidebar */}
      <aside className="w-[280px] bg-card border-r border-border flex flex-col justify-between z-20 shadow-xl">
        <div className="flex flex-col h-full">
          {/* Logo / Header */}
          <div className="p-5 border-b border-border flex items-center gap-3">
            <div className="p-1.5 rounded-md bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight text-foreground leading-tight">CloudOps <span className="text-primary font-bold">OS</span></h1>
              <p className="text-[10px] text-muted-foreground font-mono font-medium tracking-wide">AUTOPILOT COGNITIVE</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-0.5 overflow-y-auto flex-1 custom-scrollbar">
            <div className="px-3 pb-2 pt-4">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Platform</span>
            </div>
            {navItems.slice(0, 4).map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 ${
                    isActive 
                      ? "bg-primary/10 text-primary" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}

            <div className="px-3 pb-2 pt-6">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Autonomous Engine</span>
            </div>
            {navItems.slice(4).map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 ${
                    isActive 
                      ? "bg-primary/10 text-primary" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                  <span>{item.label}</span>
                  {isActive && item.id === 'workflow' && (
                    <span className="ml-auto flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Footer Settings */}
          <div className="p-4 border-t border-border space-y-3 bg-muted/20">
            {/* Health Status */}
            <div className="flex items-center justify-between px-3 py-2 rounded-md bg-card border border-border text-[11px]">
              <span className="text-muted-foreground font-medium flex items-center gap-2">
                {dbStatus === "healthy" ? <Activity className="h-3 w-3 text-emerald-500" /> : <ServerCrash className="h-3 w-3 text-destructive" />}
                Kernel Uplink
              </span>
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${
                  dbStatus === "healthy" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" : "bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                }`} />
                <span className="font-semibold uppercase tracking-wider text-foreground">{dbStatus}</span>
              </div>
            </div>

            {/* Theme Toggler */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-md border border-border hover:bg-muted text-xs font-medium text-muted-foreground transition-colors"
            >
              <div className="flex items-center gap-2">
                {darkMode ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
                <span>{darkMode ? "Dark Appearance" : "Light Appearance"}</span>
              </div>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-background relative">
        {/* Top Navbar */}
        <header className="h-14 border-b border-border bg-background/80 backdrop-blur-md px-6 flex items-center justify-between z-10 sticky top-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
            <span className="text-foreground">{navItems.find((n) => n.id === currentTab)?.label}</span>
            <span className="px-1.5 py-0.5 rounded-md bg-muted text-[10px] font-mono tracking-wide">v3.0.0-rc</span>
          </div>

          {/* Collapsible Copilot toggle + Status */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Lock className="h-3 w-3" />
              <span>Guardrails Enforced</span>
            </div>
            
            <button
              onClick={() => setIsCopilotOpen(!isCopilotOpen)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-semibold transition-all duration-200 ${
                isCopilotOpen 
                  ? "bg-primary text-primary-foreground border-primary shadow-sm" 
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Copilot</span>
            </button>
          </div>
        </header>

        {/* Inner Content Pane + Copilot Sidebar */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main scrollable body */}
          <section className="flex-1 overflow-y-auto p-6 lg:p-8 custom-scrollbar">
            <div className="max-w-6xl mx-auto space-y-6 fade-in-up">
              {children}
            </div>
          </section>

          {/* Sliding Copilot Sidebar - Vercel v0 / Cursor style */}
          {isCopilotOpen && (
            <aside className="w-[340px] bg-card border-l border-border flex flex-col justify-between z-10 shadow-2xl slide-in-right">
              
              {/* Header */}
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded bg-primary/10 text-primary">
                      <Sparkle className="h-3.5 w-3.5" />
                    </div>
                    <h3 className="text-xs font-semibold text-foreground">CloudOps Copilot</h3>
                  </div>
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                </div>

                {/* Pulsing Active Agent Monitor */}
                <div className="mt-4 p-3 bg-muted/30 border border-border rounded-md">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Agent Swarm Status</div>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[11px] font-medium">
                    <div className="flex items-center justify-between">
                      <span className="text-foreground">Executive</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)] animate-pulse" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-foreground">FinOps</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_5px_rgba(99,102,241,0.5)] animate-pulse" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Policy</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Telemetry</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Chat Messages Timeline */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar bg-muted/10">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex gap-3 ${msg.sender === "user" ? "flex-row-reverse" : "flex-row"}`}>
                    <div className={`flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center ${msg.sender === 'user' ? 'bg-secondary text-secondary-foreground border border-border' : 'bg-primary text-primary-foreground'}`}>
                      {msg.sender === 'user' ? <UserIcon /> : <Sparkle className="h-3 w-3" />}
                    </div>
                    <div className={`flex flex-col max-w-[80%] ${msg.sender === "user" ? "items-end" : "items-start"}`}>
                      <div className={`px-3 py-2 rounded-lg text-sm leading-relaxed ${
                        msg.sender === "user" 
                          ? "bg-foreground text-background" 
                          : "bg-card border border-border text-foreground shadow-sm"
                      }`}>
                        {msg.text.split('`').map((chunk, i) => 
                          i % 2 === 1 ? <code key={i} className="font-mono text-[11px] px-1 py-0.5 rounded bg-muted text-primary">{chunk}</code> : chunk
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex gap-3 flex-row">
                    <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                      <Sparkle className="h-3 w-3" />
                    </div>
                    <div className="px-3 py-2 rounded-lg bg-card border border-border flex items-center gap-1">
                      <span className="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce"></span>
                      <span className="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                      <span className="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input Field */}
              <form onSubmit={handleSendChat} className="p-4 bg-card border-t border-border relative">
                <input
                  type="text"
                  placeholder="Ask the swarm about savings..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={isTyping}
                  className="w-full bg-background border border-border rounded-md pl-3 pr-10 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all disabled:opacity-50"
                />
                <button 
                  type="submit"
                  disabled={isTyping || !chatInput.trim()}
                  className="absolute right-6 top-6 text-muted-foreground hover:text-primary disabled:opacity-50 transition-colors"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}

function UserIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
  );
}
