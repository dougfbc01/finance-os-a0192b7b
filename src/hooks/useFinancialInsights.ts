// useFinancialInsights — orquestra os dados já existentes e delega a geração
// dos insights ao FinancialInsightsService. Nenhum cálculo acontece aqui.
import { useMemo } from "react";
import { useWorkspace } from "./useWorkspace";
import { useDashboardAnalytics } from "./useDashboardAnalytics";
import { usePatrimony } from "./usePatrimony";
import { useClassificationRules } from "./useClassificationRules";
import { useDuplicatePairs } from "./useDuplicates";
import { useRuleIntegrity } from "./useRuleIntegrity";
import { FinancialInsightsService } from "@/services/FinancialInsightsService";
import type { ResolvedPeriod } from "@/services/DashboardFilterService";
import type { FinancialInsight } from "@/models/Insight";

export function useFinancialInsights(resolved: ResolvedPeriod): {
  insights: FinancialInsight[];
  isLoading: boolean;
} {
  const { data: ws } = useWorkspace();
  const wsId = ws?.id as string | undefined;

  const analytics = useDashboardAnalytics(resolved);
  const { snapshot } = usePatrimony();
  const { data: rules = [] } = useClassificationRules(wsId);
  const { data: pairs = [], isLoading: pairsLoading } = useDuplicatePairs(wsId);
  const ruleReport = useRuleIntegrity(rules);

  const insights = useMemo(
    () =>
      FinancialInsightsService.build({
        range: { start: resolved.start, end: resolved.end },
        previousRange: resolved.previous,
        movements: analytics.movements,
        categories: analytics.categories.map((c) => ({ id: c.id, name: c.name })),
        snapshot,
        netWorthSeries: analytics.netWorthSeries,
        summary: analytics.summary,
        duplicateCount: pairs.length,
        ruleReport,
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
      pairs.length,
      ruleReport,
    ],
  );

  return { insights, isLoading: analytics.isLoading || pairsLoading };
}
