import { auditLedger } from "@/lib/mock";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";

const outcomeCls = {
  success: "text-success",
  failed: "text-destructive",
  pending: "text-warning",
} as const;

export default function Audit() {
  return (
    <div className="space-y-6 animate-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold">Audit Ledger</h2>
          <p className="text-sm text-muted-foreground">Tamper-evident, hash-chained record of every action</p>
        </div>
        <Badge variant="outline" className="gap-1.5 border-success/40 text-success">
          <ShieldCheck className="h-3.5 w-3.5" /> Chain integrity verified
        </Badge>
      </div>

      <Card className="glass overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>Hash</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {auditLedger.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">{e.ts}</TableCell>
                <TableCell>{e.actor}</TableCell>
                <TableCell className="font-mono text-xs text-primary">{e.action}</TableCell>
                <TableCell className="font-mono text-xs">{e.target}</TableCell>
                <TableCell className={`text-xs font-medium capitalize ${outcomeCls[e.outcome]}`}>{e.outcome}</TableCell>
                <TableCell className="font-mono text-[11px] text-muted-foreground">{e.hash}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
