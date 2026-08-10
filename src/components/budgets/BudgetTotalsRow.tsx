import { TableCell, TableRow } from "@/components/ui/table";
import { BudgetProgressBar } from "./BudgetProgressBar";
import { BudgetStatusBadge } from "./BudgetStatusBadge";
import { formatCurrency } from "@/lib/format";
import { MonthlyBudgetService } from "@/services/MonthlyBudgetService";
import type { BudgetSideTotals } from "@/models/MonthlyBudget";

interface Props {
  label: string;
  totals: BudgetSideTotals;
  /** Quantidade de colunas antes da coluna "Planejado". */
  leadingColumns?: number;
}

/**
 * Linha de TOTAL das tabelas do Planejamento. Todos os números vêm prontos
 * do MonthlyBudgetService — nada é somado aqui.
 */
export function BudgetTotalsRow({ label, totals, leadingColumns = 1 }: Props) {
  const status = MonthlyBudgetService.statusLevel(totals.percent);
  return (
    <TableRow className="border-t-2 bg-muted/50 font-semibold">
      <TableCell colSpan={leadingColumns}>{label}</TableCell>
      <TableCell className="text-right tabular-nums">{formatCurrency(totals.planned)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatCurrency(totals.actual)}</TableCell>
      <TableCell
        className={`text-right tabular-nums ${totals.difference < 0 ? "text-destructive" : ""}`}
      >
        {formatCurrency(totals.difference)}
      </TableCell>
      <TableCell>
        <BudgetProgressBar percent={totals.percent} status={status} />
      </TableCell>
      <TableCell>
        <BudgetStatusBadge status={status} muted={totals.percent === null} />
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatCurrency(totals.remaining)}</TableCell>
    </TableRow>
  );
}
