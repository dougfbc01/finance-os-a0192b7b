// FinancialAnalyticsService — camada analítica da Inteligência Financeira.
// REGRA: apenas cálculo puro sobre movimentações já carregadas. Nenhum acesso
// a banco, nenhuma persistência e nenhum valor derivado gravado.
import { BaseService } from "./BaseService";
import { DashboardFilterService, type DateRange } from "./DashboardFilterService";
import { INCOME_TYPES, EXPENSE_TYPES } from "@/constants/enums";
import type { Movement, UUID } from "@/models";
import type { BudgetComparison } from "@/models/MonthlyBudget";
import type { GoalProgress } from "@/models/FinancialGoal";
import type {
  AnalysisConfidence,
  AnalyticsOutlier,
  AnalyticsReport,
  BudgetAnalysis,
  BudgetDeviation,
  CategoryTrend,
  ConcentrationItem,
  GoalImpact,
  HistoryWindow,
  IncomeAnalysis,
  SavingOpportunity,
  SeasonalityPoint,
  TrendDirection,
} from "@/models/Analytics";

export interface AnalyticsInput {
  range: DateRange;
  movements: Movement[];
  categories: { id: UUID; name: string }[];
  budget?: BudgetComparison | null;
  goals?: GoalProgress[];
  /** Quantidade máxima de meses históricos analisados (3–6). */
  maxMonths?: number;
}

/** Variação mínima (%) para uma categoria ser considerada em tendência. */
const TREND_MIN_PERCENT = 15;
/** Diferença mínima em valor absoluto para evitar ruído de centavos. */
const TREND_MIN_AMOUNT = 50;
/** Múltiplo da média que caracteriza um lançamento atípico. */
const OUTLIER_FACTOR = 3;
/** Participação mínima para sinalizar concentração de gastos. */
const CONCENTRATION_MIN_PERCENT = 30;

class FinancialAnalyticsServiceImpl extends BaseService {
  private competenceIso(m: Movement): string {
    return (m.competence_date ?? m.transaction_date).slice(0, 10);
  }

  private monthKey(m: Movement): string {
    return this.competenceIso(m).slice(0, 7);
  }

  private isExpense(m: Movement): boolean {
    return EXPENSE_TYPES.includes(m.type);
  }

  private isIncome(m: Movement): boolean {
    return INCOME_TYPES.includes(m.type);
  }

  private variation(current: number, base: number): number | null {
    if (base === 0) return null;
    return ((current - base) / Math.abs(base)) * 100;
  }

  private confidenceOf(months: number): AnalysisConfidence {
    if (months <= 0) return "NONE";
    if (months < 3) return "LOW";
    return "NORMAL";
  }

  private directionOf(variation: number | null, difference: number): TrendDirection {
    if (variation === null) return difference > 0 ? "UP" : "STABLE";
    if (variation >= TREND_MIN_PERCENT) return "UP";
    if (variation <= -TREND_MIN_PERCENT) return "DOWN";
    return "STABLE";
  }

  /** Meses (yyyy-mm) com dados anteriores ao período, do mais antigo ao mais recente. */
  historyWindow(movements: Movement[], range: DateRange, maxMonths = 6): HistoryWindow {
    const limit = Math.min(Math.max(maxMonths, 3), 6);
    const startMonth = range.start.slice(0, 7);
    const keys = new Set<string>();
    for (const m of movements) {
      if (!this.isExpense(m) && !this.isIncome(m)) continue;
      const key = this.monthKey(m);
      if (key < startMonth) keys.add(key);
    }
    const months = Array.from(keys).sort().slice(-limit);
    const monthsAnalyzed = months.length;
    const confidence = this.confidenceOf(monthsAnalyzed);
    const label =
      monthsAnalyzed === 0
        ? "Sem histórico anterior suficiente para análise comportamental."
        : `Análise baseada em ${monthsAnalyzed} ${monthsAnalyzed === 1 ? "mês" : "meses"} de histórico.`;
    return { months, monthsAnalyzed, confidence, label };
  }

  private inRange(range: DateRange, m: Movement): boolean {
    return DashboardFilterService.contains(range, this.competenceIso(m));
  }

  /** Tendência por categoria: total do período x média mensal do histórico. */
  categoryTrends(input: AnalyticsInput, window: HistoryWindow): CategoryTrend[] {
    const names = new Map<UUID | "none", string>();
    for (const c of input.categories) names.set(c.id, c.name);

    const current = new Map<UUID | "none", number>();
    const history = new Map<UUID | "none", Map<string, number>>();
    const monthSet = new Set(window.months);

    for (const m of input.movements) {
      if (!this.isExpense(m)) continue;
      const key = (m.category_id ?? "none") as UUID | "none";
      if (this.inRange(input.range, m)) {
        current.set(key, (current.get(key) ?? 0) + m.amount);
        continue;
      }
      const month = this.monthKey(m);
      if (!monthSet.has(month)) continue;
      const byMonth = history.get(key) ?? new Map<string, number>();
      byMonth.set(month, (byMonth.get(month) ?? 0) + m.amount);
      history.set(key, byMonth);
    }

    const keys = new Set<UUID | "none">([...current.keys(), ...history.keys()]);
    const out: CategoryTrend[] = [];
    for (const key of keys) {
      const byMonth = history.get(key);
      const monthsAnalyzed = window.monthsAnalyzed;
      const total = byMonth ? Array.from(byMonth.values()).reduce((s, v) => s + v, 0) : 0;
      const average = monthsAnalyzed > 0 ? total / monthsAnalyzed : 0;
      const cur = current.get(key) ?? 0;
      const difference = cur - average;
      const variationPercent = this.variation(cur, average);
      out.push({
        categoryId: key === "none" ? null : (key as UUID),
        name: key === "none" ? "Sem categoria" : (names.get(key) ?? "—"),
        current: cur,
        average,
        difference,
        variationPercent,
        direction: this.directionOf(variationPercent, difference),
        monthsAnalyzed,
        confidence: this.confidenceOf(monthsAnalyzed),
      });
    }
    return out.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
  }

  /** Lançamentos muito acima da média da própria categoria. */
  outliers(input: AnalyticsInput, window: HistoryWindow): AnalyticsOutlier[] {
    const names = new Map<UUID, string>();
    for (const c of input.categories) names.set(c.id, c.name);

    const samples = new Map<UUID | "none", number[]>();
    const monthSet = new Set(window.months);

    for (const m of input.movements) {
      if (!this.isExpense(m) || m.amount <= 0) continue;
      const inCurrent = this.inRange(input.range, m);
      if (!inCurrent && !monthSet.has(this.monthKey(m))) continue;
      const key = (m.category_id ?? "none") as UUID | "none";
      const list = samples.get(key) ?? [];
      list.push(m.amount);
      samples.set(key, list);
    }

    const out: AnalyticsOutlier[] = [];
    for (const m of input.movements) {
      if (!this.isExpense(m) || m.amount <= 0) continue;
      if (!this.inRange(input.range, m)) continue;
      const key = (m.category_id ?? "none") as UUID | "none";
      const list = samples.get(key) ?? [];
      if (list.length < 4) continue;
      const others = [...list];
      others.splice(others.indexOf(m.amount), 1);
      const average = others.reduce((s, v) => s + v, 0) / others.length;
      if (average <= 0) continue;
      const times = m.amount / average;
      if (times < OUTLIER_FACTOR) continue;
      out.push({
        movementId: m.id,
        description: m.description,
        date: this.competenceIso(m),
        amount: m.amount,
        categoryId: m.category_id,
        categoryName: m.category_id ? (names.get(m.category_id) ?? "—") : "Sem categoria",
        average,
        times,
        samples: others.length,
        confidence: this.confidenceOf(window.monthsAnalyzed),
      });
    }
    return out.sort((a, b) => b.amount - a.amount).slice(0, 5);
  }

  /** Categorias cuja média mensal supera o planejado do orçamento. */
  savingOpportunities(
    trends: CategoryTrend[],
    budget: BudgetComparison | null,
    window: HistoryWindow,
  ): SavingOpportunity[] {
    if (!budget) return [];
    const planned = new Map<string, number>();
    for (const line of budget.lines) {
      if (line.kind !== "EXPENSE" || line.planned <= 0) continue;
      const key = line.categoryId ?? "none";
      planned.set(key, (planned.get(key) ?? 0) + line.planned);
    }

    const out: SavingOpportunity[] = [];
    for (const t of trends) {
      const key = t.categoryId ?? "none";
      const plan = planned.get(key);
      if (plan === undefined) continue;
      const monthlyAverage =
        window.monthsAnalyzed > 0 ? (t.average * window.monthsAnalyzed + t.current) / (window.monthsAnalyzed + 1) : t.current;
      const excess = monthlyAverage - plan;
      if (excess <= 0) continue;
      out.push({
        categoryId: t.categoryId,
        name: t.name,
        monthlyAverage,
        planned: plan,
        excess,
        monthsAnalyzed: window.monthsAnalyzed,
        confidence: t.confidence,
      });
    }
    return out.sort((a, b) => b.excess - a.excess).slice(0, 5);
  }

  /** Desvios do Planejamento Mensal já calculado pelo MonthlyBudgetService. */
  budgetAnalysis(budget: BudgetComparison | null): BudgetAnalysis | null {
    if (!budget) return null;
    const map = (l: BudgetComparison["lines"][number]): BudgetDeviation => ({
      key: l.key,
      categoryId: l.categoryId,
      subcategoryId: l.subcategoryId,
      label: l.subcategoryName ? `${l.categoryName} › ${l.subcategoryName}` : l.categoryName,
      planned: l.planned,
      actual: l.actual,
      difference: l.difference,
      percent: l.percent,
    });

    const expenses = budget.lines.filter((l) => l.kind === "EXPENSE" && l.planned > 0);
    const incomes = budget.lines.filter((l) => l.kind === "INCOME" && l.planned > 0);

    return {
      year: budget.year,
      month: budget.month,
      over: expenses.filter((l) => (l.percent ?? 0) > 100).map(map),
      near: expenses
        .filter((l) => (l.percent ?? 0) >= 80 && (l.percent ?? 0) <= 100)
        .map(map),
      under: expenses.filter((l) => (l.percent ?? 0) < 70).map(map),
      incomeBelow: incomes.filter((l) => l.actual < l.planned).map(map),
    };
  }

  /** Metas cujo ritmo atual está abaixo do aporte necessário. */
  goalImpacts(goals: GoalProgress[]): GoalImpact[] {
    return goals
      .filter((g) => g.status === "ACTIVE" && g.requiredMonthly !== null)
      .map((g) => {
        const pace = g.monthlyPace ?? 0;
        const required = g.requiredMonthly as number;
        return {
          goalId: g.goalId,
          name: g.name,
          requiredMonthly: required,
          currentPace: pace,
          difference: pace - required,
        };
      })
      .filter((g) => g.difference < 0)
      .sort((a, b) => a.difference - b.difference);
  }

  /** Comparação do mês final do período com o mesmo mês do ano anterior. */
  seasonality(input: AnalyticsInput): SeasonalityPoint | null {
    const monthKey = input.range.end.slice(0, 7);
    const [y, m] = monthKey.split("-");
    const referenceKey = `${Number(y) - 1}-${m}`;
    let current = 0;
    let reference = 0;
    let hasReference = false;
    for (const mov of input.movements) {
      if (!this.isExpense(mov)) continue;
      const key = this.monthKey(mov);
      if (key === monthKey) current += mov.amount;
      else if (key === referenceKey) {
        reference += mov.amount;
        hasReference = true;
      }
    }
    if (!hasReference) return null;
    return {
      monthKey,
      referenceKey,
      current,
      reference,
      variationPercent: this.variation(current, reference),
    };
  }

  /** Análise das receitas: evolução e concentração por categoria. */
  incomeAnalysis(input: AnalyticsInput, window: HistoryWindow): IncomeAnalysis {
    const names = new Map<UUID, string>();
    for (const c of input.categories) names.set(c.id, c.name);

    const monthSet = new Set(window.months);
    let current = 0;
    let historyTotal = 0;
    const byCategory = new Map<UUID | "none", number>();

    for (const m of input.movements) {
      if (!this.isIncome(m)) continue;
      if (this.inRange(input.range, m)) {
        current += m.amount;
        const key = (m.category_id ?? "none") as UUID | "none";
        byCategory.set(key, (byCategory.get(key) ?? 0) + m.amount);
      } else if (monthSet.has(this.monthKey(m))) {
        historyTotal += m.amount;
      }
    }

    const average = window.monthsAnalyzed > 0 ? historyTotal / window.monthsAnalyzed : 0;
    const difference = current - average;
    const variationPercent = this.variation(current, average);
    const top = this.toConcentration(byCategory, names, current);

    return {
      current,
      average,
      difference,
      variationPercent,
      direction: this.directionOf(variationPercent, difference),
      monthsAnalyzed: window.monthsAnalyzed,
      confidence: this.confidenceOf(window.monthsAnalyzed),
      top: top.slice(0, 3),
      concentrationPercent: top[0]?.percent ?? null,
    };
  }

  /** Concentração de despesas por categoria no período. */
  concentration(input: AnalyticsInput): ConcentrationItem[] {
    const names = new Map<UUID, string>();
    for (const c of input.categories) names.set(c.id, c.name);
    const byCategory = new Map<UUID | "none", number>();
    let total = 0;
    for (const m of input.movements) {
      if (!this.isExpense(m) || !this.inRange(input.range, m)) continue;
      const key = (m.category_id ?? "none") as UUID | "none";
      byCategory.set(key, (byCategory.get(key) ?? 0) + m.amount);
      total += m.amount;
    }
    return this.toConcentration(byCategory, names, total).slice(0, 5);
  }

  private toConcentration(
    byCategory: Map<UUID | "none", number>,
    names: Map<UUID, string>,
    total: number,
  ): ConcentrationItem[] {
    return Array.from(byCategory.entries())
      .map(([key, amount]) => ({
        categoryId: key === "none" ? null : (key as UUID),
        name: key === "none" ? "Sem categoria" : (names.get(key as UUID) ?? "—"),
        amount,
        percent: total > 0 ? (amount / total) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  /** Limite mínimo de participação para sinalizar concentração. */
  get concentrationThreshold(): number {
    return CONCENTRATION_MIN_PERCENT;
  }

  /** Relatório completo consumido pelo FinancialInsightsService e pelo Dashboard. */
  analyze(input: AnalyticsInput): AnalyticsReport {
    const window = this.historyWindow(input.movements, input.range, input.maxMonths ?? 6);
    const trends = this.categoryTrends(input, window);
    const budget = input.budget ?? null;

    const totalExpense = trends.reduce((s, t) => s + t.current, 0);
    const averageExpense = trends.reduce((s, t) => s + t.average, 0);

    const relevant = (t: CategoryTrend) =>
      Math.abs(t.difference) >= TREND_MIN_AMOUNT &&
      t.variationPercent !== null &&
      Math.abs(t.variationPercent) >= TREND_MIN_PERCENT;

    return {
      window,
      totalExpense,
      averageExpense,
      expenseVariationPercent: this.variation(totalExpense, averageExpense),
      trends,
      growing: trends.filter((t) => t.direction === "UP" && relevant(t)).slice(0, 5),
      decreasing: trends.filter((t) => t.direction === "DOWN" && relevant(t)).slice(0, 5),
      outliers: this.outliers(input, window),
      savings: this.savingOpportunities(trends, budget, window),
      budget: this.budgetAnalysis(budget),
      goals: this.goalImpacts(input.goals ?? []),
      seasonality: this.seasonality(input),
      income: this.incomeAnalysis(input, window),
      concentration: this.concentration(input),
    };
  }
}

export const FinancialAnalyticsService = new FinancialAnalyticsServiceImpl();
export { FinancialAnalyticsServiceImpl };
