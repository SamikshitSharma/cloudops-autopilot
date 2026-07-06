import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { CommandPalette } from "@/components/system/CommandPalette";
import { AIChatDialog } from "@/components/system/AIChatDialog";
import { useState } from "react";

export default function AppShell() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  return (
    <SidebarProvider>
      <div className="flex min-h-dvh w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex min-w-0 flex-1 flex-col">
          <TopBar onOpenPalette={() => setPaletteOpen(true)} onOpenChat={() => setChatOpen(true)} />
          <div className="flex-1 overflow-x-hidden">
            <div className="mx-auto w-full max-w-[1600px] p-4 md:p-8">
              <Outlet />
            </div>
          </div>
        </SidebarInset>
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
        <AIChatDialog open={chatOpen} onOpenChange={setChatOpen} />
      </div>
    </SidebarProvider>
  );
}
