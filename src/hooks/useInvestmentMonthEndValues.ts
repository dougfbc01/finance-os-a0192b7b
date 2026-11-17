// Valor dos investimentos no fim de cada mês para Patrimônio histórico (Dashboard/Fechamentos).
// Apenas orquestra: a regra vive em InvestmentAnalysisService (mesma base mensal da Análise).
import { useMemo } from "react";
import { useAssets } from "./useAssets";
import { useAllMovements } from "./useMovements";
import { useStoredInvestmentPrices } from "./useInvestmentAnalysis";
import { InvestmentServiceImpl } from "@/services/InvestmentService";
import { investmentMonthlyBase, monthEndInvestmentValues, type MonthEndInvestmentValue } from "@/services/InvestmentAnalysisService";

export function useInvestmentMonthEndValues(workspaceId: string | undefined) {
  const assetsQ = useAssets(workspaceId);
  const movementsQ = useAllMovements(workspaceId);
  const today = new Date().toISOString().slice(0, 10);
  const rawAssets = useMemo(
    () => InvestmentServiceImpl.filterInvestments(assetsQ.data ?? []).filter((a) => !a.deleted_at),
    [assetsQ.data],
  );
  const prices = useStoredInvestmentPrices(workspaceId, rawAssets, today);
  const detail = useMemo<Record<string, MonthEndInvestmentValue>>(() => {
    const movements = movementsQ.data ?? [];
    if (rawAssets.length === 0) return {};
    const from = movements.filter((m) => !m.deleted_at).map((m) => m.transaction_date).sort()[0] ?? today;
    const base = investmentMonthlyBase({ assets: rawAssets, movements, prices: prices.data ?? {}, from, to: today });
    const current = Object.fromEntries(rawAssets.map((a) => [a.id, Number(a.current_value) || 0]));
    return monthEndInvestmentValues(base, today, current);
  }, [rawAssets, movementsQ.data, prices.data, today]);
  const values = useMemo(
    () => Object.fromEntries(Object.entries(detail).map(([k, v]) => [k, v.value])) as Record<string, number>,
    [detail],
  );
  return {
    values,
    detail,
    isLoading: assetsQ.isLoading || movementsQ.isLoading || (rawAssets.length > 0 && prices.isLoading),
  };
}
