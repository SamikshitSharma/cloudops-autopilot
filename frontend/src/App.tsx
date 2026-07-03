import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider delayDuration={200}>
      <Toaster />
      <Sonner theme="dark" position="top-right" richColors />
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
