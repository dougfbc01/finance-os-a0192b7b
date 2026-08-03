// Analytics do Dashboard — orquestra dados brutos + Services.
// Todos os widgets consomem daqui; nenhum widget calcula regra ou data.
import { useMemo } from "react";
import { useWorkspace } from "./useWorkspace";
import { useAccounts } from "./useAccounts";
import { useAllMovements } from "./useMovements";
import { useAssets } from "./useAssets";
import { useCardInvoices } from "./useCardInvoices";
import { useCategories, useSubcategories } from "./useCategories";
import { DashboardService } from "@/services/DashboardService";
import type { ResolvedPeriod } from "@/services/DashboardFilterService";

export function useDashboardAnalytics(resolved: ResolvedPeriod) {
  const { data: ws } = useWorkspace();
  const wsId = ws?.id as string | undefined;

  const accountsQ = useAccounts(wsId);
  const movementsQ = useAllMovements(wsId);
  const assetsQ = useAssets(wsId);
  const invoicesQ = useCardInvoices(wsId);
  const categoriesQ = useCategories(wsId);
  const subcategoriesQ = useSubcategories(wsId);

  const accounts = accountsQ.data ?? [];
  const movements = movementsQ.data ?? [];
  const assets = assetsQ.data ?? [];
  const invoices = invoicesQ.data ?? [];

  const range = useMemo(
    () => ({ start: resolved.start, end: resolved.end }),
    [resolved.start, resolved.end],
  );

  const summary = useMemo(
    () => DashboardService.summaryInRange(movements, range),
    [movements, range],
  );

  const incomeByCategory = useMemo(
    () => DashboardService.incomeByCategory(movements, range),
    [movements, range],
  );

  const incomeBySubcategory = useMemo(
    () => DashboardService.incomeBySubcategory(movements, range),
    [movements, range],
  );

  const expensesByCategory = useMemo(
    () => DashboardService.expensesByCategoryInRange(movements, range),
    [movements, range],
  );

  const monthlySeries = useMemo(
    () => DashboardService.monthlySeries(movements, resolved.months),
    [movements, resolved.months],
  );

  const accountSeries = useMemo(
    () => DashboardService.accountBalanceSeries(accounts, movements, resolved.months),
    [accounts, movements, resolved.months],
  );

  const netWorthSeries = useMemo(
    () =>
      DashboardService.netWorthSeries({
        accounts,
        movements,
        assets,
        invoices,
        months: resolved.months,
      }),
    [accounts, movements, assets, invoices, resolved.months],
  );

  const comparison = useMemo(
    () =>
      DashboardService.comparison({
        accounts,
        movements,
        assets,
        invoices,
        current: range,
        previous: resolved.previous,
      }),
    [accounts, movements, assets, invoices, range, resolved.previous],
  );

  return {
    workspace: ws,
    accounts,
    movements,
    categories: categoriesQ.data ?? [],

    subcategories: subcategoriesQ.data ?? [],
    summary,
    incomeByCategory,
    incomeBySubcategory,
    expensesByCategory,
    monthlySeries,
    accountSeries,
    netWorthSeries,
    comparison,
    isLoading:
      accountsQ.isLoading ||
      movementsQ.isLoading ||
      assetsQ.isLoading ||
      invoicesQ.isLoading,
  };
}
