import { describe, expect, it } from "vitest";
import { AssetValuationServiceImpl } from "@/services/AssetValuationService";
import { MovementServiceImpl } from "@/services/MovementService";
import { CommitmentServiceImpl } from "@/services/CommitmentService";
import { resolveReviewTarget } from "@/services/ImportNavigationService";
import { ImportReviewServiceImpl } from "@/services/ImportReviewService";
import {
  AssetType,
  AssetValuationSource,
  MovementStatus,
  MovementType,
} from "@/constants/enums";
import type { Asset, Movement } from "@/models";
import type { CommitResult } from "@/services/ImportService";

const ASSET_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const IMPORT_A = "11111111-1111-1111-1111-111111111111";

function asset(over: Partial<Asset> = {}): Asset {
  return {
    id: ASSET_ID,
    workspace_id: "ws",
    name: "WEGE3",
    asset_type: AssetType.ACAO,
    institution: "B3",
    ticker: "WEGE3",
    currency: "BRL",
    quantity: 0,
    unit_price: 0,
    current_value: 0,
    acquisition_value: 0,
    acquisition_date: null,
    is_active: true,
    notes: null,
    valuation_source: AssetValuationSource.MOVEMENTS,
    account_id: null,
    opening_value: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    ...over,
  } as Asset;
}

function mov(over: Partial<Movement>): Movement {
  return {
    id: crypto.randomUUID(),
    workspace_id: "ws",
    account_id: null,
    card_id: null,
    invoice_id: null,
    asset_id: null,
    category_id: null,
    subcategory_id: null,
    type: MovementType.EXPENSE,
    status: MovementStatus.CLEARED,
    description: "Op",
    amount: -100,
    transaction_date: "2026-01-10",
    competence_date: "2026-01-10",
    due_date: null,
    payment_date: null,
    notes: null,
    tags: null,
    import_id: null,
    duplicate_hash: null,
    confidence_match: null,
    transfer_group_id: null,
    is_historical: false,
    quantity: null,
    unit_price: null,
    external_ref: null,
    created_at: "2026-01-10T00:00:00Z",
    updated_at: "2026-01-10T00:00:00Z",
    deleted_at: null,
    ...over,
  } as Movement;
}

describe("Sprint 4.8 — Bloco 1: posição efetiva de ativos por movimentações", () => {
  const ops = [
    mov({
      asset_id: ASSET_ID,
      type: MovementType.INVESTMENT,
      amount: -1000,
      quantity: 100,
      is_historical: true,
      transaction_date: "2025-03-01",
    }),
    mov({
      asset_id: ASSET_ID,
      type: MovementType.INVESTMENT,
      amount: -600,
      quantity: 50,
      transaction_date: "2026-01-10",
    }),
  ];

  it("A: quantidade e preço médio vêm da posição calculada", () => {
    const [eff] = AssetValuationServiceImpl.effectiveAssets([asset()], ops);
    expect(eff.effective_quantity).toBe(150);
    expect(eff.quantity).toBe(150);
    expect(eff.effective_unit_price).toBeCloseTo(1600 / 150, 4);
    expect(eff.unit_price).toBeCloseTo(1600 / 150, 4);
    expect(eff.position.cost).toBe(1600);
  });

  it("B: ativos MANUAL preservam quantidade e PU informados", () => {
    const manual = asset({
      valuation_source: AssetValuationSource.MANUAL,
      quantity: 7,
      unit_price: 12,
      current_value: 84,
    });
    const [eff] = AssetValuationServiceImpl.effectiveAssets([manual], ops);
    expect(eff.quantity).toBe(7);
    expect(eff.unit_price).toBe(12);
  });

  it("C: sem quantidade nas operações, mantém o valor informado", () => {
    const semQty = [mov({ asset_id: ASSET_ID, type: MovementType.INVESTMENT, amount: -500 })];
    const [eff] = AssetValuationServiceImpl.effectiveAssets([asset({ quantity: 3 })], semQty);
    expect(eff.quantity).toBe(3);
  });
});

describe("Sprint 4.8 — Bloco 2: totais ignoram operações históricas", () => {
  const list = [
    mov({ type: MovementType.INCOME, amount: 5000 }),
    mov({ type: MovementType.EXPENSE, amount: -1200 }),
    mov({ type: MovementType.TRANSFER, amount: -300 }),
    mov({ type: MovementType.INVESTMENT, amount: -900, is_historical: true, asset_id: ASSET_ID }),
    mov({ type: MovementType.INCOME, amount: 400, is_historical: true }),
  ];

  it("D: receitas, despesas, transferências e saldo excluem históricos", () => {
    const t = MovementServiceImpl.totals(list);
    expect(t.income).toBe(5000);
    expect(t.expense).toBe(1200);
    expect(t.transfers).toBe(300);
    expect(t.net).toBe(3800);
  });

  it("E: históricos são contabilizados à parte, mas contam no count", () => {
    const t = MovementServiceImpl.totals(list);
    expect(t.historicalCount).toBe(2);
    expect(t.historical).toBe(1300);
    expect(t.count).toBe(5);
  });
});

describe("Sprint 4.8 — Bloco 3: revisão pós-importação", () => {
  const commit = (inserted: number): CommitResult => ({
    importRecord: { id: IMPORT_A } as CommitResult["importRecord"],
    inserted,
    duplicated: 0,
    ignored: 0,
    autoReconciled: 0,
  });

  it("F: alvo de revisão resolvido a partir do commit", () => {
    expect(resolveReviewTarget(commit(3))).toEqual({
      importId: IMPORT_A,
      path: `/importacoes/revisao/${IMPORT_A}`,
    });
    expect(resolveReviewTarget(commit(0))).toBeNull();
    expect(resolveReviewTarget(null)).toBeNull();
  });

  it("G: revisão carrega apenas os lançamentos da importação", () => {
    const rows = ImportReviewServiceImpl.buildRows(
      [
        mov({ import_id: IMPORT_A }),
        mov({ import_id: "outro" }),
        mov({ import_id: null }),
      ],
      IMPORT_A,
      [],
    );
    expect(rows).toHaveLength(1);
  });
});

describe("Sprint 4.8 — Bloco 4: fundação de parcelamentos", () => {
  it("H: parcelas somam exatamente o total, resíduo na última", () => {
    const parcels = CommitmentServiceImpl.schedule({
      total_amount: 100,
      installments_count: 3,
      start_date: "2026-01-15",
    });
    expect(parcels).toHaveLength(3);
    expect(parcels.map((p) => p.amount)).toEqual([33.33, 33.33, 33.34]);
    const sum = parcels.reduce((s, p) => s + p.amount, 0);
    expect(Number(sum.toFixed(2))).toBe(100);
  });

  it("I: vencimentos avançam por mês e respeitam meses curtos", () => {
    const parcels = CommitmentServiceImpl.schedule({
      total_amount: 300,
      installments_count: 3,
      start_date: "2026-01-31",
    });
    expect(parcels.map((p) => p.due_date)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });

  it("J: dia de vencimento sobrepõe o dia da data inicial", () => {
    const parcels = CommitmentServiceImpl.schedule({
      total_amount: 200,
      installments_count: 2,
      start_date: "2026-01-03",
      due_day: 10,
    });
    expect(parcels.map((p) => p.due_date)).toEqual(["2026-01-10", "2026-02-10"]);
    expect(parcels[0].competence_date).toBe("2026-01-10");
  });

  it("K: entradas inválidas são rejeitadas", () => {
    expect(() =>
      CommitmentServiceImpl.schedule({
        total_amount: 100,
        installments_count: 0,
        start_date: "2026-01-01",
      }),
    ).toThrow();
    expect(() => CommitmentServiceImpl.validate({ due_day: 45 })).toThrow();
    expect(() => CommitmentServiceImpl.validate({ name: "  " })).toThrow();
  });

  it("L: progresso considera apenas parcelas ativas", () => {
    const base = {
      id: "x",
      workspace_id: "ws",
      commitment_id: "c",
      due_date: "2026-01-10",
      competence_date: "2026-01-10",
      movement_id: null,
      notes: null,
      created_at: "",
      updated_at: "",
      deleted_at: null,
    };
    const p = CommitmentServiceImpl.progress([
      { ...base, installment_number: 1, amount: 100, status: "PAID" },
      { ...base, installment_number: 2, amount: 100, status: "FORECAST" },
      { ...base, installment_number: 3, amount: 100, status: "CANCELLED" },
    ]);
    expect(p.total).toBe(200);
    expect(p.paid).toBe(100);
    expect(p.remaining).toBe(100);
    expect(p.openCount).toBe(1);
  });
});
