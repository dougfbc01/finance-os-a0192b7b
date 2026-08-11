// useFinancialInsights — orquestra os dados já existentes e delega a geração
// dos insights ao FinancialInsightsService. Nenhum cálculo acontece aqui.
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { useWorkspace } from "./useWorkspace";
import { useDashboardAnalytics } from "./useDashboardAnalytics";
import { usePatrimony } from "./usePatrimony";
import { useCards } from "./useCards";
import { useClassificationRules, useReprocessRules } from "./useClassificationRules";
import { useDuplicatePairs } from "./useDuplicates";
import { useRuleIntegrity } from "./useRuleIntegrity";
import { useHealthCheckRuns, useRunHealthCheck } from "./useHealthCheck";
import { useInsightDismiss } from "./useInsightDismiss";
import { useMonthlyBudget } from "./useMonthlyBudgets";
import { FinancialGoalService } from "@/services/FinancialGoalService";
import { useFinancialGoals } from "./useFinancialGoals";
import { FinancialInsightsService } from "@/services/FinancialInsightsService";
import { FinancialAnalyticsService } from "@/services/FinancialAnalyticsService";
import type { ResolvedPeriod } from "@/services/DashboardFilterService";
import type { FinancialInsight, InsightSummary } from "@/models/Insight";
import type { AnalyticsReport } from "@/models/Analytics";

export interface FinancialInsightsState {
  insights: FinancialInsight[];
  summary: InsightSummary;
  /** Relatório comportamental (Sprint 4.5). */
  analytics: AnalyticsReport;
  /** Resumo executivo em linguagem natural. */
  behaviorSummary: string[];
  isLoading: boolean;
  dismiss: (insight: FinancialInsight) => void;
  restoreAll: () => void;
  runHealthCheck: () => void;
  reprocessRules: () => void;
  isRunningAction: boolean;
}


export function useFinancialInsights(resolved: ResolvedPeriod): FinancialInsightsState {
  const { data: ws } = useWorkspace();
  const wsId = ws?.id as string | undefined;

  const analytics = useDashboardAnalytics(resolved);
  const { snapshot } = usePatrimony();
  const { data: rules = [] } = useClassificationRules(wsId);
  const { data: cards = [] } = useCards(wsId);
  const { data: pairs = [], isLoading: pairsLoading } = useDuplicatePairs(wsId);
  const { data: runs = [] } = useHealthCheckRuns(wsId);
  const ruleReport = useRuleIntegrity(rules);
  const { dismiss, restoreAll, isDismissed } = useInsightDismiss();

  // Planejamento Mensal do mês de referência do período (Sprint 4.3).
  const refDate = new Date(`${resolved.end}T00:00:00`);
  const { comparison: budget } = useMonthlyBudget(
    refDate.getFullYear(),
    refDate.getMonth() + 1,
  );

  const { progress: goalProgress } = useFinancialGoals();
  const goalBudget = useMemo(
    () => FinancialGoalService.budgetRelation(goalProgress, budget ?? null),
    [goalProgress, budget],
  );

  const runHealthMut = useRunHealthCheck();
  const reprocessMut = useReprocessRules();

  const lastRun = runs[0];

  const duplicatePairs = useMemo(
    () =>
      pairs.map((p) => ({
        confidence: p.score.confidence_match,
        amount: Math.abs(Number(p.duplicate.amount)),
        description: p.duplicate.description,
      })),
    [pairs],
  );

  // Sprint 4.5 — relatório comportamental (tendências, outliers, sazonalidade).
  const report = useMemo(
    () =>
      FinancialAnalyticsService.analyze({
        range: { start: resolved.start, end: resolved.end },
        movements: analytics.movements,
        categories: analytics.categories.map((c) => ({ id: c.id, name: c.name })),
        budget,
        goals: goalProgress,
      }),
    [resolved.start, resolved.end, analytics.movements, analytics.categories, budget, goalProgress],
  );

  const behaviorSummary = useMemo(
    () => FinancialInsightsService.behaviorSummary(report),
    [report],
  );

  const result = useMemo(
    () =>
      FinancialInsightsService.analyze({
        range: { start: resolved.start, end: resolved.end },
        previousRange: resolved.previous,
        movements: analytics.movements,
        categories: analytics.categories.map((c) => ({ id: c.id, name: c.name })),
        snapshot,
        netWorthSeries: analytics.netWorthSeries,
        summary: analytics.summary,
        duplicatePairs,
        ruleReport,
        rules,
        cards,
        healthIssues: lastRun ? lastRun.issues : null,
        healthCheckedAt: lastRun?.created_at ?? null,
        budget,
        goals: goalProgress,
        goalBudget,
        analytics: report,
      }),

    [
      resolved.start,
      resolved.end,
      resolved.previous,
      analytics.movements,
      analytics.categories,
      analytics.netWorthSeries,
      analytics.summary,
      snapshot,
      duplicatePairs,
      ruleReport,
      rules,
      cards,
      lastRun,
      budget,
      goalProgress,
      goalBudget,
    ],
  );

  const visible = useMemo(
    () => result.insights.filter((i) => !isDismissed(i)),
    [result.insights, isDismissed],
  );

  const summary = useMemo(
    () => FinancialInsightsService.summarize(visible),
    [visible],
  );

  const runHealthCheck = useCallback(() => {
    if (!wsId) return;
    runHealthMut.mutate(wsId, {
      onSuccess: () => toast.success("Health Check executado"),
      onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
    });
  }, [wsId, runHealthMut]);

  const reprocessRules = useCallback(() => {
    if (!wsId) return;
    reprocessMut.mutate(wsId, {
      onSuccess: () => toast.success("Regras reprocessadas"),
      onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
    });
  }, [wsId, reprocessMut]);

  return {
    insights: visible,
    summary,
    isLoading: analytics.isLoading || pairsLoading,
    dismiss,
    restoreAll,
    runHealthCheck,
    reprocessRules,
    isRunningAction: runHealthMut.isPending || reprocessMut.isPending,
  };
}
