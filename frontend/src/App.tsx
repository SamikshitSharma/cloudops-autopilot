import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { api } from "@/api/client";
import AppShell from "@/components/layout/AppShell";
import Overview from "./pages/Overview";
import Workflows from "./pages/Workflows";
import Resources from "./pages/Resources";
import Recommendations from "./pages/Recommendations";
import Approvals from "./pages/Approvals";
import Audit from "./pages/Audit";
import Explainability from "./pages/Explainability";
import Topology from "./pages/Topology";
import Events from "./pages/Events";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const SweepProgressOverlay = () => {
  const { data: workflows = [] } = useQuery<any[]>({
    queryKey: ["workflows"],
    queryFn: async () => {
      const res = await api.get<any[]>("/api/v1/workflows");
      return res || [];
    },
    refetchInterval: 2000,
  });

  const activeWf = workflows.find((wf) => {
    const isActive = wf.status === "running" || wf.status === "pending" || wf.status === "blocked_on_approval";
    const updatedAt = wf.updated_at ? new Date(wf.updated_at).getTime() : 0;
    const recentlyUpdated = updatedAt > 0 && Date.now() - updatedAt < 5 * 60 * 1000;
    return isActive && recentlyUpdated;
  });

  if (!activeWf) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] glass p-4 rounded-xl border border-primary/40 shadow-2xl w-80 animate-in-right space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary animate-ping" />
          Workflow In Progress
        </span>
        <span className="font-mono text-[9px] text-muted-foreground">Run #{activeWf.workflow_id.slice(0, 8)}</span>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold text-foreground truncate">{activeWf.objective || "Awaiting backend workflow state..."}</p>
        <p className="text-[10px] text-muted-foreground capitalize">Status: {activeWf.status.replace(/_/g, " ")}</p>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-[9px] font-mono text-muted-foreground">
          <span>Backend progress</span>
          <span>{Math.round(activeWf.progress_percentage)}%</span>
        </div>
        <div className="h-1.5 w-full bg-muted/30 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-primary transition-all duration-500 ease-out" 
            style={{ width: `${activeWf.progress_percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider delayDuration={200}>
      <Toaster />
      <Sonner theme="dark" position="top-right" richColors />
      <SweepProgressOverlay />
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<Overview />} />
            <Route path="/workflows" element={<Workflows />} />
            <Route path="/resources" element={<Resources />} />
            <Route path="/recommendations" element={<Recommendations />} />
            <Route path="/approvals" element={<Approvals />} />
            <Route path="/audit" element={<Audit />} />
            <Route path="/explainability" element={<Explainability />} />
            <Route path="/topology" element={<Topology />} />
            <Route path="/events" element={<Events />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
