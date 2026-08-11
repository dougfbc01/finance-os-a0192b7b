// Modelos da Inteligência Financeira (Sprint 4.5).
// Nenhum valor aqui é persistido: tudo é derivado das movimentações reais.
import type { UUID } from "./index";

/** Confiabilidade da análise, derivada da quantidade de histórico disponível. */
export type AnalysisConfidence = "NONE" | "LOW" | "NORMAL";

export const CONFIDENCE_LABELS: Record<AnalysisConfidence, string> = {
  NONE: "Sem histórico suficiente",
  LOW: "Baixa confiabilidade",
  NORMAL: "Confiabilidade normal",
};

/** Janela histórica efetivamente utilizada nas análises. */
export interface HistoryWindow {
  /** Meses (yyyy-mm) anteriores ao período analisado que possuem dados. */
  months: string[];
  monthsAnalyzed: number;
  confidence: AnalysisConfidence;
  /** Texto explicativo: "Análise baseada em 3 meses de histórico." */
  label: string;
}

export type TrendDirection = "UP" | "DOWN" | "STABLE";

/** Tendência de uma categoria: atual x média histórica. */
export interface CategoryTrend {
  categoryId: UUID | null;
  name: string;
  current: number;
  average: number;
  difference: number;
  variationPercent: number | null;
  direction: TrendDirection;
  monthsAnalyzed: number;
  confidence: AnalysisConfidence;
}

/** Lançamento atípico dentro da própria categoria. */
export interface AnalyticsOutlier {
  movementId: UUID;
  description: string;
  date: string;
  amount: number;
  categoryId: UUID | null;
  categoryName: string;
  /** Média dos lançamentos da categoria na janela analisada. */
  average: number;
  /** Quantas vezes o lançamento supera a média. */
  times: number;
  samples: number;
  confidence: AnalysisConfidence;
}

/** Oportunidade de economia: média mensal acima do planejado. */
export interface SavingOpportunity {
  categoryId: UUID | null;
  name: string;
  monthlyAverage: number;
  planned: number;
  excess: number;
  monthsAnalyzed: number;
  confidence: AnalysisConfidence;
}

/** Linha simplificada de Planejado x Realizado (vinda do MonthlyBudgetService). */
export interface BudgetDeviation {
  key: string;
  categoryId: UUID | null;
  subcategoryId: UUID | null;
  label: string;
  planned: number;
  actual: number;
  difference: number;
  percent: number | null;
}

export interface BudgetAnalysis {
  year: number;
  month: number;
  over: BudgetDeviation[];
  near: BudgetDeviation[];
  under: BudgetDeviation[];
  incomeBelow: BudgetDeviation[];
}

/** Impacto do ritmo atual sobre uma meta financeira. */
export interface GoalImpact {
  goalId: UUID;
  name: string;
  requiredMonthly: number;
  currentPace: number;
  /** currentPace − requiredMonthly (negativo = abaixo do necessário). */
  difference: number;
}

/** Comparação simples com o mesmo mês do ano anterior. */
export interface SeasonalityPoint {
  monthKey: string;
  referenceKey: string;
  current: number;
  reference: number;
  variationPercent: number | null;
}

export interface IncomeAnalysis {
  current: number;
  average: number;
  difference: number;
  variationPercent: number | null;
  direction: TrendDirection;
  monthsAnalyzed: number;
  confidence: AnalysisConfidence;
  top: ConcentrationItem[];
  /** Participação da maior categoria de receita. */
  concentrationPercent: number | null;
}

export interface ConcentrationItem {
  categoryId: UUID | null;
  name: string;
  amount: number;
  percent: number;
}

export interface AnalyticsReport {
  window: HistoryWindow;
  totalExpense: number;
  averageExpense: number;
  expenseVariationPercent: number | null;
  trends: CategoryTrend[];
  growing: CategoryTrend[];
  decreasing: CategoryTrend[];
  outliers: AnalyticsOutlier[];
  savings: SavingOpportunity[];
  budget: BudgetAnalysis | null;
  goals: GoalImpact[];
  seasonality: SeasonalityPoint | null;
  income: IncomeAnalysis;
  concentration: ConcentrationItem[];
}
