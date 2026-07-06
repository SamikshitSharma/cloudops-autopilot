import { Bell, Cloud, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { NotificationCenter } from "@/components/system/NotificationCenter";
import { useLocation } from "react-router-dom";

const titles: Record<string, string> = {
  "/": "Executive Overview",
  "/workflows": "Workflow Center",
  "/resources": "Resource Inventory",
  "/recommendations": "Recommendations",
  "/approvals": "Approvals Queue",
  "/audit": "Audit Ledger",
  "/explainability": "Explainability",
  "/topology": "Service Topology",
  "/events": "Event Bus",
};

interface Props { onOpenPalette: () => void; onOpenChat: () => void; }

export function TopBar({ onOpenPalette, onOpenChat }: Props) {
  const { pathname } = useLocation();
  const title = titles[pathname] ?? "Autopilot";
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/70 px-3 backdrop-blur-xl md:px-6">
      <SidebarTrigger className="text-muted-foreground" />
      <Separator orientation="vertical" className="h-6" />
      <div className="hidden items-center gap-2 md:flex">
        <Cloud className="h-4 w-4 text-primary" aria-hidden />
        <h1 className="font-display text-sm font-medium tracking-tight">{title}</h1>
        <Badge variant="outline" className="ml-1 border-success/40 text-success">
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
          All systems nominal
        </Badge>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenPalette}
          className="hidden gap-2 text-muted-foreground md:inline-flex"
          aria-label="Open command palette"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="text-xs">Search anything…</span>
          <span className="ml-6 flex items-center gap-1">
            <span className="kbd">⌘</span><span className="kbd">K</span>
          </span>
        </Button>
        <Button variant="ghost" size="icon" onClick={onOpenPalette} className="md:hidden" aria-label="Open command palette">
          <Search className="h-4 w-4" />
        </Button>

        <Button id="ask-ai-trigger" variant="ghost" size="sm" onClick={onOpenChat} className="gap-1.5 text-primary hover:text-primary" aria-label="Ask Autopilot AI">
          <Sparkles className="h-4 w-4" />
          <span className="hidden sm:inline">Ask AI</span>
        </Button>

        <NotificationCenter />

        <div className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-primary text-xs font-semibold text-primary-foreground cursor-pointer" title="CloudOps Operator" aria-label="CloudOps Operator">
          CO
        </div>
      </div>
    </header>
  );
}

// avoid unused import warning
void Bell;
