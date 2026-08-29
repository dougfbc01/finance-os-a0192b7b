import { describe, expect, it } from "vitest";
import {
  YieldReconciliationServiceImpl,
  YIELD_RECONCILIATION_TAG,
} from "../YieldReconciliationService";
import {
  AssetType,
  AssetValuationSource,
  INVESTMENT_OP_TAG_PREFIX,
  InvestmentOperation,
  MovementStatus,
  MovementType,
  AccountType,
} from "@/constants/enums";
import type { Account, Asset, Movement } from "@/models";

const WS = "ws-1";
const ACC = "acc-1";
const ASSET = "asset-1";

const account: Account = {
  id: ACC,
  workspace_id: WS,
  name: "Caixinha",
  institution: "Nubank",
  account_type: AccountType.SAVINGS,
  currency: "BRL",
  initial_balance: 1000,
  color: "#000",
  icon: "wallet",
  display_order: 0,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
};

const asset: Asset = {
  id: ASSET,
  workspace_id: WS,
  name: "Caixinha Reserva",
  asset_type: AssetType.CAIXINHA,
  institution: "Nubank",
  ticker: null,
  currency: "BRL",
  quantity: 0,
  unit_price: 0,
  current_value: 0,
  acquisition_value: 0,
  acquisition_date: null,
  is_active: true,
  notes: null,
  valuation_source: AssetValuationSource.ACCOUNT,
  account_id: ACC,
  opening_value: 0,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
};

function mov(p: Partial<Movement>): Movement {
  return {
    id: Math.random().toString(36).slice(2),
    workspace_id: WS,
    account_id: ACC,
    transfer_account_id: null,
    category_id: null,
    subcategory_id: null,
    card_id: null,
    invoice_id: null,
    asset_id: null,
    import_id: null,
    transfer_group_id: null,
    type: MovementType.INCOME,
    status: MovementStatus.CLEARED,
    description: "mov",
    notes: null,
    amount: 0,
    transaction_date: "2026-02-01",
    competence_date: null,
    due_date: null,
    tags: [],
    attachments: [],
    duplicate_hash: null,
    is_historical: false,
    quantity: null,
    unit_price: null,
    external_ref: null,
    created_at: "2026-02-01T00:00:00Z",
    updated_at: "2026-02-01T00:00:00Z",
    deleted_at: null,
    ...p,
  } as Movement;
}

describe("YieldReconciliationService", () => {
  it("só considera elegíveis ativos vinculados a conta", () => {
    expect(YieldReconciliationServiceImpl.isEligible(asset)).toBe(true);
    expect(
      YieldReconciliationServiceImpl.isEligible({
        valuation_source: AssetValuationSource.MANUAL,
        account_id: ACC,
      }),
    ).toBe(false);
    expect(
      YieldReconciliationServiceImpl.isEligible({
        valuation_source: AssetValuationSource.ACCOUNT,
        account_id: null,
      }),
    ).toBe(false);
  });

  it("calcula saldo esperado com aportes e resgates", () => {
    const movements = [
      mov({ type: MovementType.INCOME, amount: 500, transaction_date: "2026-02-05" }),
      mov({ type: MovementType.EXPENSE, amount: 200, transaction_date: "2026-02-10" }),
    ];
    expect(
      YieldReconciliationServiceImpl.expectedBalance(account, movements, "2026-02-28"),
    ).toBe(1300);
  });

  it("respeita a data de referência", () => {
    const movements = [
      mov({ type: MovementType.INCOME, amount: 500, transaction_date: "2026-03-05" }),
    ];
    expect(
      YieldReconciliationServiceImpl.expectedBalance(account, movements, "2026-02-28"),
    ).toBe(1000);
  });

  it("sugere a diferença positiva como rendimento", () => {
    const r = YieldReconciliationServiceImpl.analyze({
      asset,
      account,
      movements: [],
      referenceDate: "2026-02-28",
      realBalance: 1012.34,
    });
    expect(r.status).toBe("YIELD");
    expect(r.difference).toBe(12.34);
    expect(r.suggested).toBe(12.34);
  });

  it("marca diferença negativa como não explicada", () => {
    const r = YieldReconciliationServiceImpl.analyze({
      asset,
      account,
      movements: [],
      referenceDate: "2026-02-28",
      realBalance: 950,
    });
    expect(r.status).toBe("UNEXPLAINED");
    expect(r.suggested).toBe(0);
  });

  it("ignora diferenças dentro da tolerância", () => {
    const r = YieldReconciliationServiceImpl.analyze({
      asset,
      account,
      movements: [],
      referenceDate: "2026-02-28",
      realBalance: 1000.004,
    });
    expect(r.status).toBe("NONE");
  });

  it("não sugere o mesmo rendimento duas vezes após o registro", () => {
    const first = YieldReconciliationServiceImpl.analyze({
      asset,
      account,
      movements: [],
      referenceDate: "2026-02-28",
      realBalance: 1010,
    });
    expect(first.suggested).toBe(10);

    const registered = mov({
      type: MovementType.INTEREST,
      amount: 10,
      asset_id: ASSET,
      transaction_date: "2026-02-28",
      tags: [`${INVESTMENT_OP_TAG_PREFIX}${InvestmentOperation.RENDIMENTO}`],
    });
    const second = YieldReconciliationServiceImpl.analyze({
      asset,
      account,
      movements: [registered],
      referenceDate: "2026-02-28",
      realBalance: 1010,
    });
    expect(second.expectedBalance).toBe(1010);
    expect(second.status).toBe("NONE");
    expect(second.breakdown.registeredYields).toBe(10);
    expect(second.last?.amount).toBe(10);
  });

  it("ignora operações históricas no saldo esperado", () => {
    const movements = [
      mov({
        type: MovementType.INVESTMENT,
        amount: 400,
        is_historical: true,
        transaction_date: "2026-02-02",
      }),
    ];
    expect(
      YieldReconciliationServiceImpl.expectedBalance(account, movements, "2026-02-28"),
    ).toBe(1000);
  });

  it("alerta quando há pendências que podem explicar a diferença", () => {
    const movements = [
      mov({
        type: MovementType.INCOME,
        amount: 100,
        status: MovementStatus.PENDING,
        transaction_date: "2026-02-10",
      }),
    ];
    const r = YieldReconciliationServiceImpl.analyze({
      asset,
      account,
      movements,
      referenceDate: "2026-02-28",
      realBalance: 1150,
    });
    expect(r.breakdown.pendingCount).toBe(1);
    expect(r.hasPendingWarning).toBe(true);
  });

  it("monta o input do rendimento vinculado ao ativo e à conta", () => {
    const input = YieldReconciliationServiceImpl.buildYieldInput({
      asset,
      amount: 12.345,
      date: "2026-02-28",
    });
    expect(input.type).toBe(MovementType.INTEREST);
    expect(input.account_id).toBe(ACC);
    expect(input.asset_id).toBe(ASSET);
    expect(input.amount).toBe(12.35);
    expect(input.is_historical).toBe(false);
    expect(input.tags).toContain(YIELD_RECONCILIATION_TAG);
    expect(input.tags).toContain(
      `${INVESTMENT_OP_TAG_PREFIX}${InvestmentOperation.RENDIMENTO}`,
    );
  });

  it("calcula o resto não explicado em conciliação parcial", () => {
    expect(YieldReconciliationServiceImpl.remaining(30, 20)).toBe(10);
    expect(YieldReconciliationServiceImpl.remaining(30, 30)).toBe(0);
  });
});
