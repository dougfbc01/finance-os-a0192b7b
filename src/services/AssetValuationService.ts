// AssetValuationService — Sprint 4.5.2
// Fonte única de verdade sobre QUAL é o valor patrimonial de um ativo.
//
// Regras (documentadas em /docs — Regras de Negócio):
//  - MANUAL     → o valor é o informado pelo usuário (current_value).
//  - MOVEMENTS  → valor = opening_value + impacto das movimentações do ativo.
//  - ACCOUNT    → o ativo apenas ESPELHA o saldo de uma conta (caixinhas).
//                 Nunca entra no total de ativos, pois o saldo já está no caixa.
//
// Nenhuma movimentação artificial é criada. Nada é persistido: tudo é derivado.
import { BaseService } from "./BaseService";
import {
  AssetValuationSource,
  InvestmentOperation,
  INVESTMENT_OP_TAG_PREFIX,
  MovementType,
  MOVEMENT_TYPE_SIGN,
} from "@/constants/enums";
import type { Asset, Movement, UUID } from "@/models";

export interface AssetMovementImpact {
  /** Variação total do valor do ativo (aportes − resgates + rendimentos). */
  delta: number;
  /** Capital efetivamente aplicado (aportes − resgates). */
  invested: number;
  /** Rendimentos creditados no próprio ativo. */
  yields: number;
  count: number;
}

export interface EffectiveAsset extends Asset {
  /** Valor patrimonial efetivo, já resolvido pela fonte. */
  effective_value: number;
  /** Capital aplicado efetivo (base do cálculo de rentabilidade). */
  effective_acquisition: number;
  /** Impacto agregado das movimentações vinculadas. */
  impact: AssetMovementImpact;
  /** Sprint 4.8 — posição reconstruída pelas operações vinculadas. */
  position: AssetPosition;
  /** Quantidade efetiva exibida (posição quando a fonte é MOVEMENTS). */
  effective_quantity: number;
  /** Preço médio efetivo exibido (das operações quando a fonte é MOVEMENTS). */
  effective_unit_price: number;
  /**
   * Se `false`, o valor NÃO deve ser somado ao total de ativos
   * (evita dupla contagem — caso das caixinhas modeladas como conta).
   */
  counts_in_total: boolean;
}


export interface AssetPosition {
  /** Quantidade acumulada (0 quando as operações não informam quantidade). */
  quantity: number;
  /** Custo histórico total da posição em aberto. */
  cost: number;
  /** Preço médio (custo / quantidade). */
  averagePrice: number;
  /** Parte do custo originada de operações históricas. */
  historicalCost: number;
  /** Parte do custo originada de operações financeiras atuais. */
  currentCost: number;
  yields: number;
  operations: number;
  historicalOperations: number;
}

const EMPTY_IMPACT: AssetMovementImpact = { delta: 0, invested: 0, yields: 0, count: 0 };

class AssetValuationServiceImpl extends BaseService {
  /** Operação declarada na tag `op:` ou inferida pelo tipo da movimentação. */
  static operationOf(m: Movement): InvestmentOperation {
    const tag = (m.tags ?? []).find((t) => t.startsWith(INVESTMENT_OP_TAG_PREFIX));
    const raw = tag ? tag.slice(INVESTMENT_OP_TAG_PREFIX.length).toUpperCase() : null;
    if (raw && (Object.values(InvestmentOperation) as string[]).includes(raw)) {
      return raw as InvestmentOperation;
    }
    switch (m.type) {
      case MovementType.INVESTMENT:
        return InvestmentOperation.APORTE;
      case MovementType.DIVIDEND:
      case MovementType.INTEREST:
        return InvestmentOperation.RENDIMENTO;
      case MovementType.ADJUSTMENT:
        return InvestmentOperation.AJUSTE;
      default:
        // Saída de caixa → aplicação; entrada de caixa → resgate.
        return MOVEMENT_TYPE_SIGN[m.type] < 0
          ? InvestmentOperation.APORTE
          : InvestmentOperation.RESGATE;
    }
  }

  /**
   * Variação que a movimentação provoca no valor do ativo.
   *
   * APORTE      → conta −X / ativo +X (patrimônio líquido inalterado).
   * RESGATE     → ativo −X / conta +X (patrimônio líquido inalterado).
   * RENDIMENTO  → ativo +X apenas quando NÃO houve crédito em conta;
   *               se caiu numa conta, o caixa já registrou o ganho.
   * AJUSTE      → segue o sinal do tipo da movimentação.
   */
  static deltaForAsset(m: Movement): number {
    if (!m.asset_id || m.deleted_at) return 0;
    const amount = Math.abs(Number(m.amount) || 0);
    switch (AssetValuationServiceImpl.operationOf(m)) {
      case InvestmentOperation.APORTE:
        return amount;
      case InvestmentOperation.RESGATE:
        return -amount;
      case InvestmentOperation.RENDIMENTO:
        return m.account_id ? 0 : amount;
      case InvestmentOperation.AJUSTE:
        return (MOVEMENT_TYPE_SIGN[m.type] >= 0 ? 1 : -1) * amount;
      default:
        return 0;
    }
  }

  /** Agrega o impacto das movimentações por ativo. */
  static impactByAsset(movements: Movement[]): Map<UUID, AssetMovementImpact> {
    const map = new Map<UUID, AssetMovementImpact>();
    for (const m of movements) {
      if (!m.asset_id || m.deleted_at) continue;
      const current = map.get(m.asset_id) ?? { ...EMPTY_IMPACT };
      const op = AssetValuationServiceImpl.operationOf(m);
      const delta = AssetValuationServiceImpl.deltaForAsset(m);
      current.delta += delta;
      current.count += 1;
      if (op === InvestmentOperation.APORTE || op === InvestmentOperation.RESGATE) {
        current.invested += delta;
      } else if (op === InvestmentOperation.RENDIMENTO) {
        current.yields += delta;
      }
      map.set(m.asset_id, current);
    }
    return map;
  }

  /** Sprint 4.7 — a operação aconteceu antes do início do controle financeiro. */
  static isHistorical(m: Movement): boolean {
    return !!m.is_historical;
  }

  /**
   * Sprint 4.7 — posição reconstruída do ativo a partir das movimentações
   * (históricas e atuais tratadas da mesma forma para posição/custo).
   * Quantidade e preço médio só existem quando as operações informam quantidade.
   */
  static positionOf(assetId: UUID, movements: Movement[]): AssetPosition {
    let quantity = 0;
    let cost = 0;
    let historicalCost = 0;
    let currentCost = 0;
    let yieldsTotal = 0;
    const ordered = movements
      .filter((m) => m.asset_id === assetId && !m.deleted_at)
      .sort((a, b) => (a.transaction_date < b.transaction_date ? -1 : 1));

    for (const m of ordered) {
      const op = AssetValuationServiceImpl.operationOf(m);
      const amount = Math.abs(Number(m.amount) || 0);
      const qty = m.quantity === null || m.quantity === undefined ? 0 : Math.abs(Number(m.quantity));
      if (op === InvestmentOperation.APORTE) {
        quantity += qty;
        cost += amount;
        if (m.is_historical) historicalCost += amount;
        else currentCost += amount;
      } else if (op === InvestmentOperation.RESGATE) {
        const avg = quantity > 0 ? cost / quantity : 0;
        const soldQty = Math.min(qty, quantity);
        quantity -= soldQty;
        cost -= soldQty > 0 ? avg * soldQty : Math.min(amount, cost);
        if (cost < 0) cost = 0;
        if (m.is_historical) historicalCost -= Math.min(amount, historicalCost);
        else currentCost -= Math.min(amount, currentCost);
      } else if (op === InvestmentOperation.RENDIMENTO) {
        yieldsTotal += AssetValuationServiceImpl.deltaForAsset(m);
      }
    }

    return {
      quantity: Number(quantity.toFixed(8)),
      cost: Number(cost.toFixed(2)),
      averagePrice: quantity > 0 ? Number((cost / quantity).toFixed(6)) : 0,
      historicalCost: Number(historicalCost.toFixed(2)),
      currentCost: Number(currentCost.toFixed(2)),
      yields: Number(yieldsTotal.toFixed(2)),
      operations: ordered.length,
      historicalOperations: ordered.filter((m) => m.is_historical).length,
    };
  }

  /** Um ativo espelhado numa conta nunca soma no total (o caixa já o conta). */
  static countsInTotal(asset: Asset): boolean {
    return asset.valuation_source !== AssetValuationSource.ACCOUNT;
  }

  /** Resolve o valor efetivo de um único ativo. */
  static valueOf(
    asset: Asset,
    impact: AssetMovementImpact,
    accountBalances: Record<UUID, number> = {},
  ): { value: number; acquisition: number } {
    switch (asset.valuation_source) {
      case AssetValuationSource.ACCOUNT: {
        const balance = asset.account_id ? (accountBalances[asset.account_id] ?? 0) : 0;
        return { value: balance, acquisition: balance };
      }
      case AssetValuationSource.MOVEMENTS: {
        const base = Number(asset.opening_value) || 0;
        return {
          value: base + impact.delta,
          acquisition: base + impact.invested,
        };
      }
      default:
        return {
          value: Number(asset.current_value) || 0,
          acquisition: Number(asset.acquisition_value) || 0,
        };
    }
  }

  /**
   * Projeta a lista de ativos com valores efetivos.
   * O `current_value`/`acquisition_value` do objeto retornado já vem resolvido,
   * de modo que todos os consumidores existentes (Patrimônio, Investimentos,
   * cards) continuam funcionando sem mudar de contrato.
   */
  static effectiveAssets(
    assets: Asset[],
    movements: Movement[] = [],
    accountBalances: Record<UUID, number> = {},
  ): EffectiveAsset[] {
    const impacts = AssetValuationServiceImpl.impactByAsset(movements);
    return assets.map((asset) => {
      const impact = impacts.get(asset.id) ?? { ...EMPTY_IMPACT };
      const { value, acquisition } = AssetValuationServiceImpl.valueOf(
        asset,
        impact,
        accountBalances,
      );
      return {
        ...asset,
        current_value: value,
        acquisition_value: acquisition,
        effective_value: value,
        effective_acquisition: acquisition,
        impact,
        counts_in_total: AssetValuationServiceImpl.countsInTotal(asset),
      };
    });
  }

  /** Subconjunto que pode ser somado no patrimônio sem dupla contagem. */
  static countable(assets: EffectiveAsset[]): EffectiveAsset[] {
    return assets.filter((a) => a.counts_in_total);
  }
}

export const AssetValuationService = new AssetValuationServiceImpl();
export { AssetValuationServiceImpl };
