// Sprint 4.11 — cotações atuais dos ativos negociados em mercado.
// Sprint 4.12 — controle de frequência:
//   - atualização automática no máximo 1 vez por dia por workspace;
//   - atualização manual com cooldown de 30 minutos após sucesso.
// A consulta NÃO acontece a cada render: é uma query com cache (react-query)
// + cache em memória do MarketDataService. O carimbo de frequência fica em
// localStorage (por workspace) — não é um segundo cache de cotações.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MarketDataService } from "@/services/MarketDataService";
import { MarketQuotationServiceImpl } from "@/services/MarketQuotationService";
import {
  EMPTY_SCHEDULE,
  loadQuoteSchedule,
  MarketQuoteScheduleService,
  saveQuoteSchedule,
  type QuoteScheduleState,
} from "@/services/MarketQuoteScheduleService";
import type { EffectiveAsset } from "@/services/AssetValuationService";
import type { MarketQuoteMap } from "@/models/MarketData";

const EMPTY: MarketQuoteMap = {};

export function useMarketQuotes(assets: EffectiveAsset[], workspaceId?: string) {
  const tickers = useMemo(
    () => MarketQuotationServiceImpl.tickersToQuote(assets).sort(),
    [assets],
  );
  const key = tickers.join(",");

  const [schedule, setSchedule] = useState<QuoteScheduleState>(() =>
    workspaceId ? loadQuoteSchedule(workspaceId) : EMPTY_SCHEDULE,
  );
  // Recarrega o carimbo quando o workspace muda.
  useEffect(() => {
    setSchedule(workspaceId ? loadQuoteSchedule(workspaceId) : EMPTY_SCHEDULE);
  }, [workspaceId]);

  const persist = useCallback(
    (next: QuoteScheduleState) => {
      setSchedule(next);
      if (workspaceId) saveQuoteSchedule(workspaceId, next);
    },
    [workspaceId],
  );

  // Atualização automática: só dispara se ainda não houve atualização hoje.
  const autoAllowed = MarketQuoteScheduleService.canAutoUpdate(schedule);

  const query = useQuery({
    queryKey: ["market-quotes", workspaceId ?? "anon", key],
    queryFn: () => MarketDataService.getQuotes(tickers),
    enabled: tickers.length > 0 && autoAllowed,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });

  // Marca a atualização automática do dia quando a query busca com sucesso
  // (a atualização manual marca a si mesma via `manualRef`).
  const manualRef = useRef(false);
  const lastMarkedRef = useRef(0);
  useEffect(() => {
    if (!query.dataUpdatedAt || query.dataUpdatedAt === lastMarkedRef.current) return;
    if (manualRef.current) return;
    lastMarkedRef.current = query.dataUpdatedAt;
    persist(MarketQuoteScheduleService.markAutoUpdate(schedule, new Date(query.dataUpdatedAt)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.dataUpdatedAt]);

  const manualCheck = MarketQuoteScheduleService.checkManualUpdate(schedule);

  const refresh = useCallback(async () => {
    const check = MarketQuoteScheduleService.checkManualUpdate(schedule);
    if (!check.allowed) return check;
    manualRef.current = true;
    try {
      MarketDataService.clearQuoteCache();
      const res = await query.refetch();
      if (!res.isError) {
        lastMarkedRef.current = Date.now();
        persist(MarketQuoteScheduleService.markManualUpdate(schedule));
      }
      return check;
    } finally {
      manualRef.current = false;
    }
  }, [query, schedule, persist]);

  const lastUpdatedAt = schedule.lastSuccessAt ?? (query.dataUpdatedAt || null);
  const nextAutoUpdate = MarketQuoteScheduleService.nextAutoUpdateDate(schedule);

  return {
    quotes: query.data ?? EMPTY,
    tickers,
    hasQuotableAssets: tickers.length > 0,
    isFetching: query.isFetching,
    /** Epoch ms da última atualização bem-sucedida (null = nunca atualizado). */
    updatedAt: lastUpdatedAt,
    /** Cooldown manual ativo: epoch ms em que a próxima consulta manual libera. */
    manualCooldownUntil: manualCheck.allowed ? null : manualCheck.nextAllowedAt,
    /** Próxima atualização automática previsível (null quando indeterminado). */
    nextAutoUpdate,
    refresh,
  };
}
