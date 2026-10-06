// Cotações por ativo.
//  - A última cotação de cada ativo fica salva e é carregada ao abrir a tela.
//  - O provider só é consultado quando o usuário pede (um ativo ou todos).
//  - Atualizar um ativo nunca apaga/altera as cotações dos outros.
//  - Sem intervalo mínimo entre atualizações (temporário, para testes).
import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MarketDataService } from "@/services/MarketDataService";
import { MarketQuotationServiceImpl } from "@/services/MarketQuotationService";
import {
  MarketQuoteStoreService,
  MarketQuoteStoreServiceImpl,
} from "@/services/MarketQuoteStoreService";
import { normalizeTicker } from "@/services/market/tickerMapping";
import type { EffectiveAsset } from "@/services/AssetValuationService";
import type { MarketQuoteMap } from "@/models/MarketData";

const EMPTY: MarketQuoteMap = {};

export function useMarketQuotes(assets: EffectiveAsset[], workspaceId?: string) {
  const qc = useQueryClient();
  const tickers = useMemo(
    () => MarketQuotationServiceImpl.tickersToQuote(assets).sort(),
    [assets],
  );
  const key = tickers.join(",");

  // Última cotação salva de cada ativo (não consulta o provider).
  const storedKey = ["market-quotes-stored", workspaceId ?? "anon"] as const;
  const stored = useQuery({
    queryKey: [...storedKey, key],
    queryFn: () => MarketQuoteStoreService.loadLatest(workspaceId!, tickers),
    enabled: !!workspaceId && tickers.length > 0,
    staleTime: Infinity,
    placeholderData: (prev) => prev,
  });

  // Resultados obtidos nesta sessão, acumulados por ticker.
  const [live, setLive] = useState<MarketQuoteMap>(EMPTY);
  const [pending, setPending] = useState<Set<string>>(() => new Set());
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const quotes = useMemo(
    () => MarketQuoteStoreServiceImpl.merge(stored.data ?? EMPTY, live),
    [stored.data, live],
  );

  const refreshTickers = useCallback(
    async (raw: string[]) => {
      const list = Array.from(new Set(raw.map((t) => normalizeTicker(t)).filter(Boolean)));
      if (list.length === 0) return;
      setPending((p) => new Set([...p, ...list]));
      try {
        const res = await MarketDataService.refreshQuotes(list);
        setLive((prev) => MarketQuoteStoreServiceImpl.merge(prev, res));
        if (Object.values(res).some((r) => r.status === "FOUND")) setUpdatedAt(Date.now());
        if (workspaceId) {
          const targets = assets
            .filter((a) => MarketQuotationServiceImpl.isQuotable(a))
            .map((a) => ({ id: a.id, ticker: normalizeTicker(a.ticker ?? "") }))
            .filter((a) => list.includes(a.ticker));
          await MarketQuoteStoreService.save(workspaceId, targets, res).catch(() => undefined);
          // Histórico do gráfico só dos ativos atualizados.
          for (const a of targets) {
            qc.invalidateQueries({ queryKey: ["market-price-history", a.id] });
          }
        }
      } finally {
        setPending((p) => {
          const next = new Set(p);
          list.forEach((t) => next.delete(t));
          return next;
        });
      }
    },
    [assets, workspaceId, qc],
  );

  const refresh = useCallback(() => refreshTickers(tickers), [refreshTickers, tickers]);

  const lastStoredAt = useMemo(() => {
    const times = Object.values(quotes)
      .map((q) => (q.quote?.quotedAt ? Date.parse(q.quote.quotedAt) : NaN))
      .filter(Number.isFinite);
    return times.length ? Math.max(...times) : null;
  }, [quotes]);

  return {
    quotes,
    tickers,
    hasQuotableAssets: tickers.length > 0,
    isFetching: pending.size > 0,
    pendingTickers: pending,
    updatedAt: updatedAt ?? lastStoredAt,
    /** Sem cooldown durante os testes. */
    manualCooldownUntil: null as number | null,
    nextAutoUpdate: null as Date | null,
    refresh,
    refreshTicker: (ticker: string) => refreshTickers([ticker]),
  };
}
