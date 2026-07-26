// PatrimonyService — Consolidação patrimonial.
// Combina saldos bancários (caixa), ativos declarados e passivos (faturas de cartão).
// Regra: Patrimônio Líquido = Ativos − Passivos.
import { BaseService } from "./BaseService";
import { AssetServiceImpl } from "./AssetService";
import { assetTypeToGroup, AssetClassGroup } from "@/constants/enums";
import type { Asset } from "@/models";
import type { CardInvoice } from "@/models/CardInvoice";

export interface GroupBreakdown {
  key: string;
  label: string;
  amount: number;
}

export interface PatrimonySnapshot {
  cash: number; // saldo bancário total
  assets: number; // soma dos ativos declarados (current_value)
  liabilities: number; // passivos (faturas em aberto/atrasadas/fechadas)
  totalAssets: number; // caixa + ativos
  netWorth: number; // totalAssets − liabilities
  assetProfit: number; // valor atual − valor de aquisição (agregado)
}

class PatrimonyServiceImpl extends BaseService {
  /** Passivo total dos cartões: soma das faturas não pagas (OPEN + CLOSED + OVERDUE). */
  static totalLiabilities(invoices: CardInvoice[]): number {
    return invoices
      .filter((i) => i.status !== "PAID" && !i.deleted_at)
      .reduce((s, i) => s + Number(i.amount), 0);
  }

  /** Total dos ativos declarados (valor de mercado atual). */
  static totalAssetsValue(assets: Asset[]): number {
    return assets.filter((a) => a.is_active).reduce((s, a) => s + Number(a.current_value), 0);
  }

  /** Rentabilidade agregada = soma(current − acquisition). */
  static totalAssetProfit(assets: Asset[]): number {
    return assets
      .filter((a) => a.is_active)
      .reduce((s, a) => s + AssetServiceImpl.profit(a), 0);
  }

  /** Snapshot completo do patrimônio. */
  static snapshot(params: {
    cashBalance: number;
    assets: Asset[];
    invoices: CardInvoice[];
  }): PatrimonySnapshot {
    const assets = this.totalAssetsValue(params.assets);
    const liabilities = this.totalLiabilities(params.invoices);
    const totalAssets = params.cashBalance + assets;
    return {
      cash: params.cashBalance,
      assets,
      liabilities,
      totalAssets,
      netWorth: totalAssets - liabilities,
      assetProfit: this.totalAssetProfit(params.assets),
    };
  }

  /** Distribuição dos ativos por classe macro (Caixa/RF/RV/…). Inclui caixa como grupo CAIXA. */
  static byClassGroup(cashBalance: number, assets: Asset[]): GroupBreakdown[] {
    const map = new Map<AssetClassGroup, number>();
    if (cashBalance !== 0) map.set(AssetClassGroup.CAIXA, cashBalance);
    for (const a of assets) {
      if (!a.is_active) continue;
      const g = assetTypeToGroup(a.asset_type);
      map.set(g, (map.get(g) ?? 0) + Number(a.current_value));
    }
    return Array.from(map.entries())
      .map(([key, amount]) => ({ key, label: key, amount }))
      .sort((a, b) => b.amount - a.amount);
  }

  /** Distribuição por instituição declarada nos ativos. */
  static byInstitution(assets: Asset[]): GroupBreakdown[] {
    const map = new Map<string, number>();
    for (const a of assets) {
      if (!a.is_active) continue;
      const key = (a.institution?.trim() || "Sem instituição");
      map.set(key, (map.get(key) ?? 0) + Number(a.current_value));
    }
    return Array.from(map.entries())
      .map(([key, amount]) => ({ key, label: key, amount }))
      .sort((a, b) => b.amount - a.amount);
  }
}

export const PatrimonyService = new PatrimonyServiceImpl();
export { PatrimonyServiceImpl };
