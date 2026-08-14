// PatrimonyService — Consolidação patrimonial.
// Combina saldos bancários (caixa), ativos declarados e passivos (faturas de cartão).
// Regra: Patrimônio Líquido = Ativos − Passivos.
import { BaseService } from "./BaseService";
import { AssetServiceImpl } from "./AssetService";
import { AssetValuationServiceImpl } from "./AssetValuationService";
import {
  assetTypeToGroup,
  assetTypeToBucket,
  AssetClassGroup,
  AssetValuationSource,
  PatrimonyBucket,
  PATRIMONY_BUCKET_LABELS,
  PATRIMONY_BUCKET_ORDER,
} from "@/constants/enums";
import type { Asset } from "@/models";
import type { CardInvoice } from "@/models/CardInvoice";

export type CompositionItemKind = "ACCOUNT" | "ASSET";

export interface CompositionItem {
  id: string;
  label: string;
  sublabel: string | null;
  amount: number;
  kind: CompositionItemKind;
  /** Presente quando o item é um ativo declarado (drill-down até o ativo). */
  assetId?: string;
  /** Presente quando o item é uma conta (ou a conta espelhada de uma caixinha). */
  accountId?: string;
}

export interface CompositionBucket {
  key: PatrimonyBucket;
  label: string;
  amount: number;
  /** Participação no patrimônio bruto (0-100). */
  percent: number;
  items: CompositionItem[];
}

export interface PatrimonyComposition {
  buckets: CompositionBucket[];
  /** Patrimônio bruto = caixa + ativos contáveis (idêntico a snapshot.totalAssets). */
  total: number;
}

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

  /**
   * Ativos que podem entrar no total sem dupla contagem.
   * Ativos que espelham uma conta (caixinhas) já estão representados no caixa.
   */
  static countableAssets(assets: Asset[]): Asset[] {
    return assets.filter((a) => a.is_active && AssetValuationServiceImpl.countsInTotal(a));
  }

  /** Total dos ativos declarados (valor de mercado atual). */
  static totalAssetsValue(assets: Asset[]): number {
    return this.countableAssets(assets).reduce((s, a) => s + Number(a.current_value), 0);
  }

  /** Rentabilidade agregada = soma(current − acquisition). */
  static totalAssetProfit(assets: Asset[]): number {
    return this.countableAssets(assets).reduce((s, a) => s + AssetServiceImpl.profit(a), 0);
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
    for (const a of this.countableAssets(assets)) {
      const g = assetTypeToGroup(a.asset_type);
      map.set(g, (map.get(g) ?? 0) + Number(a.current_value));
    }
    return Array.from(map.entries())
      .map(([key, amount]) => ({ key, label: key, amount }))
      .sort((a, b) => b.amount - a.amount);
  }

  /**
   * Sprint 4.6 — composição patrimonial por tipo, com drill-down.
   *
   * Não é um segundo cálculo de patrimônio: reutiliza exatamente as mesmas
   * regras de `snapshot` (caixa + ativos contáveis). Caixinhas (ativos com
   * origem ACCOUNT) aparecem no seu próprio bucket usando o saldo da conta
   * espelhada e a conta correspondente é removida do bucket "Contas",
   * garantindo total idêntico e zero dupla contagem.
   */
  static composition(params: {
    accounts: { id: string; name: string; institution?: string | null }[];
    balances: Record<string, number>;
    assets: Asset[];
  }): PatrimonyComposition {
    const items = new Map<PatrimonyBucket, CompositionItem[]>();
    const push = (bucket: PatrimonyBucket, item: CompositionItem) => {
      const list = items.get(bucket) ?? [];
      list.push(item);
      items.set(bucket, list);
    };

    // Caixinhas: ativos que espelham uma conta.
    const mirrored = new Set<string>();
    for (const a of params.assets) {
      if (a.valuation_source !== AssetValuationSource.ACCOUNT || !a.account_id) continue;
      if (!a.is_active) continue;
      mirrored.add(a.account_id);
      push(PatrimonyBucket.CAIXINHAS, {
        id: a.id,
        label: a.name,
        sublabel: a.institution ?? null,
        amount: Number(a.current_value) || 0,
        kind: "ASSET",
        assetId: a.id,
        accountId: a.account_id,
      });
    }

    // Contas: saldo do caixa que não está representado por uma caixinha.
    for (const acc of params.accounts) {
      if (mirrored.has(acc.id)) continue;
      const amount = params.balances[acc.id] ?? 0;
      if (amount === 0) continue;
      push(PatrimonyBucket.CONTAS, {
        id: acc.id,
        label: acc.name,
        sublabel: acc.institution ?? null,
        amount,
        kind: "ACCOUNT",
        accountId: acc.id,
      });
    }

    // Ativos declarados que somam no patrimônio.
    for (const a of this.countableAssets(params.assets)) {
      push(assetTypeToBucket(a.asset_type), {
        id: a.id,
        label: a.name,
        sublabel: a.institution ?? null,
        amount: Number(a.current_value) || 0,
        kind: "ASSET",
        assetId: a.id,
      });
    }

    const buckets: CompositionBucket[] = PATRIMONY_BUCKET_ORDER.map((key) => {
      const list = (items.get(key) ?? []).sort((x, y) => y.amount - x.amount);
      return {
        key,
        label: PATRIMONY_BUCKET_LABELS[key],
        amount: list.reduce((s, i) => s + i.amount, 0),
        percent: 0,
        items: list,
      };
    }).filter((b) => b.items.length > 0);

    const total = buckets.reduce((s, b) => s + b.amount, 0);
    for (const b of buckets) {
      b.percent = total !== 0 ? Number(((b.amount / total) * 100).toFixed(2)) : 0;
    }
    return { buckets, total };
  }

  /** Distribuição por instituição declarada nos ativos. */
  static byInstitution(assets: Asset[]): GroupBreakdown[] {
    const map = new Map<string, number>();
    for (const a of this.countableAssets(assets)) {
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
