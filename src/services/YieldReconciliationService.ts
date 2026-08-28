// YieldReconciliationService — Sprint 4.13A
// Conciliação inteligente de rendimentos para ativos cuja fonte de valor é a
// própria conta (valuation_source = ACCOUNT): caixinhas, poupança e renda fixa
// vinculada a um saldo real conhecido pela instituição.
//
// Conceito:
//   SALDO ESPERADO = saldo inicial da conta
//                    + aportes/transferências recebidas
//                    − resgates/transferências enviadas
//                    + rendimentos já registrados
//   (tudo isso é exatamente o que MovementServiceImpl.impactOnAccount já
//    calcula — não criamos uma segunda fonte de verdade)
//
//   SALDO REAL = valor informado pelo usuário (extrato da instituição).
//
//   DIFERENÇA = real − esperado → "possível rendimento" quando positiva.
//
// Dupla contagem: para ativos ACCOUNT o patrimônio é sempre derivado do saldo
// da conta. Ao confirmar, criamos UMA movimentação de rendimento creditada na
// própria conta (account_id preenchido). AssetValuationService.deltaForAsset
// devolve 0 para RENDIMENTO com conta (o caixa já registrou o ganho), logo o
// valor entra uma única vez. Nada é escrito direto no banco: a criação usa o
// MovementService existente.

import { MovementServiceImpl } from "./MovementService";
import {
  AssetValuationSource,
  InvestmentOperation,
  INVESTMENT_OP_TAG_PREFIX,
  MovementStatus,
  MovementType,
} from "@/constants/enums";
import type { Account, Asset, CreateMovementInput, Movement, UUID } from "@/models";

/** Tolerância de arredondamento: diferenças menores são ignoradas. */
export const YIELD_TOLERANCE = 0.01;

/** Tag que marca uma movimentação criada pela conciliação de rendimento. */
export const YIELD_RECONCILIATION_TAG = "recon:rendimento";

export type YieldDifferenceStatus = "YIELD" | "NONE" | "UNEXPLAINED";

export interface YieldBreakdown {
  /** Saldo inicial cadastrado na conta. */
  initialBalance: number;
  /** Entradas (aportes/transferências recebidas) até a data de referência. */
  contributions: number;
  /** Saídas (resgates/transferências enviadas) até a data de referência. */
  redemptions: number;
  /** Rendimentos já registrados na conta até a data de referência. */
  registeredYields: number;
  /** Movimentações pendentes que podem explicar parte da diferença. */
  pendingCount: number;
  pendingAmount: number;
}

export interface LastYieldReconciliation {
  date: string;
  amount: number;
  movementId: UUID;
}

export interface YieldReconciliationResult {
  eligible: boolean;
  referenceDate: string;
  expectedBalance: number;
  realBalance: number;
  difference: number;
  status: YieldDifferenceStatus;
  /** Valor sugerido para registro (0 quando não há rendimento). */
  suggested: number;
  breakdown: YieldBreakdown;
  last: LastYieldReconciliation | null;
  /** Existem lançamentos pendentes que podem explicar a diferença. */
  hasPendingWarning: boolean;
}

function round2(n: number): number {
  return Number((Math.round(n * 100) / 100).toFixed(2));
}

class YieldReconciliationServiceImpl {
  /** Só ativos espelhados numa conta entram nesta rotina. */
  static isEligible(asset: Pick<Asset, "valuation_source" | "account_id">): boolean {
    return (
      asset.valuation_source === AssetValuationSource.ACCOUNT && !!asset.account_id
    );
  }

  /** Movimentação é um rendimento creditado na conta do ativo. */
  static isYieldMovement(m: Movement): boolean {
    if (m.deleted_at) return false;
    const tag = (m.tags ?? []).find((t) => t.startsWith(INVESTMENT_OP_TAG_PREFIX));
    const raw = tag ? tag.slice(INVESTMENT_OP_TAG_PREFIX.length).toUpperCase() : null;
    if (raw) return raw === InvestmentOperation.RENDIMENTO;
    return m.type === MovementType.DIVIDEND || m.type === MovementType.INTEREST;
  }

  /** Movimentações da conta até a data de referência (inclusive). */
  static upTo(movements: Movement[], accountId: UUID, referenceDate: string): Movement[] {
    return movements.filter(
      (m) =>
        !m.deleted_at &&
        m.transaction_date <= referenceDate &&
        (m.account_id === accountId || m.transfer_account_id === accountId),
    );
  }

  /**
   * Saldo esperado: saldo inicial + impacto de TODAS as movimentações válidas
   * da conta até a data. Reutiliza a mesma regra do extrato/dashboard
   * (históricas = 0, transferências debitam origem e creditam destino,
   * compras de cartão não afetam caixa).
   */
  static expectedBalance(
    account: Account,
    movements: Movement[],
    referenceDate: string,
  ): number {
    let balance = Number(account.initial_balance) || 0;
    for (const m of YieldReconciliationServiceImpl.upTo(movements, account.id, referenceDate)) {
      balance += MovementServiceImpl.impactOnAccount(m, account.id);
    }
    return round2(balance);
  }

  static breakdown(
    account: Account,
    movements: Movement[],
    referenceDate: string,
  ): YieldBreakdown {
    const relevant = YieldReconciliationServiceImpl.upTo(
      movements,
      account.id,
      referenceDate,
    );
    let contributions = 0;
    let redemptions = 0;
    let registeredYields = 0;
    let pendingCount = 0;
    let pendingAmount = 0;

    for (const m of relevant) {
      const impact = MovementServiceImpl.impactOnAccount(m, account.id);
      if (impact === 0) continue;
      if (YieldReconciliationServiceImpl.isYieldMovement(m)) {
        registeredYields += impact;
      } else if (impact > 0) {
        contributions += impact;
      } else {
        redemptions += -impact;
      }
      if (m.status === MovementStatus.PENDING) {
        pendingCount += 1;
        pendingAmount += impact;
      }
    }

    return {
      initialBalance: round2(Number(account.initial_balance) || 0),
      contributions: round2(contributions),
      redemptions: round2(redemptions),
      registeredYields: round2(registeredYields),
      pendingCount,
      pendingAmount: round2(pendingAmount),
    };
  }

  /** Última conciliação de rendimento registrada para o ativo. */
  static lastReconciliation(
    movements: Movement[],
    assetId: UUID,
  ): LastYieldReconciliation | null {
    const found = movements
      .filter(
        (m) =>
          !m.deleted_at &&
          m.asset_id === assetId &&
          YieldReconciliationServiceImpl.isYieldMovement(m),
      )
      .sort((a, b) => (a.transaction_date < b.transaction_date ? 1 : -1))[0];
    if (!found) return null;
    return {
      date: found.transaction_date,
      amount: round2(Math.abs(Number(found.amount) || 0)),
      movementId: found.id,
    };
  }

  /**
   * Análise completa. `realBalance` é o saldo informado pelo usuário
   * (extrato da instituição). Como cada rendimento confirmado é creditado na
   * conta, o saldo esperado sobe e a mesma diferença não é sugerida de novo.
   */
  static analyze(params: {
    asset: Asset;
    account: Account | null | undefined;
    movements: Movement[];
    referenceDate: string;
    realBalance: number;
  }): YieldReconciliationResult {
    const { asset, account, movements, referenceDate, realBalance } = params;
    const eligible = YieldReconciliationServiceImpl.isEligible(asset) && !!account;

    if (!eligible || !account) {
      return {
        eligible: false,
        referenceDate,
        expectedBalance: 0,
        realBalance: round2(realBalance),
        difference: 0,
        status: "NONE",
        suggested: 0,
        breakdown: {
          initialBalance: 0,
          contributions: 0,
          redemptions: 0,
          registeredYields: 0,
          pendingCount: 0,
          pendingAmount: 0,
        },
        last: null,
        hasPendingWarning: false,
      };
    }

    const expected = YieldReconciliationServiceImpl.expectedBalance(
      account,
      movements,
      referenceDate,
    );
    const real = round2(realBalance);
    const difference = round2(real - expected);
    const breakdown = YieldReconciliationServiceImpl.breakdown(
      account,
      movements,
      referenceDate,
    );

    let status: YieldDifferenceStatus = "NONE";
    if (difference >= YIELD_TOLERANCE) status = "YIELD";
    else if (difference <= -YIELD_TOLERANCE) status = "UNEXPLAINED";

    return {
      eligible: true,
      referenceDate,
      expectedBalance: expected,
      realBalance: real,
      difference,
      status,
      suggested: status === "YIELD" ? difference : 0,
      breakdown,
      last: YieldReconciliationServiceImpl.lastReconciliation(movements, asset.id),
      hasPendingWarning: status !== "NONE" && breakdown.pendingCount > 0,
    };
  }

  /** Sobra não explicada após uma conciliação parcial. */
  static remaining(difference: number, registered: number): number {
    const rest = round2(difference - registered);
    return Math.abs(rest) < YIELD_TOLERANCE ? 0 : rest;
  }

  /**
   * Monta o input da movimentação de rendimento. NÃO persiste nada:
   * a criação continua sendo feita pelo MovementService.
   */
  static buildYieldInput(params: {
    asset: Asset;
    amount: number;
    date: string;
    competenceDate?: string | null;
    categoryId?: UUID | null;
    subcategoryId?: UUID | null;
    notes?: string | null;
    description?: string;
  }): CreateMovementInput {
    const { asset, amount, date } = params;
    return {
      workspace_id: asset.workspace_id,
      account_id: asset.account_id,
      asset_id: asset.id,
      type: MovementType.INTEREST,
      status: MovementStatus.CLEARED,
      description: params.description?.trim() || `Rendimento — ${asset.name}`,
      amount: round2(Math.abs(amount)),
      transaction_date: date,
      competence_date: params.competenceDate ?? date,
      category_id: params.categoryId ?? null,
      subcategory_id: params.subcategoryId ?? null,
      notes: params.notes ?? null,
      is_historical: false,
      tags: [
        `${INVESTMENT_OP_TAG_PREFIX}${InvestmentOperation.RENDIMENTO}`,
        YIELD_RECONCILIATION_TAG,
      ],
    };
  }
}

export const YieldReconciliationService = new YieldReconciliationServiceImpl();
export { YieldReconciliationServiceImpl };
