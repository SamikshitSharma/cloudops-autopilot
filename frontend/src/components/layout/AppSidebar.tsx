import { NavLink, useLocation } from "react-router-dom";
import {
  Activity, Boxes, GitBranch, Lightbulb, ShieldCheck, ScrollText,
  Sparkles, Network, Radio, LayoutDashboard,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const primary = [
  { title: "Overview", url: "/", icon: LayoutDashboard },
  { title: "Workflows", url: "/workflows", icon: GitBranch },
  { title: "Resources", url: "/resources", icon: Boxes },
  { title: "Recommendations", url: "/recommendations", icon: Lightbulb },
];

const governance = [
  { title: "Approvals", url: "/approvals", icon: ShieldCheck },
  { title: "Audit Ledger", url: "/audit", icon: ScrollText },
  { title: "Explainability", url: "/explainability", icon: Sparkles },
];

const observability = [
  { title: "Topology", url: "/topology", icon: Network },
  { title: "Event Bus", url: "/events", icon: Radio },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();

  const renderGroup = (label: string, items: typeof primary) => (
    <SidebarGroup>
      {!collapsed && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active = pathname === item.url;
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                  <NavLink
                    to={item.url}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <item.icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
                    {!collapsed && <span className="truncate">{item.title}</span>}
                    {active && (
                      <span className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-gradient-primary" aria-hidden />
                    )}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-primary shadow-elegant">
            <Activity className="h-4 w-4 text-primary-foreground" aria-hidden />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-display text-sm font-semibold leading-tight">Autopilot</div>
              <div className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">CloudOps · v4.2</div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="no-scrollbar">
        {renderGroup("Operate", primary)}
        {renderGroup("Governance", governance)}
        {renderGroup("Observability", observability)}
      </SidebarContent>
    </Sidebar>
  );
}
