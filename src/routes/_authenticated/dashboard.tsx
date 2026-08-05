import { createFileRoute } from "@tanstack/react-router";
import { Wallet, TrendingUp, TrendingDown, Scale, PiggyBank, ShieldAlert } from "lucide-react";
import { APP_NAME } from "@/constants";
import { DashboardFilterBar } from "@/components/dashboard";
import { useFinancialInsights } from "@/hooks/useFinancialInsights";
import {
  KpiWidget,
  ExpensesByCategoryWidget,
  NetWorthWidget,
  LiabilitiesWidget,
  IncomeBreakdownWidget,
  IncomeEvolutionWidget,
  NetWorthEvolutionWidget,
  AccountsEvolutionWidget,
  PeriodComparisonWidget,
  FinancialInsightsWidget,
  LastClosingWidget,
} from "@/components/dashboard/widgets";
import { useDashboardFilter } from "@/hooks/useDashboardFilter";
import { useDashboardAnalytics } from "@/hooks/useDashboardAnalytics";
import { usePatrimony } from "@/hooks/usePatrimony";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useMonthlyClosings } from "@/hooks/useMonthlyClosings";

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
  const filter = useDashboardFilter();
  const {
    accounts,
    categories,
    subcategories,
    summary,
    incomeByCategory,
    incomeBySubcategory,
    expensesByCategory,
    monthlySeries,
    accountSeries,
    netWorthSeries,
    comparison,
    isLoading,
  } = useDashboardAnalytics(filter.resolved);
  const insightsState = useFinancialInsights(filter.resolved);
  const { snapshot, invoices } = usePatrimony();
  const { data: ws } = useWorkspace();
  const { data: closings = [] } = useMonthlyClosings(ws?.id as string | undefined);
  const lastClosing = closings[0] ?? null;

  const lastNetWorth = netWorthSeries[netWorthSeries.length - 1];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{APP_NAME}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bem-vindo ao Finance OS — visão geral do seu workspace.
        </p>
      </div>

      <DashboardFilterBar filter={filter} />

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <KpiWidget title="Saldo disponível" value={lastNetWorth?.cash ?? snapshot.cash} icon={Wallet} />
            <KpiWidget
              title="Patrimônio líquido"
              value={snapshot.netWorth}
              icon={PiggyBank}
              tone={snapshot.netWorth >= 0 ? "positive" : "negative"}
            />
            <KpiWidget
              title="Passivo de cartões"
              value={snapshot.liabilities}
              icon={ShieldAlert}
              tone="negative"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <KpiWidget title="Receitas do período" value={summary.income} icon={TrendingUp} tone="positive" />
            <KpiWidget title="Despesas do período" value={summary.expense} icon={TrendingDown} tone="negative" />
            <KpiWidget
              title="Resultado do período"
              value={summary.result}
              icon={Scale}
              tone={summary.result >= 0 ? "positive" : "negative"}
            />
            <KpiWidget title="Investimentos declarados" value={snapshot.assets} icon={PiggyBank} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <LastClosingWidget closing={lastClosing} />
          </div>

          <FinancialInsightsWidget {...insightsState} />

          <PeriodComparisonWidget rows={comparison} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <IncomeBreakdownWidget
              title="Receitas por categoria"
              data={incomeByCategory}
              lookup={categories.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
            />
            <IncomeBreakdownWidget
              title="Receitas por subcategoria"
              data={incomeBySubcategory}
              lookup={subcategories.map((s) => ({ id: s.id, name: s.name }))}
            />
          </div>

          <IncomeEvolutionWidget data={monthlySeries} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <NetWorthEvolutionWidget data={netWorthSeries} />
            <AccountsEvolutionWidget data={accountSeries} accounts={accounts} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <NetWorthWidget snapshot={snapshot} />
            </div>
            <LiabilitiesWidget invoices={invoices} />
          </div>

          <ExpensesByCategoryWidget
            data={expensesByCategory.map((d) => ({ categoryId: d.id, amount: d.amount }))}
            categories={categories}
          />
        </>
      )}
    </div>
  );
}
