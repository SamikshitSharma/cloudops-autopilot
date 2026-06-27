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
  ChevronRight,
  Terminal,
  Send,
  Sparkle
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
  const [chatMessages, setChatMessages] = useState<Array<{ sender: "ai" | "user", text: string }>>([
    { sender: "ai", text: "Autopilot initialized. Ready to run inventory sweeps, inspect policy compliance, or generate JWT approval tokens. Ask me anything about your cloud resources." }
  ]);

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

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    setChatMessages(prev => [...prev, { sender: "user", text: userMsg }]);
    setChatInput("");

    // Simulate AI response based on keyword matching
    setTimeout(() => {
      let aiText = "I'm monitoring the active sweep. You can trigger a stop scenario on idle VMs or verify approvals inside the Approval Center.";
      if (userMsg.toLowerCase().includes("savings") || userMsg.toLowerCase().includes("recommen")) {
        aiText = "Based on our latest sweeps, there is a total potential saving of $105.00 available. The highest saver is vm-idle-01 in rg-prod ($50.00). Tokens are prepared for operator approval.";
      } else if (userMsg.toLowerCase().includes("vm") || userMsg.toLowerCase().includes("idle")) {
        aiText = "Discovered idle Compute VM 'vm-idle-01' in Resource Group 'rg-prod'. It's been running at <2% CPU for 7 days. Resizing or stopping this VM is recommended.";
      } else if (userMsg.toLowerCase().includes("token") || userMsg.toLowerCase().includes("approve")) {
        aiText = "Approvals require a signed JWT token with an operator signature. Sign-offs can be granted from the Approval Center tab.";
      }
      setChatMessages(prev => [...prev, { sender: "ai", text: aiText }]);
    }, 1000);
  };

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
    <div className="flex h-screen bg-[#07080b] text-[#f8fafc] overflow-hidden font-sans tech-grid-bg">
      {/* Sidebar */}
      <aside className="w-68 bg-[#0b0c11] border-r border-[#1a1c24] flex flex-col justify-between z-20 shadow-2xl">
        <div>
          {/* Logo / Header */}
          <div className="p-6 border-b border-[#1a1c24] flex items-center gap-3 bg-[#0d0e14]/60">
            <div className="p-2 rounded-lg bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 text-white shadow-lg shadow-indigo-500/25">
              <Zap className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h1 className="font-heading font-extrabold text-sm tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-pink-400 uppercase">CloudOps</h1>
              <p className="text-[9px] text-slate-400 font-bold tracking-widest font-mono">AUTOPILOT COGNITIVE</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1 overflow-y-auto max-h-[calc(100vh-280px)] custom-scrollbar">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 group relative ${
                    isActive 
                      ? "bg-gradient-to-r from-[#171923] to-[#12141c] text-indigo-400 border border-indigo-500/20 shadow-inner" 
                      : "hover:bg-[#12141c] text-slate-400 hover:text-slate-200 border border-transparent"
                  }`}
                >
                  <Icon className={`h-4.5 w-4.5 transition-transform duration-200 group-hover:scale-105 ${isActive ? "text-indigo-400" : "text-slate-400 group-hover:text-slate-200"}`} />
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/50 animate-pulse" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Settings */}
        <div className="p-4 border-t border-[#1a1c24] space-y-3 bg-[#0d0e14]/40">
          {/* Health Status */}
          <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[#07080b] border border-[#1a1c24] text-[10px]">
            <span className="text-slate-400 font-medium">Engine Connectivity</span>
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${
                dbStatus === "healthy" 
                  ? "bg-emerald-500 shadow-md shadow-emerald-500/50 animate-pulse" 
                  : dbStatus === "unhealthy" 
                    ? "bg-rose-500 shadow-md shadow-rose-500/50 animate-pulse" 
                    : "bg-amber-500 animate-pulse"
              }`} />
              <span className="font-bold uppercase font-mono tracking-wider text-slate-200">{dbStatus}</span>
            </div>
          </div>

          {/* Theme Toggler */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-[#1a1c24] hover:bg-[#12141c] text-xs font-semibold text-slate-300"
          >
            <div className="flex items-center gap-2">
              {darkMode ? <Moon className="h-3.5 w-3.5 text-indigo-400" /> : <Sun className="h-3.5 w-3.5 text-amber-500" />}
              <span>{darkMode ? "Dark Mode" : "Light Mode"}</span>
            </div>
          </button>

          {/* Capstone Credit */}
          <div className="text-[9px] text-slate-500 text-center pt-2 font-mono tracking-wider">
            Google x Kaggle AI Agents Capstone
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#07080b]">
        {/* Top Navbar */}
        <header className="h-16 border-b border-[#1a1c24] bg-[#0b0c11]/80 backdrop-blur-md px-8 flex items-center justify-between z-10 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold tracking-wide">
            <span className="font-mono text-[9px] text-indigo-400 uppercase tracking-widest">CONTROL PLANE</span>
            <span>/</span>
            <span className="text-slate-100 uppercase tracking-widest font-mono text-[9px]">
              {navItems.find((n) => n.id === currentTab)?.label}
            </span>
          </div>

          {/* Collapsible Copilot toggle + Status */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-[9px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-full bg-[#10241a] text-emerald-400 border border-emerald-500/20">
              <Lock className="h-3 w-3" />
              <span>Safety Guardrails Enabled</span>
            </div>
            
            <button
              onClick={() => setIsCopilotOpen(!isCopilotOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase transition-all duration-200 ${
                isCopilotOpen 
                  ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400" 
                  : "bg-[#111318] border-[#1a1c24] text-slate-400 hover:text-slate-200"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Copilot AI</span>
            </button>
          </div>
        </header>

        {/* Inner Content Pane + Copilot Sidebar */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main scrollable body */}
          <section className="flex-1 overflow-y-auto p-8 custom-scrollbar relative scanline-effect">
            <div className="max-w-7xl mx-auto space-y-8">
              {children}
            </div>
          </section>

          {/* Sliding Copilot Sidebar */}
          {isCopilotOpen && (
            <aside className="w-80 bg-[#0b0c11] border-l border-[#1a1c24] flex flex-col justify-between z-10 shadow-2xl animate-slideLeft">
              
              {/* Header */}
              <div className="p-4 border-b border-[#1a1c24] bg-[#0d0e14]/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkle className="h-4 w-4 text-indigo-400 animate-spin-slow" />
                    <h3 className="text-[10px] font-bold tracking-widest uppercase text-slate-200 font-mono">Co-Reasoning Copilot</h3>
                  </div>
                  <span className="text-[8px] font-mono font-bold bg-[#14231b] text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded">ONLINE</span>
                </div>

                {/* Pulsing Active Agent Monitor */}
                <div className="mt-4 p-3.5 bg-[#07080b] border border-[#1a1c24] rounded-lg space-y-2">
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest font-mono">Autonomous Agents State</span>
                  <div className="grid grid-cols-2 gap-2 text-[9px] font-mono">
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-slate-300">Executive</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-slate-300">FinOps</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                      <span className="text-slate-300">Policy</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                      <span className="text-slate-300">Decision</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Chat Messages Timeline */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3.5 custom-scrollbar text-[10px] bg-[#07080b]/30">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex flex-col space-y-1 ${msg.sender === "user" ? "items-end" : "items-start"}`}>
                    <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">{msg.sender === "ai" ? "AUTOPILOT CO-PILOT" : "OPERATOR"}</span>
                    <div className={`p-3.5 rounded-xl border max-w-[240px] leading-relaxed ${
                      msg.sender === "user" 
                        ? "bg-[#171923] border-[#222533] text-white" 
                        : "bg-[#111318] border-[#1a1c24] text-slate-300 shadow-md shadow-black/20"
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>

              {/* Chat Input Field */}
              <form onSubmit={handleSendChat} className="p-4 border-t border-[#1a1c24] bg-[#0d0e14]/50 flex gap-2">
                <input
                  type="text"
                  placeholder="Ask agent about saving metrics..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="flex-1 bg-[#07080b] border border-[#1a1c24] rounded-lg px-3 py-2 text-[10px] text-slate-200 placeholder-slate-500 focus:border-indigo-500/50 focus:outline-none focus:ring-0"
                />
                <button 
                  type="submit"
                  className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all duration-150"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>

            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
