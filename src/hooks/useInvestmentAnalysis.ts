import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAssets } from "./useAssets";
import { MarketHistoricalPriceService } from "@/services/MarketHistoricalPriceService";
import { investmentHistory } from "@/services/InvestmentAnalysisService";
import type { Movement } from "@/models";
import type { MarketPricePoint } from "@/models/MarketData";
import { InvestmentServiceImpl } from "@/services/InvestmentService";
import { investmentHistoryDates, validInvestmentRange } from "@/services/InvestmentViewService";

export function useInvestmentAnalysis(workspaceId: string | undefined, movements: Movement[], from: string, to: string, group: string, currency: string) {
  const queryClient = useQueryClient();
  const assetsQuery = useAssets(workspaceId);
  const rawAssets = useMemo(() => InvestmentServiceImpl.filterInvestments(assetsQuery.data ?? []).filter((a) => !a.deleted_at), [assetsQuery.data]);
  const validRange = validInvestmentRange(from, to, new Date().toISOString().slice(0, 10));
  const scoped = useMemo(() => rawAssets.filter((a) => a.currency === currency && (`${a.asset_type}_${a.currency}` === group || group === "ALL")), [rawAssets, currency, group]);
  const history = useQuery({
    queryKey: ["investment-analysis-prices", workspaceId, rawAssets.map((a) => a.id).sort().join(","), to],
    enabled: !!workspaceId && rawAssets.length > 0 && validRange,
    queryFn: async () => {
      if (!workspaceId) return {};
      const entries = await Promise.all(rawAssets.filter((a) => a.ticker && !a.deleted_at).map(async (a) => {
        const points = await MarketHistoricalPriceService.listStored({
          workspaceId, assetId: a.id, ticker: a.ticker ?? "", from: "1900-01-01", to,
        });
        return [a.id, points] as const;
      }));
      return Object.fromEntries(entries) as Record<string, MarketPricePoint[]>;
    },
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  // Provider is queried only on explicit request; stored quotes of other assets are never changed.
  const completeHistory = useMutation({
    mutationFn: async () => {
      if (!workspaceId) return [];
      return MarketHistoricalPriceService.completeHistory(workspaceId, scoped.filter((a) => a.ticker).map((a) => ({ id: a.id, ticker: a.ticker })), from, to);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["investment-analysis-prices", workspaceId] }),
  });
  const points = useMemo(() => {
    if (!validRange || scoped.length === 0) return [];
    return investmentHistory({ assets: scoped, movements, prices: history.data ?? {}, dates: investmentHistoryDates(from, to) });
  }, [scoped, movements, history.data, from, to, validRange]);
  return { points, completeHistory, isLoading: assetsQuery.isLoading || history.isLoading, error: assetsQuery.error ?? history.error };
}
