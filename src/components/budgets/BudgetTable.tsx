import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import type { BudgetLine } from "@/models/MonthlyBudget";

interface Props {
  lines: BudgetLine[];
  emptyLabel?: string;
}

/** Tabela Planejado x Realizado. Recebe linhas já calculadas pelo Service. */
export function BudgetTable({ lines, emptyLabel = "Nenhuma linha no período." }: Props) {
  if (lines.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Categoria</TableHead>
          <TableHead>Subcategoria</TableHead>
          <TableHead className="text-right">Planejado</TableHead>
          <TableHead className="text-right">Realizado</TableHead>
          <TableHead className="text-right">Diferença</TableHead>
          <TableHead className="w-40">%</TableHead>
          <TableHead className="text-right">Saldo restante</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((l) => {
          const percent = l.percent ?? 0;
          return (
            <TableRow key={`${l.kind}:${l.key}`}>
              <TableCell className="font-medium">
                <span className="flex items-center gap-2">
                  {l.categoryName}
                  {l.kind === "INCOME" && (
                    <Badge variant="secondary" className="text-[10px]">
                      Receita
                    </Badge>
                  )}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {l.subcategoryName ?? "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(l.planned)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(l.actual)}
              </TableCell>
              <TableCell
                className={`text-right tabular-nums ${
                  l.difference < 0 ? "text-destructive" : ""
                }`}
              >
                {formatCurrency(l.difference)}
              </TableCell>
              <TableCell>
                {l.percent === null ? (
                  <span className="text-xs text-muted-foreground">Sem planejamento</span>
                ) : (
                  <div className="space-y-1">
                    <Progress value={Math.min(percent, 100)} />
                    <span className="text-xs text-muted-foreground">
                      {percent.toFixed(0)}%
                    </span>
                  </div>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(l.remaining)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
