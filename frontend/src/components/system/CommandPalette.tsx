import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import {
  Boxes, GitBranch, LayoutDashboard, Lightbulb, Network, Radio, ScrollText, ShieldCheck, Sparkles, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/api/client";

interface Props { open: boolean; onOpenChange: (v: boolean) => void }

export function CommandPalette({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any>(null);

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

  useEffect(() => {
    if (!open) {
      setQ("");
      setResults(null);
    }
  }, [open]);

  useEffect(() => {
    if (!q || q.trim().length < 2) {
      setResults(null);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await api.get<{ success: boolean; data: any }>(`/api/v1/search?q=${encodeURIComponent(q)}`);
        if (res?.data) {
          setResults(res.data);
        }
      } catch (err) {
        console.error("Search failed:", err);
      }
    }, 250);

    return () => clearTimeout(delayDebounceFn);
  }, [q]);

  const go = (path: string) => { onOpenChange(false); navigate(path); };
  const run = (msg: string) => { onOpenChange(false); toast.success(msg); };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput value={q} onValueChange={setQ} placeholder="Search resources, recommendations, runs, approvals, audits, events..." />
      <CommandList>
        {results ? (
          <>
            {results.resources.length > 0 && (
              <CommandGroup heading="Resources">
                {results.resources.map((r: any) => (
                  <CommandItem key={r.id} onSelect={() => go("/resources")}>
                    <Boxes className="mr-2 h-4 w-4" />
                    <span>{r.name} ({r.type})</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {results.runs.length > 0 && (
              <CommandGroup heading="Workflow Runs">
                {results.runs.map((w: any) => (
                  <CommandItem key={w.workflow_id} onSelect={() => go(`/workflows?id=${w.workflow_id}`)}>
                    <GitBranch className="mr-2 h-4 w-4" />
                    <span>Run #{w.workflow_id.slice(0, 8)} - {w.objective || w.scenario} ({w.status})</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {results.recommendations.length > 0 && (
              <CommandGroup heading="Recommendations">
                {results.recommendations.map((r: any) => (
                  <CommandItem key={r.id} onSelect={() => go("/recommendations")}>
                    <Lightbulb className="mr-2 h-4 w-4" />
                    <span>{r.action_type.toUpperCase()} {r.resource_id} (${r.saving_amount}/mo)</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {results.approvals.length > 0 && (
              <CommandGroup heading="Approvals">
                {results.approvals.map((a: any) => (
                  <CommandItem key={a.id} onSelect={() => go("/approvals")}>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    <span>Approval request for {a.recommendation_id} ({a.status})</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {results.audit_logs.length > 0 && (
              <CommandGroup heading="Audit Ledger">
                {results.audit_logs.map((a: any) => (
                  <CommandItem key={a.id} onSelect={() => go("/audit")}>
                    <ScrollText className="mr-2 h-4 w-4" />
                    <span>[{a.status.toUpperCase()}] {a.agent_name} - {a.event_type}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {results.events.length > 0 && (
              <CommandGroup heading="Events">
                {results.events.map((e: any) => (
                  <CommandItem key={e.id} onSelect={() => go("/events")}>
                    <Radio className="mr-2 h-4 w-4" />
                    <span>Event: {e.event_type} (Stage: {e.stage_id})</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        ) : (
          <>
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
          </>
        )}
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
