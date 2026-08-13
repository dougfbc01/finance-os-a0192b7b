// InvestmentService — Filtragem e métricas de ativos de investimento.
// Regra: apenas ativos classificados como classes de investimento
// (renda fixa, ações, fundos, cripto, previdência, FIIs, ETFs, BDRs, etc.).
import { BaseService } from "./BaseService";
import { AssetServiceImpl } from "./AssetService";
import { AssetValuationServiceImpl } from "./AssetValuationService";
import { INVESTMENT_ASSET_TYPES } from "@/constants/enums";
import type { Asset } from "@/models";

export interface InvestmentRow {
  asset: Asset;
  invested: number; // valor de aquisição
  current: number; // valor atual
  profit: number;
  profitPercent: number;
}

class InvestmentServiceImpl extends BaseService {
  static filterInvestments(assets: Asset[]): Asset[] {
    return assets.filter(
      (a) =>
        a.is_active &&
        INVESTMENT_ASSET_TYPES.includes(a.asset_type) &&
        AssetValuationServiceImpl.countsInTotal(a),
    );
  }

  static rows(assets: Asset[]): InvestmentRow[] {
    return this.filterInvestments(assets).map((asset) => ({
      asset,
      invested: Number(asset.acquisition_value),
      current: Number(asset.current_value),
      profit: AssetServiceImpl.profit(asset),
      profitPercent: AssetServiceImpl.profitPercent(asset),
    }));
  }

  static totals(assets: Asset[]) {
    const rows = this.rows(assets);
    const invested = rows.reduce((s, r) => s + r.invested, 0);
    const current = rows.reduce((s, r) => s + r.current, 0);
    const profit = current - invested;
    const profitPercent = invested > 0 ? (profit / invested) * 100 : 0;
    return { invested, current, profit, profitPercent, count: rows.length };
  }
}

export const InvestmentService = new InvestmentServiceImpl();
export { InvestmentServiceImpl };
