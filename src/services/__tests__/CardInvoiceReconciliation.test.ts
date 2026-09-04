import { describe, expect, it } from "vitest";
import {
  CardInvoiceReconciliationServiceImpl as Svc,
  parseInstallment,
} from "@/services/CardInvoiceReconciliationService";
import type { Movement } from "@/models";
import type { OfficialInvoiceLine } from "@/models/CardInvoiceReconciliation";

const INVOICE_ID = "inv-1";

function line(p: Partial<OfficialInvoiceLine> & { index: number }): OfficialInvoiceLine {
  return {
    date: "2026-07-10",
    description: "MERCADO LIVRE",
    amount: 100,
    external_ref: null,
    installment: null,
    installments_total: null,
    ...p,
  };
}

function mov(p: Partial<Movement> & { id: string }): Movement {
  return {
    workspace_id: "ws",
    account_id: null,
    transfer_account_id: null,
    category_id: null,
    subcategory_id: null,
    card_id: "card-1",
    invoice_id: INVOICE_ID,
    asset_id: null,
    import_id: null,
    transfer_group_id: null,
    type: "EXPENSE",
    status: "PENDING",
    description: "MERCADO LIVRE",
    notes: null,
    amount: 100,
    transaction_date: "2026-07-10",
    competence_date: null,
    due_date: null,
    tags: [],
    attachments: [],
    duplicate_hash: null,
    is_historical: false,
    quantity: null,
    unit_price: null,
    external_ref: null,
    created_at: "2026-07-10T00:00:00Z",
    updated_at: "2026-07-10T00:00:00Z",
    deleted_at: null,
    ...p,
  } as Movement;
}

const run = (officialLines: OfficialInvoiceLine[], movements: Movement[]) =>
  Svc.reconcile({
    invoiceId: INVOICE_ID,
    cardId: "card-1",
    officialLines,
    movements,
    executedAt: "2026-08-01T00:00:00Z",
  });

describe("CardInvoiceReconciliationService", () => {
  it("fatura totalmente conciliada", () => {
    const r = run([line({ index: 0 })], [mov({ id: "m1" })]);
    expect(r.items[0].status).toBe("MATCHED");
    expect(r.is_reconciled).toBe(true);
    expect(r.difference).toBe(0);
  });

  it("lançamento presente na fatura e ausente no sistema", () => {
    const r = run([line({ index: 0 })], []);
    expect(r.items[0].status).toBe("MISSING_IN_SYSTEM");
    expect(r.missing_in_system_count).toBe(1);
    expect(r.is_reconciled).toBe(false);
  });

  it("movimento no sistema ausente na fatura", () => {
    const r = run([], [mov({ id: "m1" })]);
    expect(r.items[0].status).toBe("MISSING_IN_INVOICE");
    expect(r.missing_in_invoice_count).toBe(1);
  });

  it("divergência de valor", () => {
    const r = run([line({ index: 0, amount: 100 })], [mov({ id: "m1", amount: 97 })]);
    expect(r.items[0].status).toBe("AMOUNT_MISMATCH");
    expect(r.items[0].amount_difference).toBe(3);
  });

  it("tolerância de centavos não gera divergência", () => {
    const r = run([line({ index: 0, amount: 100.01 })], [mov({ id: "m1", amount: 100 })]);
    expect(r.items[0].status).toBe("MATCHED");
  });

  it("divergência de data dentro da janela máxima", () => {
    const r = run(
      [line({ index: 0, date: "2026-07-10" })],
      [mov({ id: "m1", transaction_date: "2026-07-15" })],
    );
    expect(r.items[0].status).toBe("DATE_MISMATCH");
    expect(r.items[0].date_diff_days).toBe(5);
  });

  it("possível duplicidade quando há dois movimentos idênticos", () => {
    const r = run([line({ index: 0 })], [mov({ id: "m1" }), mov({ id: "m2" })]);
    expect(r.items[0].status).toBe("POSSIBLE_DUPLICATE");
    expect(r.items[0].movement).toBeNull();
    expect(r.items[0].candidates.length).toBe(2);
  });

  it("parcelas iguais reforçam a correspondência", () => {
    const r = run(
      [line({ index: 0, description: "NOTEBOOK 3/10", installment: 3, installments_total: 10 })],
      [mov({ id: "m1", description: "NOTEBOOK 3/10" })],
    );
    expect(r.items[0].status).toBe("MATCHED");
    expect(r.items[0].installment).toBe(3);
  });

  it("estorno é classificado como REFUND_OR_REVERSAL", () => {
    const r = run(
      [line({ index: 0, description: "ESTORNO MERCADO LIVRE", amount: -100 })],
      [mov({ id: "m1", type: "REFUND", description: "ESTORNO MERCADO LIVRE" })],
    );
    expect(r.items[0].status).toBe("REFUND_OR_REVERSAL");
  });

  it("encargos são classificados como INTEREST_OR_FEE", () => {
    const r = run([line({ index: 0, description: "JUROS DE ROTATIVO", amount: 30 })], []);
    expect(r.items[0].status).toBe("INTEREST_OR_FEE");
    expect(r.fee_count).toBe(1);
  });

  it("pagamento de fatura não entra na conciliação", () => {
    const r = run([], [mov({ id: "m1", type: "CARD_PAYMENT", description: "Pagamento fatura" })]);
    expect(r.items).toHaveLength(0);
  });

  it("fatura e movimentos vazios não quebram", () => {
    const r = run([], []);
    expect(r.items).toHaveLength(0);
    expect(r.is_reconciled).toBe(true);
  });

  it("é idempotente e não muta as entradas", () => {
    const lines = [line({ index: 0 }), line({ index: 1, description: "UBER", amount: 25 })];
    const movs = [mov({ id: "m1" }), mov({ id: "m2", description: "UBER", amount: 25 })];
    const snapshot = JSON.stringify({ lines, movs });
    const a = run(lines, movs);
    const b = run(lines, movs);
    expect(JSON.stringify({ lines, movs })).toBe(snapshot);
    expect(JSON.stringify(a.items)).toBe(JSON.stringify(b.items));
  });

  it("parseInstallment extrai parcelas", () => {
    expect(parseInstallment("COMPRA 3/10")).toEqual({ installment: 3, total: 10 });
    expect(parseInstallment("SEM PARCELA")).toEqual({ installment: null, total: null });
  });

  it("parseOfficialLines interpreta CSV do emissor", () => {
    const lines = Svc.parseOfficialLines(
      "date,title,amount\n2026-07-10,MERCADO LIVRE,100.00\n2026-07-11,UBER 2/3,25.50\n",
    );
    expect(lines).toHaveLength(2);
    expect(lines[1].installment).toBe(2);
    expect(lines[0].amount).toBe(100);
  });
});
