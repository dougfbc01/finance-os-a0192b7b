// Widgets do dashboard.
// A composição real acontece na rota /dashboard, que injeta os dados via hooks.
// Este arquivo mantém a lista de widgets estáticos (placeholder de expansão futura).
import type { DashboardWidget } from "@/types";

export const dashboardWidgets: DashboardWidget[] = [];

export { KpiWidget } from "./KpiWidget";
export { BalanceEvolutionWidget } from "./BalanceEvolutionWidget";
export { IncomeVsExpenseWidget } from "./IncomeVsExpenseWidget";
export { ExpensesByCategoryWidget } from "./ExpensesByCategoryWidget";
