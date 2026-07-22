import { createFileRoute } from "@tanstack/react-router";
import { Wallet, TrendingUp, TrendingDown, Scale } from "lucide-react";
import { APP_NAME } from "@/constants";
import {
  KpiWidget,
  BalanceEvolutionWidget,
  IncomeVsExpenseWidget,
  ExpensesByCategoryWidget,
} from "@/components/dashboard/widgets";
import { useDashboardData } from "@/hooks/useDashboard";
import { useCategories } from "@/hooks/useCategories";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Finance OS" },
      { name: "description", content: "Visão geral da sua vida financeira no Finance OS." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const {
    workspace,
    totalBalance,
    monthSummary,
    cashflow,
    expensesByCategory,
    isLoading,
  } = useDashboardData();
  const { data: categories = [] } = useCategories(workspace?.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{APP_NAME}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bem-vindo ao Finance OS — visão geral do seu workspace.
        </p>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KpiWidget title="Saldo total" value={totalBalance} icon={Wallet} />
            <KpiWidget title="Receitas do mês" value={monthSummary.income} icon={TrendingUp} tone="positive" />
            <KpiWidget title="Despesas do mês" value={monthSummary.expense} icon={TrendingDown} tone="negative" />
            <KpiWidget
              title="Resultado do mês"
              value={monthSummary.result}
              icon={Scale}
              tone={monthSummary.result >= 0 ? "positive" : "negative"}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BalanceEvolutionWidget data={cashflow} />
            <IncomeVsExpenseWidget data={cashflow} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ExpensesByCategoryWidget data={expensesByCategory} categories={categories} />
          </div>
        </>
      )}
    </div>
  );
}
