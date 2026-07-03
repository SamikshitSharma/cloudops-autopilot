import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import {
  Boxes, GitBranch, LayoutDashboard, Lightbulb, Network, Radio, ScrollText, ShieldCheck, Sparkles, Zap,
} from "lucide-react";
import { toast } from "sonner";

interface Props { open: boolean; onOpenChange: (v: boolean) => void }

export function CommandPalette({ open, onOpenChange }: Props) {
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const go = (path: string) => { onOpenChange(false); navigate(path); };
  const run = (msg: string) => { onOpenChange(false); toast.success(msg); };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search resources, actions, docs…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => go("/")}><LayoutDashboard className="mr-2 h-4 w-4" />Overview</CommandItem>
          <CommandItem onSelect={() => go("/workflows")}><GitBranch className="mr-2 h-4 w-4" />Workflow Center</CommandItem>
          <CommandItem onSelect={() => go("/resources")}><Boxes className="mr-2 h-4 w-4" />Resources</CommandItem>
          <CommandItem onSelect={() => go("/recommendations")}><Lightbulb className="mr-2 h-4 w-4" />Recommendations</CommandItem>
          <CommandItem onSelect={() => go("/approvals")}><ShieldCheck className="mr-2 h-4 w-4" />Approvals</CommandItem>
          <CommandItem onSelect={() => go("/audit")}><ScrollText className="mr-2 h-4 w-4" />Audit Ledger</CommandItem>
          <CommandItem onSelect={() => go("/explainability")}><Sparkles className="mr-2 h-4 w-4" />Explainability</CommandItem>
          <CommandItem onSelect={() => go("/topology")}><Network className="mr-2 h-4 w-4" />Topology</CommandItem>
          <CommandItem onSelect={() => go("/events")}><Radio className="mr-2 h-4 w-4" />Event Bus</CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => run("Pipeline run triggered")}><Zap className="mr-2 h-4 w-4" />Trigger pipeline run</CommandItem>
          <CommandItem onSelect={() => run("Cost report scheduled")}><Sparkles className="mr-2 h-4 w-4" />Generate cost report</CommandItem>
          <CommandItem onSelect={() => run("Compliance scan started")}><ShieldCheck className="mr-2 h-4 w-4" />Run compliance scan</CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
