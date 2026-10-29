import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAssets } from "./useAssets";
import { MarketHistoricalPriceService } from "@/services/MarketHistoricalPriceService";
import { accountMirrorRows, capitalVsMarketMonthly, investmentMonthlyBase, isAccountMirrorInvestment, monthlyInvestmentHistory } from "@/services/InvestmentAnalysisService";
import type { Account, Movement } from "@/models";
import type { MarketPricePoint } from "@/models/MarketData";
import { InvestmentServiceImpl } from "@/services/InvestmentService";
import { validInvestmentRange } from "@/services/InvestmentViewService";

export function useInvestmentAnalysis(workspaceId: string | undefined, movements: Movement[], from: string, to: string, group: string, currency: string, accounts: Account[] = []) {
  const queryClient = useQueryClient();
  const assetsQuery = useAssets(workspaceId);
  const rawAssets = useMemo(() => InvestmentServiceImpl.filterInvestments(assetsQuery.data ?? []).filter((a) => !a.deleted_at), [assetsQuery.data]);
  // Ativos espelhados em conta (caixinha/CDB) não entram em filterInvestments;
  // na Análise eles são valorados pelo saldo da conta, sem tocar no Patrimônio.
  const mirrorAssets = useMemo(() => (assetsQuery.data ?? []).filter((a) => !a.deleted_at && isAccountMirrorInvestment(a)), [assetsQuery.data]);
  const validRange = validInvestmentRange(from, to, new Date().toISOString().slice(0, 10));
  const inScope = (a: { currency: string; asset_type: string }) => a.currency === currency && (`${a.asset_type}_${a.currency}` === group || group === "ALL");
  const scoped = useMemo(() => rawAssets.filter(inScope), [rawAssets, currency, group]);
  const scopedMirrors = useMemo(() => mirrorAssets.filter(inScope), [mirrorAssets, currency, group]);
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
  // Provider is queried only on explicit request; one quote per asset/month from its first movement until today.
  const completeHistory = useMutation({
    mutationFn: async () => {
      if (!workspaceId) return [];
      const today = new Date().toISOString().slice(0, 10);
      const targets = scoped.filter((a) => a.ticker).flatMap((a) => {
        const first = movements.filter((m) => !m.deleted_at && (m.asset_id === a.id || (m.tags ?? []).includes(`cost:SOURCE:${a.id}`)))
          .map((m) => m.transaction_date).sort()[0];
        return first ? [{ id: a.id, ticker: a.ticker, from: first }] : [];
      });
      return MarketHistoricalPriceService.completeMonthlyHistory(workspaceId, targets, today);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["investment-analysis-prices", workspaceId] }),
  });
  const analysisAssets = useMemo(() => [...scoped, ...scopedMirrors], [scoped, scopedMirrors]);
  const monthlyBase = useMemo(() => {
    if (!validRange || analysisAssets.length === 0) return [];
    return investmentMonthlyBase({ assets: analysisAssets, movements, prices: history.data ?? {}, from, to, accounts });
  }, [analysisAssets, movements, history.data, from, to, validRange, accounts]);
  const points = useMemo(() => monthlyInvestmentHistory(monthlyBase, from, to), [monthlyBase, from, to]);
  const capitalVsMarket = useMemo(() => validRange ? capitalVsMarketMonthly({
    assets: analysisAssets, movements, prices: history.data ?? {}, from, to, accounts,
  }) : [], [analysisAssets, movements, history.data, from, to, validRange, accounts]);
  const today = new Date().toISOString().slice(0, 10);
  const accountRows = useMemo(() => accountMirrorRows(scopedMirrors, accounts, movements, today), [scopedMirrors, accounts, movements, today]);
  return { points, monthlyBase, capitalVsMarket, accountRows, completeHistory, isLoading: assetsQuery.isLoading || history.isLoading, error: assetsQuery.error ?? history.error };
}
