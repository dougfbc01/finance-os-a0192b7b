import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  CLOSING_STATUS_LABELS,
  MONTH_LABELS,
  type MonthlyClosing,
} from "@/models/MonthlyClosing";
import type { UUID } from "@/models";

interface Props {
  closings: MonthlyClosing[];
  staleIds: Set<UUID>;
  onView: (closing: MonthlyClosing) => void;
  onReopen: (closing: MonthlyClosing) => void;
}

export function ClosingList({ closings, staleIds, onView, onReopen }: Props) {
  if (closings.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhum fechamento registrado ainda.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Período</TableHead>
          <TableHead>Situação</TableHead>
          <TableHead className="text-right">Resultado</TableHead>
          <TableHead className="text-right">Patrimônio</TableHead>
          <TableHead className="text-right">Passivo</TableHead>
          <TableHead>Fechado em</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {closings.map((c) => {
          const t = c.snapshot_json?.totals;
          const stale = staleIds.has(c.id);
          return (
            <TableRow key={c.id}>
              <TableCell className="font-medium">
                {MONTH_LABELS[c.month - 1]} {c.year}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-1">
                  <Badge variant={c.status === "CLOSED" ? "default" : "secondary"}>
                    {CLOSING_STATUS_LABELS[c.status]}
                  </Badge>
                  {stale && <Badge variant="destructive">Desatualizado</Badge>}
                </div>
              </TableCell>
              <TableCell
                className={`text-right tabular-nums ${
                  (t?.result ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {formatCurrency(t?.result ?? 0)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(t?.netWorth ?? 0)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-red-600">
                {formatCurrency(t?.liabilities ?? 0)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {c.closed_at ? formatDate(new Date(c.closed_at)) : "—"}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => onView(c)}>
                    Visualizar snapshot
                  </Button>
                  {c.status === "CLOSED" && (
                    <Button size="sm" variant="ghost" onClick={() => onReopen(c)}>
                      Reabrir
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
