// Sprint 4.11 — cotações atuais dos ativos negociados em mercado.
// A consulta NÃO acontece a cada render: é uma query com cache (react-query)
// + cache em memória do MarketDataService, atualizada sob demanda pelo usuário.
import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MarketDataService } from "@/services/MarketDataService";
import { MarketQuotationServiceImpl } from "@/services/MarketQuotationService";
import type { EffectiveAsset } from "@/services/AssetValuationService";
import type { MarketQuoteMap } from "@/models/MarketData";

const EMPTY: MarketQuoteMap = {};

export function useMarketQuotes(assets: EffectiveAsset[]) {
  const tickers = useMemo(
    () => MarketQuotationServiceImpl.tickersToQuote(assets).sort(),
    [assets],
  );
  const key = tickers.join(",");

  const query = useQuery({
    queryKey: ["market-quotes", key],
    queryFn: () => MarketDataService.getQuotes(tickers),
    enabled: tickers.length > 0,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });

  const refresh = useCallback(async () => {
    MarketDataService.clearQuoteCache();
    await query.refetch();
  }, [query]);

  return {
    quotes: query.data ?? EMPTY,
    tickers,
    hasQuotableAssets: tickers.length > 0,
    isFetching: query.isFetching,
    updatedAt: query.dataUpdatedAt || null,
    refresh,
  };
}
