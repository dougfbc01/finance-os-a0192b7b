// "Resumo do mês" — apenas orquestra insumos já carregados; regra em MonthlySummaryService.
import { useMemo } from "react";
import { useWorkspace } from "./useWorkspace";
import { useCards } from "./useCards";
import { useClosingBuilder, useMonthlyClosings, useStaleClosings } from "./useMonthlyClosings";
import { useMonthlyBudget } from "./useMonthlyBudgets";
import { MonthlySummaryService } from "@/services/MonthlySummaryService";

export function useMonthlySummary(year: number, month: number) {
  const { data: ws } = useWorkspace();
  const wsId = ws?.id as string | undefined;
  const builder = useClosingBuilder(year, month);
  const budget = useMonthlyBudget(year, month);
  const cardsQ = useCards(wsId);
  const { data: closings = [] } = useMonthlyClosings(wsId);
  const staleIds = useStaleClosings(closings);
  const closing = useMemo(() => closings.find((c) => c.year === year && c.month === month) ?? null, [closings, year, month]);

  const summary = useMemo(() => {
    const p = builder.buildParams;
    if (!p) return null;
    return MonthlySummaryService.build({
      year, month,
      accounts: p.accounts, movements: p.movements, assets: p.assets, invoices: p.invoices,
      cards: cardsQ.data ?? [], categories: p.categories,
      investmentsByMonth: p.investmentsByMonth ?? {},
      investmentsAtCostByMonth: p.investmentsAtCostByMonth,
      budget: budget.comparison, closing, stale: !!closing && staleIds.has(closing.id),
      warnings: builder.warnings,
    });
  }, [builder.buildParams, builder.warnings, budget.comparison, cardsQ.data, closing, staleIds, year, month]);

  return { summary, builder, closing, isLoading: builder.isLoading || budget.isLoading };
}
