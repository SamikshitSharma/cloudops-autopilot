import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { notifications } from "@/lib/mock";
import { SeverityBadge } from "@/components/ui-ext/SeverityBadge";
import { useState } from "react";

export function NotificationCenter() {
  const [items, setItems] = useState(notifications);
  const unread = items.filter((n) => !n.read).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications (${unread} unread)`}>
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-border p-3">
          <div>
            <div className="text-sm font-medium">Notifications</div>
            <div className="text-xs text-muted-foreground">{unread} unread</div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setItems(items.map((n) => ({ ...n, read: true })))}>
            Mark all read
          </Button>
        </div>
        <ScrollArea className="max-h-96">
          <ul className="divide-y divide-border">
            {items.map((n) => (
              <li key={n.id} className="flex gap-3 p-3 hover:bg-muted/40">
                <SeverityBadge severity={n.severity} dotOnly />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{n.title}</p>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{n.ts}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                </div>
                {!n.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
              </li>
            ))}
          </ul>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
