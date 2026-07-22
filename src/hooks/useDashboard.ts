import { useMemo } from "react";
import { useAccounts } from "./useAccounts";
import { useAllMovements } from "./useMovements";
import { useWorkspace } from "./useWorkspace";
import { DashboardService } from "@/services/DashboardService";

export function useDashboardData() {
  const { data: ws } = useWorkspace();
  const wsId = ws?.id as string | undefined;
  const accountsQ = useAccounts(wsId);
  const movementsQ = useAllMovements(wsId);

  const accounts = accountsQ.data ?? [];
  const movements = movementsQ.data ?? [];

  const balances = useMemo(
    () => DashboardService.computeBalances(accounts, movements),
    [accounts, movements],
  );

  const now = new Date();
  const monthSummary = useMemo(
    () => DashboardService.monthSummary(movements, now.getFullYear(), now.getMonth()),
    [movements, now],
  );
  const cashflow = useMemo(
    () => DashboardService.cashflow(accounts, movements, 6),
    [accounts, movements],
  );
  const expensesByCategory = useMemo(
    () => DashboardService.expensesByCategory(movements, now.getFullYear(), now.getMonth()),
    [movements, now],
  );

  return {
    workspace: ws,
    accounts,
    movements,
    balances,
    totalBalance: DashboardService.totalBalance(balances),
    monthSummary,
    cashflow,
    expensesByCategory,
    isLoading: accountsQ.isLoading || movementsQ.isLoading,
  };
}

/** Hook mínimo para saldos calculados (usado em Contas). */
export function useAccountBalances() {
  const { balances, isLoading } = useDashboardData();
  return { balances, isLoading };
}
