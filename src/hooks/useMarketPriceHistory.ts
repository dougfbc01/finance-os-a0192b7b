// Sprint 4.12 — histórico de preços de mercado de um ativo.
// A consulta passa pelo MarketHistoricalPriceService, que reutiliza o que já
// está armazenado e só chama o provider (server-side) quando necessário.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MarketHistoricalPriceService } from "@/services/MarketHistoricalPriceService";
import { toISODate } from "@/lib/format";
import type { UUID } from "@/models";

export type MarketHistoryPeriod = "1M" | "3M" | "6M" | "1A" | "MAX";

export const MARKET_HISTORY_PERIOD_LABELS: Record<MarketHistoryPeriod, string> = {
  "1M": "1 mês",
  "3M": "3 meses",
  "6M": "6 meses",
  "1A": "1 ano",
  MAX: "Desde o início",
};

export function periodRange(period: MarketHistoryPeriod, now = new Date()) {
  const to = toISODate(now);
  const from = new Date(now);
  switch (period) {
    case "1M":
      from.setMonth(from.getMonth() - 1);
      break;
    case "3M":
      from.setMonth(from.getMonth() - 3);
      break;
    case "6M":
      from.setMonth(from.getMonth() - 6);
      break;
    case "1A":
      from.setFullYear(from.getFullYear() - 1);
      break;
    case "MAX":
      from.setFullYear(from.getFullYear() - 10);
      break;
  }
  return { from: toISODate(from), to };
}

export function useMarketPriceHistory(
  asset: { id: UUID; workspace_id: UUID; ticker?: string | null } | null,
  period: MarketHistoryPeriod,
  enabled: boolean,
) {
  const range = useMemo(() => periodRange(period), [period]);
  const ticker = (asset?.ticker ?? "").trim().toUpperCase();

  const query = useQuery({
    queryKey: ["market-price-history", asset?.id, period, range.from, range.to],
    queryFn: () =>
      MarketHistoricalPriceService.getHistory({
        workspaceId: asset!.workspace_id,
        assetId: asset!.id,
        ticker,
        from: range.from,
        to: range.to,
      }),
    enabled: enabled && !!asset && !!ticker,
    staleTime: 6 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const points = useMemo(() => query.data?.points ?? [], [query.data]);

  const stats = useMemo(() => {
    if (points.length === 0) return null;
    const first = points[0]!;
    const last = points[points.length - 1]!;
    let high = first.close;
    let low = first.close;
    for (const p of points) {
      if (p.close > high) high = p.close;
      if (p.close < low) low = p.close;
    }
    const change = last.close - first.close;
    const changePercent = first.close > 0 ? (change / first.close) * 100 : 0;
    return {
      first,
      last,
      high,
      low,
      change,
      changePercent,
      realFrom: first.date,
      realTo: last.date,
      count: points.length,
    };
  }, [points]);

  return {
    points,
    stats,
    status: query.data?.status ?? null,
    message: query.data?.message ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
  };
}
