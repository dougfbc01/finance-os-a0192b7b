import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BudgetProgressBar } from "./BudgetProgressBar";
import { BudgetStatusBadge } from "./BudgetStatusBadge";
import { formatCurrency } from "@/lib/format";
import { MonthlyBudgetService } from "@/services/MonthlyBudgetService";
import type { BudgetLine } from "@/models/MonthlyBudget";

interface Props {
  lines: BudgetLine[];
  year: number;
  month: number;
  emptyLabel?: string;
}

/** Tabela Planejado x Realizado. Recebe linhas já calculadas pelo Service. */
export function BudgetTable({ lines, year, month, emptyLabel = "Nenhuma linha no período." }: Props) {
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
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Saldo restante</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((l) => {
          const status = MonthlyBudgetService.statusLevel(l.percent);
          const catLink = MonthlyBudgetService.drillDown({
            year,
            month,
            categoryId: l.categoryId,
          });
          const subLink = MonthlyBudgetService.drillDown({
            year,
            month,
            categoryId: l.categoryId,
            subcategoryId: l.subcategoryId,
          });
          return (
            <TableRow key={`${l.kind}:${l.key}`}>
              <TableCell className="font-medium">
                <span className="flex items-center gap-2">
                  <Link to={catLink.to} search={catLink.search} className="hover:underline">
                    {l.categoryName}
                  </Link>
                  {l.kind === "INCOME" && (
                    <Badge variant="secondary" className="text-[10px]">
                      Receita
                    </Badge>
                  )}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {l.subcategoryName ? (
                  <Link to={subLink.to} search={subLink.search} className="hover:underline">
                    {l.subcategoryName}
                  </Link>
                ) : (
                  "—"
                )}
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
                <BudgetProgressBar percent={l.percent} status={status} />
              </TableCell>
              <TableCell>
                <BudgetStatusBadge status={status} muted={l.percent === null} />
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
