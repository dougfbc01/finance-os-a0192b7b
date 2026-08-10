import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { BudgetTotalsRow } from "./BudgetTotalsRow";
import { formatCurrency } from "@/lib/format";
import { MonthlyBudgetService } from "@/services/MonthlyBudgetService";
import type { BudgetCategoryGroup } from "@/models/MonthlyBudget";

interface Props {
  groups: BudgetCategoryGroup[];
  year: number;
  month: number;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  emptyLabel?: string;
  totalLabel?: string;
}

/**
 * Tabela hierárquica única: categoria consolidada + subcategorias expansíveis.
 * A expansão acontece só em memória; todos os números vêm do Service.
 */
export function BudgetCategoryTable({
  groups,
  year,
  month,
  expanded,
  onToggle,
  onExpandAll,
  onCollapseAll,
  emptyLabel = "Nenhuma linha no período.",
  totalLabel = "TOTAL",
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onExpandAll}>
          Expandir tudo
        </Button>
        <Button size="sm" variant="outline" onClick={onCollapseAll}>
          Recolher tudo
        </Button>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Planejado</TableHead>
              <TableHead className="text-right">Realizado</TableHead>
              <TableHead className="text-right">Diferença</TableHead>
              <TableHead className="w-40">%</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Saldo restante</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((g) => {
              const isOpen = expanded.has(g.key);
              const link = MonthlyBudgetService.drillDown({
                year,
                month,
                categoryId: g.categoryId,
              });
              return [
                <TableRow key={g.key} className="bg-muted/30">
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={isOpen ? "Recolher categoria" : "Expandir categoria"}
                        aria-expanded={isOpen}
                        onClick={() => onToggle(g.key)}
                        disabled={g.children.length === 0}
                        className="text-muted-foreground disabled:opacity-30"
                      >
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                      <Link to={link.to} search={link.search} className="hover:underline">
                        {g.categoryName}
                      </Link>
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(g.planned)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(g.actual)}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums ${
                      g.difference < 0 ? "text-destructive" : ""
                    }`}
                  >
                    {formatCurrency(g.difference)}
                  </TableCell>
                  <TableCell>
                    <BudgetProgressBar percent={g.percent} status={g.status} />
                  </TableCell>
                  <TableCell>
                    <BudgetStatusBadge status={g.status} muted={g.percent === null} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(g.remaining)}
                  </TableCell>
                </TableRow>,
                ...(isOpen
                  ? g.children.map((c) => {
                      const status = MonthlyBudgetService.statusLevel(c.percent);
                      const subLink = MonthlyBudgetService.drillDown({
                        year,
                        month,
                        categoryId: c.categoryId,
                        subcategoryId: c.subcategoryId,
                      });
                      return (
                        <TableRow key={`${g.key}:${c.key}`}>
                          <TableCell className="pl-12 text-muted-foreground">
                            <Link
                              to={subLink.to}
                              search={subLink.search}
                              className="hover:underline"
                            >
                              {c.subcategoryName ?? "Sem subcategoria"}
                            </Link>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(c.planned)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(c.actual)}
                          </TableCell>
                          <TableCell
                            className={`text-right tabular-nums ${
                              c.difference < 0 ? "text-destructive" : ""
                            }`}
                          >
                            {formatCurrency(c.difference)}
                          </TableCell>
                          <TableCell>
                            <BudgetProgressBar percent={c.percent} status={status} />
                          </TableCell>
                          <TableCell>
                            <BudgetStatusBadge status={status} muted={c.percent === null} />
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(c.remaining)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  : []),
              ];
            })}
            <BudgetTotalsRow
              label={totalLabel}
              totals={MonthlyBudgetService.groupTotals(groups)}
            />
          </TableBody>
        </Table>
      )}
    </div>
  );
}
