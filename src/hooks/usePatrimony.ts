import { useMemo } from "react";
import { useWorkspace } from "./useWorkspace";
import { useAssets } from "./useAssets";
import { useCardInvoices } from "./useCardInvoices";
import { useDashboardData } from "./useDashboard";
import { useMarketQuotes } from "./useMarketQuotes";
import { PatrimonyServiceImpl } from "@/services/PatrimonyService";
import { InvestmentServiceImpl } from "@/services/InvestmentService";
import { AssetValuationServiceImpl } from "@/services/AssetValuationService";
import { MarketQuotationServiceImpl } from "@/services/MarketQuotationService";

export function usePatrimony() {
  const { data: ws } = useWorkspace();
  const wsId = ws?.id as string | undefined;
  const assetsQ = useAssets(wsId);
  const invoicesQ = useCardInvoices(wsId);
  const dash = useDashboardData();

  const rawAssets = assetsQ.data ?? [];
  const invoices = invoicesQ.data ?? [];
  const cashBalance = dash.totalBalance;

  // Sprint 4.5.2 — o valor do ativo é sempre derivado da sua fonte declarada
  // (manual, movimentações ou saldo de conta). Nada é persistido.
  const valuedAssets = useMemo(
    () => AssetValuationServiceImpl.effectiveAssets(rawAssets, dash.movements, dash.balances),
    [rawAssets, dash.movements, dash.balances],
  );

  // Sprint 4.11 — cotação atual aplicada por cima da valoração existente.
  // Ativos ACCOUNT e sem ticker seguem exatamente como antes.
  const marketQuotes = useMarketQuotes(valuedAssets, wsId);
  const assets = useMemo(
    () => MarketQuotationServiceImpl.applyQuotes(valuedAssets, marketQuotes.quotes),
    [valuedAssets, marketQuotes.quotes],
  );

  const snapshot = useMemo(
    () => PatrimonyServiceImpl.snapshot({ cashBalance, assets, invoices }),
    [cashBalance, assets, invoices],
  );
  const byClass = useMemo(
    () => PatrimonyServiceImpl.byClassGroup(cashBalance, assets),
    [cashBalance, assets],
  );
  const byInstitution = useMemo(
    () => PatrimonyServiceImpl.byInstitution(assets),
    [assets],
  );
  const composition = useMemo(
    () =>
      PatrimonyServiceImpl.composition({
        accounts: dash.accounts,
        balances: dash.balances,
        assets,
      }),
    [dash.accounts, dash.balances, assets],
  );
  const investments = useMemo(() => InvestmentServiceImpl.rows(assets), [assets]);
  const investmentTotals = useMemo(() => InvestmentServiceImpl.totals(assets), [assets]);

  const quotedById = useMemo(
    () => new Map(assets.map((a) => [a.id, a] as const)),
    [assets],
  );

  return {
    workspace: ws,
    assets,
    quotedById,
    invoices,
    snapshot,
    byClass,
    byInstitution,
    composition,
    accounts: dash.accounts,
    movements: dash.movements,
    investments,
    investmentTotals,
    cashflow: dash.cashflow,
    quotes: marketQuotes.quotes,
    hasQuotableAssets: marketQuotes.hasQuotableAssets,
    isQuotesFetching: marketQuotes.isFetching,
    quotesUpdatedAt: marketQuotes.updatedAt,
    quotesCooldownUntil: marketQuotes.manualCooldownUntil,
    quotesNextAutoUpdate: marketQuotes.nextAutoUpdate,
    refreshQuotes: marketQuotes.refresh,
    isLoading: assetsQ.isLoading || invoicesQ.isLoading || dash.isLoading,
  };
}
