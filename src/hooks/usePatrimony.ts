import { useMemo } from "react";
import { useWorkspace } from "./useWorkspace";
import { useAssets } from "./useAssets";
import { useCardInvoices } from "./useCardInvoices";
import { useDashboardData } from "./useDashboard";
import { PatrimonyServiceImpl } from "@/services/PatrimonyService";
import { InvestmentServiceImpl } from "@/services/InvestmentService";

export function usePatrimony() {
  const { data: ws } = useWorkspace();
  const wsId = ws?.id as string | undefined;
  const assetsQ = useAssets(wsId);
  const invoicesQ = useCardInvoices(wsId);
  const dash = useDashboardData();

  const assets = assetsQ.data ?? [];
  const invoices = invoicesQ.data ?? [];
  const cashBalance = dash.totalBalance;

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
  const investments = useMemo(() => InvestmentServiceImpl.rows(assets), [assets]);
  const investmentTotals = useMemo(() => InvestmentServiceImpl.totals(assets), [assets]);

  return {
    workspace: ws,
    assets,
    invoices,
    snapshot,
    byClass,
    byInstitution,
    investments,
    investmentTotals,
    cashflow: dash.cashflow,
    isLoading: assetsQ.isLoading || invoicesQ.isLoading || dash.isLoading,
  };
}
