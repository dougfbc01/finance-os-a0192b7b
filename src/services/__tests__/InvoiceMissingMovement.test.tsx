// Sprint 4.15B — Criação manual do lançamento faltante na fatura.
// Cobre apenas o novo comportamento: nenhuma criação automática, dados vindos
// da fatura, confirmação explícita, bloqueio de duplicidade e vínculo à fatura.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const movementApi = {
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  getById: vi.fn(),
};

vi.mock("@/services/MovementService", () => ({
  MovementService: movementApi,
  MovementServiceImpl: class {},
}));

import {
  AlreadyRegisteredError,
  CardInvoiceReconciliationActionServiceImpl as Svc,
} from "@/services/CardInvoiceReconciliationActionService";
import { CreateMissingMovementDialog } from "@/components/cards/CreateMissingMovementDialog";
import type {
  InvoiceReconciliationItem,
  InvoiceReconciliationStatus,
} from "@/models/CardInvoiceReconciliation";
import type { CreateMissingMovementPayload } from "@/models/CardInvoiceReconciliationAction";

function item(
  status: InvoiceReconciliationStatus = "MISSING_IN_SYSTEM",
): InvoiceReconciliationItem {
  return {
    key: "official:0",
    status,
    official: {
      index: 0,
      date: "2026-08-10",
      description: "Mercado XYZ",
      amount: 350,
      installment: 3,
      installments_total: 10,
    },
    movement: null,
    official_amount: 350,
    system_amount: null,
    amount_difference: null,
    official_date: "2026-08-10",
    system_date: null,
    date_diff_days: null,
    installment: 3,
    installments_total: 10,
    confidence: 0,
    matching_reasons: [],
    matching_signals: [],
    candidates: [],
    diagnosis: "",
  };
}

const payload: CreateMissingMovementPayload = {
  cardId: "card-1",
  description: "Mercado XYZ",
  amount: 350,
  transactionDate: "2026-08-10",
  competenceDate: "2026-08-01",
};

// ---------------------------------------------------------------------------
// Ações disponíveis
// ---------------------------------------------------------------------------

describe("ações disponíveis", () => {
  it("oferece criar lançamento apenas em MISSING_IN_SYSTEM", () => {
    expect(Svc.availableActions(item("MISSING_IN_SYSTEM"))).toContain(
      "CREATE_MISSING_MOVEMENT",
    );
  });

  it("não oferece criar lançamento nas demais situações", () => {
    const others: InvoiceReconciliationStatus[] = [
      "MATCHED",
      "MISSING_IN_INVOICE",
      "AMOUNT_MISMATCH",
      "DATE_MISMATCH",
      "POSSIBLE_DUPLICATE",
      "AMBIGUOUS_MATCH",
      "PARTIAL_MATCH",
      "UNCLASSIFIED",
    ];
    for (const s of others) {
      expect(Svc.availableActions(item(s))).not.toContain("CREATE_MISSING_MOVEMENT");
    }
  });
});

// ---------------------------------------------------------------------------
// Detecção de duplicidade (regra pura)
// ---------------------------------------------------------------------------

describe("detecção de lançamento já existente", () => {
  const base = {
    card_id: "card-1",
    amount: 350,
    transaction_date: "2026-08-10",
    deleted_at: null,
  };

  it("reconhece o mesmo lançamento dentro da tolerância", () => {
    expect(Svc.matchesPayload(base, payload)).toBe(true);
    expect(Svc.matchesPayload({ ...base, transaction_date: "2026-08-11" }, payload)).toBe(true);
  });

  it("ignora cartão diferente, valor diferente e data distante", () => {
    expect(Svc.matchesPayload({ ...base, card_id: "card-2" }, payload)).toBe(false);
    expect(Svc.matchesPayload({ ...base, amount: 351 }, payload)).toBe(false);
    expect(Svc.matchesPayload({ ...base, transaction_date: "2026-08-20" }, payload)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Execução da ação
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

function fakeClient(inserted: Row) {
  const state: { inserts: Row[]; updates: Row[] } = { inserts: [], updates: [] };
  const chain = () => {
    const result = { data: { ...inserted, ...(state.updates.at(-1) ?? {}) }, error: null };
    const obj: Record<string, unknown> = {};
    const self = () => obj;
    Object.assign(obj, {
      insert: (v: Row) => {
        state.inserts.push(v);
        return obj;
      },
      update: (v: Row) => {
        state.updates.push(v);
        return obj;
      },
      select: self,
      eq: self,
      order: self,
      single: async () => result,
      maybeSingle: async () => result,
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve(result).then(res, rej),
    });
    return obj;
  };
  const client = {
    from: () => chain(),
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
  };
  return { client, state };
}

function service(inserted: Row) {
  const { client, state } = fakeClient(inserted);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { svc: new (Svc as any)(client), state };
}

describe("criação do lançamento faltante", () => {
  beforeEach(() => {
    movementApi.list.mockReset();
    movementApi.create.mockReset();
    movementApi.update.mockReset();
  });

  const input = {
    workspaceId: "ws-1",
    invoiceId: "inv-1",
    itemKey: "official:0",
    action: "CREATE_MISSING_MOVEMENT" as const,
    createPayload: payload,
    reason: "Estava na fatura e não foi importado.",
  };

  it("cria exatamente um movimento, vinculado à fatura, e registra auditoria", async () => {
    movementApi.list.mockResolvedValue([]);
    movementApi.create.mockResolvedValue({
      id: "mv-1",
      invoice_id: null,
      amount: 350,
      transaction_date: "2026-08-10",
      updated_at: "t0",
    });
    movementApi.update.mockResolvedValue({
      id: "mv-1",
      invoice_id: "inv-1",
      amount: 350,
      transaction_date: "2026-08-10",
      updated_at: "t1",
    });

    const { svc, state } = service({ id: "act-1" });
    await svc.execute(input);

    expect(movementApi.create).toHaveBeenCalledTimes(1);
    expect(movementApi.create.mock.calls[0][0]).toMatchObject({
      workspace_id: "ws-1",
      card_id: "card-1",
      amount: 350,
      transaction_date: "2026-08-10",
    });
    // Vínculo com a fatura atual, sem relacionamento paralelo.
    expect(movementApi.update).toHaveBeenCalledWith("mv-1", { invoice_id: "inv-1" });

    const audit = state.inserts[0];
    expect(audit).toMatchObject({
      invoice_id: "inv-1",
      item_key: "official:0",
      action: "CREATE_MISSING_MOVEMENT",
      performed_by: "user-1",
      reason: "Estava na fatura e não foi importado.",
    });
    expect(state.updates.at(-1)).toMatchObject({
      after_state: expect.objectContaining({ movement_id: "mv-1", invoice_id: "inv-1" }),
    });
  });

  it("bloqueia a criação quando o lançamento já existe", async () => {
    movementApi.list.mockResolvedValue([
      { card_id: "card-1", amount: 350, transaction_date: "2026-08-10", deleted_at: null },
    ]);
    const { svc } = service({ id: "act-2" });
    await expect(svc.execute(input)).rejects.toBeInstanceOf(AlreadyRegisteredError);
    expect(movementApi.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Formulário
// ---------------------------------------------------------------------------

describe("formulário de criação", () => {
  function setup(onConfirm = vi.fn()) {
    render(
      <CreateMissingMovementDialog
        item={item()}
        cardId="card-1"
        cardName="Nubank"
        competence="2026-08-01"
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );
    return onConfirm;
  }

  it("vem preenchido com os dados da fatura", () => {
    setup();
    expect((screen.getByLabelText("Descrição") as HTMLInputElement).value).toBe("Mercado XYZ");
    expect((screen.getByLabelText("Valor") as HTMLInputElement).value).toBe("350");
    expect((screen.getByLabelText("Data") as HTMLInputElement).value).toBe("2026-08-10");
    expect(screen.getByText(/Nubank/)).toBeTruthy();
    expect(screen.getByText(/3\/10/)).toBeTruthy();
  });

  it("permite editar os dados e só cria após a confirmação", () => {
    const onConfirm = setup();
    fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Mercado ABC" } });
    fireEvent.change(screen.getByLabelText("Valor"), { target: { value: "400" } });

    fireEvent.click(screen.getByText("Continuar"));
    expect(onConfirm).not.toHaveBeenCalled();

    // Cancelar na confirmação volta ao formulário sem criar nada.
    fireEvent.click(screen.getByText("Cancelar"));
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Continuar"));
    fireEvent.click(screen.getByText("Confirmar criação"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0]).toMatchObject({
      description: "Mercado ABC",
      amount: 400,
      cardId: "card-1",
      transactionDate: "2026-08-10",
      competenceDate: "2026-08-01",
    });
  });
});
