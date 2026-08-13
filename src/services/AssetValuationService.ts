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
  /**
   * Se `false`, o valor NÃO deve ser somado ao total de ativos
   * (evita dupla contagem — caso das caixinhas modeladas como conta).
   */
  counts_in_total: boolean;
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
