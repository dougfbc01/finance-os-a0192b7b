import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAssets } from "./useAssets";
import { MarketHistoricalPriceService } from "@/services/MarketHistoricalPriceService";
import { investmentHistory } from "@/services/InvestmentAnalysisService";
import type { Movement } from "@/models";
import type { MarketPricePoint } from "@/models/MarketData";

export function useInvestmentAnalysis(workspaceId: string | undefined, movements: Movement[], from: string, to: string, group: string) {
  const assetsQuery = useAssets(workspaceId);
  const rawAssets = assetsQuery.data ?? [];
  const history = useQuery({
    queryKey: ["investment-analysis-prices", workspaceId, rawAssets.map((a) => a.id).sort().join(","), to],
    enabled: !!workspaceId && rawAssets.length > 0,
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
  const points = useMemo(() => {
    if (!from || !to || from > to) return [];
    const assets = rawAssets.filter((a) => `${a.asset_type}_${a.currency}` === group || group === "ALL");
    const dates = new Set([from, to]);
    // Monthly endpoints keep long histories legible; short periods retain daily observations.
    const cursor = new Date(`${from}T00:00:00Z`);
    const daily = (Date.parse(to) - Date.parse(from)) / 86400000 <= 100;
    while (cursor.toISOString().slice(0, 10) < to) {
      if (daily) cursor.setUTCDate(cursor.getUTCDate() + 1);
      else cursor.setUTCMonth(cursor.getUTCMonth() + 1, 0);
      const date = cursor.toISOString().slice(0, 10);
      if (date >= from && date <= to) dates.add(date);
      if (!daily) cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return investmentHistory({ assets, movements, prices: history.data ?? {}, dates: [...dates].sort() });
  }, [rawAssets, movements, history.data, from, to, group]);
  return { points, isLoading: assetsQuery.isLoading || history.isLoading, error: history.error };
}