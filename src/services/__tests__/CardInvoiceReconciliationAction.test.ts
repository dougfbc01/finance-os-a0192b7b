// Sprint 4.15A — Regras puras das ações de conciliação de fatura.
import { describe, expect, it } from "vitest";
import { CardInvoiceReconciliationActionServiceImpl as Svc } from "@/services/CardInvoiceReconciliationActionService";
import type {
  InvoiceReconciliationItem,
  InvoiceReconciliationResult,
  InvoiceReconciliationStatus,
} from "@/models/CardInvoiceReconciliation";
import type { InvoiceReconciliationActionRecord } from "@/models/CardInvoiceReconciliationAction";

function item(
  key: string,
  status: InvoiceReconciliationStatus,
  candidates = 0,
): InvoiceReconciliationItem {
  return {
    key,
    status,
    official: null,
    movement: null,
    official_amount: null,
    system_amount: null,
    amount_difference: null,
    official_date: null,
    system_date: null,
    date_diff_days: null,
    installment: null,
    installments_total: null,
    confidence: 0,
    matching_reasons: [],
    matching_signals: [],
    candidates: Array.from({ length: candidates }, (_, i) => ({
      movement_id: `m${i}`,
      description: "x",
      amount: 10,
      transaction_date: "2026-01-01",
      confidence: 80,
      reasons: [],
    })),
    diagnosis: "",
  };
}

function action(
  over: Partial<InvoiceReconciliationActionRecord>,
): InvoiceReconciliationActionRecord {
  return {
    id: "a1",
    workspace_id: "w1",
    invoice_id: "i1",
    item_key: "official:0",
    movement_id: "mv1",
    related_movement_id: null,
    action: "IGNORE_DIVERGENCE",
    before_state: {},
    after_state: {},
    reason: null,
    source: "MANUAL",
    idempotency_key: "k",
    performed_by: null,
    undone_at: null,
    undone_by: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

function result(items: InvoiceReconciliationItem[]): InvoiceReconciliationResult {
  return {
    invoice_id: "i1",
    card_id: "c1",
    executed_at: "2026-01-01T00:00:00Z",
    official_invoice_total: 100,
    matched_total: 100,
    difference: 0,
    matched_count: 0,
    missing_in_system_count: items.filter((i) => i.status === "MISSING_IN_SYSTEM").length,
    missing_in_invoice_count: items.filter((i) => i.status === "MISSING_IN_INVOICE").length,
    amount_mismatch_count: items.filter((i) => i.status === "AMOUNT_MISMATCH").length,
    date_mismatch_count: items.filter((i) => i.status === "DATE_MISMATCH").length,
    possible_duplicate_count: 0,
    refund_count: 0,
    fee_count: 0,
    ambiguous_count: 0,
    is_reconciled: false,
    items,
  };
}

describe("CardInvoiceReconciliationActionService — ações disponíveis", () => {
  it("oferece corrigir valor em divergência de valor", () => {
    expect(Svc.availableActions(item("k", "AMOUNT_MISMATCH"))).toContain("CORRECT_AMOUNT");
  });

  it("oferece corrigir data em divergência de data", () => {
    expect(Svc.availableActions(item("k", "DATE_MISMATCH"))).toContain("CORRECT_DATE");
  });

  it("não oferece ação para item conciliado", () => {
    expect(Svc.availableActions(item("k", "MATCHED"))).toEqual([]);
  });

  it("só oferece vínculo quando existe candidato", () => {
    expect(Svc.availableActions(item("k", "MISSING_IN_SYSTEM"))).not.toContain(
      "LINK_EXISTING_MOVEMENT",
    );
    expect(Svc.availableActions(item("k", "MISSING_IN_SYSTEM", 2))).toContain(
      "LINK_EXISTING_MOVEMENT",
    );
  });

  it("oferece escolher correspondência em ambiguidade com candidatos", () => {
    expect(Svc.availableActions(item("k", "AMBIGUOUS_MATCH", 3))).toContain(
      "SELECT_MATCH_CANDIDATE",
    );
  });

  it("sempre permite ignorar divergência pendente", () => {
    expect(Svc.availableActions(item("k", "MISSING_IN_INVOICE"))).toContain(
      "IGNORE_DIVERGENCE",
    );
  });
});

describe("Idempotência e concorrência", () => {
  const base = {
    workspaceId: "w1",
    invoiceId: "i1",
    itemKey: "official:0",
    action: "CORRECT_AMOUNT" as const,
    movementId: "mv1",
    newAmount: 10.5,
  };

  it("gera a mesma chave para a mesma ação", () => {
    expect(Svc.idempotencyKey(base)).toBe(Svc.idempotencyKey({ ...base }));
  });

  it("gera chave diferente quando o valor muda", () => {
    expect(Svc.idempotencyKey(base)).not.toBe(
      Svc.idempotencyKey({ ...base, newAmount: 11 }),
    );
  });

  it("gera chave diferente por item", () => {
    expect(Svc.idempotencyKey(base)).not.toBe(
      Svc.idempotencyKey({ ...base, itemKey: "official:1" }),
    );
  });

  it("assinatura muda quando o lançamento é atualizado", () => {
    const a = Svc.signature({ id: "mv1", updated_at: "2026-01-01T00:00:00Z" } as never);
    const b = Svc.signature({ id: "mv1", updated_at: "2026-01-02T00:00:00Z" } as never);
    expect(a).not.toBe(b);
  });

  it("assinatura de lançamento ausente é nula", () => {
    expect(Svc.signature(null)).toBeNull();
  });
});

describe("Desfazer", () => {
  const mv = { id: "mv1", updated_at: "2026-01-02T00:00:00Z" } as never;

  it("permite desfazer correção quando nada mudou depois", () => {
    const a = action({
      action: "CORRECT_AMOUNT",
      after_state: { signature: "mv1:2026-01-02T00:00:00Z" },
    });
    expect(Svc.canUndo(a, mv)).toBe(true);
  });

  it("bloqueia desfazer quando o lançamento mudou depois", () => {
    const a = action({
      action: "CORRECT_AMOUNT",
      after_state: { signature: "mv1:2026-01-01T00:00:00Z" },
    });
    expect(Svc.canUndo(a, mv)).toBe(false);
  });

  it("não desfaz duas vezes", () => {
    const a = action({
      action: "CORRECT_AMOUNT",
      after_state: { signature: "mv1:2026-01-02T00:00:00Z" },
      undone_at: "2026-01-03T00:00:00Z",
    });
    expect(Svc.canUndo(a, mv)).toBe(false);
  });

  it("classifica decisões humanas", () => {
    expect(Svc.isDecision("IGNORE_DIVERGENCE")).toBe(true);
    expect(Svc.isDecision("MARK_NOT_SAME_MOVEMENT")).toBe(true);
    expect(Svc.isDecision("CORRECT_AMOUNT")).toBe(false);
  });
});

describe("Persistência das decisões no diagnóstico", () => {
  it("ignora item decidido nas contagens de pendência", () => {
    const r = result([item("official:0", "AMOUNT_MISMATCH")]);
    const out = Svc.applyDecisions(r, [action({ item_key: "official:0" })]);
    expect(out.amount_mismatch_count).toBe(0);
    expect(out.items[0].decided).toBe(true);
    expect(out.is_reconciled).toBe(true);
  });

  it("mantém pendência de itens não decididos", () => {
    const r = result([
      item("official:0", "AMOUNT_MISMATCH"),
      item("official:1", "DATE_MISMATCH"),
    ]);
    const out = Svc.applyDecisions(r, [action({ item_key: "official:0" })]);
    expect(out.amount_mismatch_count).toBe(0);
    expect(out.date_mismatch_count).toBe(1);
    expect(out.is_reconciled).toBe(false);
  });

  it("decisão desfeita volta a contar como pendência", () => {
    const r = result([item("official:0", "AMOUNT_MISMATCH")]);
    const out = Svc.applyDecisions(r, [
      action({ item_key: "official:0", undone_at: "2026-01-05T00:00:00Z" }),
    ]);
    expect(out.amount_mismatch_count).toBe(1);
    expect(out.is_reconciled).toBe(false);
  });

  it("marcar como não sendo a mesma movimentação também resolve o item", () => {
    const r = result([item("movement:1", "MISSING_IN_INVOICE")]);
    const out = Svc.applyDecisions(r, [
      action({ item_key: "movement:1", action: "MARK_NOT_SAME_MOVEMENT" }),
    ]);
    expect(out.missing_in_invoice_count).toBe(0);
  });

  it("não altera o resultado quando não há decisões", () => {
    const r = result([item("official:0", "AMOUNT_MISMATCH")]);
    expect(Svc.applyDecisions(r, [])).toBe(r);
  });

  it("diferença de valor total impede conciliação mesmo sem pendências", () => {
    const r = { ...result([item("official:0", "AMOUNT_MISMATCH")]), difference: 12 };
    const out = Svc.applyDecisions(r, [action({ item_key: "official:0" })]);
    expect(out.is_reconciled).toBe(false);
  });
});
