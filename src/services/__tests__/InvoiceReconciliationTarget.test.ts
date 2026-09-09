// Sprint 4.15C — a conciliação deve alterar o MOVIMENTO correto e respeitar
// exatamente a FATURA selecionada na rota.
import { describe, expect, it, vi, beforeEach } from "vitest";

const { movementApi } = vi.hoisted(() => ({
  movementApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    getById: vi.fn(),
  },
}));
vi.mock("@/services/MovementService", () => ({
  MovementService: movementApi,
  MovementServiceImpl: class {},
}));

const { invoiceApi } = vi.hoisted(() => ({
  invoiceApi: {
    recompute: vi.fn(),
    findInvoiceIdForDate: vi.fn(),
  },
}));
vi.mock("@/services/CardInvoiceService", () => ({
  CardInvoiceService: invoiceApi,
  CardInvoiceServiceImpl: class {},
}));

import {
  CardInvoiceReconciliationActionServiceImpl as Svc,
  InvoiceChangeRequiresConfirmationError,
  PersistenceVerificationError,
} from "@/services/CardInvoiceReconciliationActionService";

type Row = Record<string, unknown>;

function fakeClient() {
  const state: { inserts: Row[]; updates: Row[] } = { inserts: [], updates: [] };
  const builder = (inserted: Row) => ({
    insert: (v: Row) => {
      state.inserts.push(v);
      return {
        select: () => ({
          single: async () => ({ data: { ...inserted, ...v }, error: null }),
        }),
      };
    },
    update: (v: Row) => {
      state.updates.push(v);
      return {
        eq: () => ({
          select: () => ({ single: async () => ({ data: { ...inserted, ...v }, error: null }) }),
        }),
      };
    },
  });
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    from: () => builder({ id: "act-1" }),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { svc: new (Svc as any)(client), state };
}

const MOVEMENT = {
  id: "mv-1",
  workspace_id: "ws-1",
  card_id: "card-1",
  invoice_id: "inv-1",
  amount: 100,
  transaction_date: "2026-08-10",
  competence_date: "2026-08-01",
  updated_at: "t0",
};

const base = {
  workspaceId: "ws-1",
  invoiceId: "inv-1",
  itemKey: "official:0",
  movementId: "mv-1",
};

beforeEach(() => {
  movementApi.getById.mockReset();
  movementApi.update.mockReset();
  movementApi.create.mockReset();
  invoiceApi.recompute.mockReset().mockResolvedValue(undefined);
  invoiceApi.findInvoiceIdForDate.mockReset().mockResolvedValue("inv-1");
});

describe("correção de valor", () => {
  it("altera o movimento alvo, preserva a fatura e recalcula apenas ela", async () => {
    const after = { ...MOVEMENT, amount: 250, updated_at: "t1" };
    movementApi.getById.mockResolvedValueOnce(MOVEMENT).mockResolvedValueOnce(after);
    movementApi.update.mockResolvedValue(after);

    const { svc } = fakeClient();
    await svc.execute({ ...base, action: "CORRECT_AMOUNT", newAmount: 250 });

    expect(movementApi.update).toHaveBeenCalledWith("mv-1", {
      amount: 250,
      invoice_id: "inv-1",
    });
    expect(movementApi.create).not.toHaveBeenCalled();
    expect(invoiceApi.recompute).toHaveBeenCalledWith("inv-1");
  });

  it("falha sem registrar sucesso quando a alteração não persiste", async () => {
    movementApi.getById.mockResolvedValueOnce(MOVEMENT).mockResolvedValueOnce(MOVEMENT);
    movementApi.update.mockResolvedValue(MOVEMENT);
    const { svc } = fakeClient();
    await expect(
      svc.execute({ ...base, action: "CORRECT_AMOUNT", newAmount: 250 }),
    ).rejects.toBeInstanceOf(PersistenceVerificationError);
    expect(invoiceApi.recompute).not.toHaveBeenCalled();
  });
});

describe("correção de data", () => {
  it("mantém o vínculo quando a nova data continua na fatura conciliada", async () => {
    const after = { ...MOVEMENT, transaction_date: "2026-08-12", updated_at: "t1" };
    movementApi.getById.mockResolvedValueOnce(MOVEMENT).mockResolvedValueOnce(after);
    movementApi.update.mockResolvedValue(after);

    const { svc } = fakeClient();
    await svc.execute({ ...base, action: "CORRECT_DATE", newDate: "2026-08-12" });

    expect(movementApi.update).toHaveBeenCalledWith("mv-1", {
      transaction_date: "2026-08-12",
      invoice_id: "inv-1",
    });
  });

  it("exige confirmação explícita quando a nova data pertence a outra fatura", async () => {
    invoiceApi.findInvoiceIdForDate.mockResolvedValue("inv-2");
    movementApi.getById.mockResolvedValue(MOVEMENT);
    const { svc } = fakeClient();

    await expect(
      svc.execute({ ...base, action: "CORRECT_DATE", newDate: "2026-09-05" }),
    ).rejects.toBeInstanceOf(InvoiceChangeRequiresConfirmationError);
    expect(movementApi.update).not.toHaveBeenCalled();
  });

  it("move apenas com allowInvoiceChange e recalcula a fatura da rota", async () => {
    invoiceApi.findInvoiceIdForDate.mockResolvedValue("inv-2");
    const after = {
      ...MOVEMENT,
      transaction_date: "2026-09-05",
      invoice_id: "inv-2",
      updated_at: "t1",
    };
    movementApi.getById.mockResolvedValueOnce(MOVEMENT).mockResolvedValueOnce(after);
    movementApi.update.mockResolvedValue(after);

    const { svc } = fakeClient();
    await svc.execute({
      ...base,
      action: "CORRECT_DATE",
      newDate: "2026-09-05",
      allowInvoiceChange: true,
    });

    expect(movementApi.update).toHaveBeenCalledWith("mv-1", {
      transaction_date: "2026-09-05",
      invoice_id: "inv-2",
    });
    expect(invoiceApi.recompute).toHaveBeenCalledWith("inv-1");
  });
});

describe("vínculo de lançamento existente", () => {
  it("usa sempre a fatura da rota, mesmo estando CLOSED", async () => {
    const other = { ...MOVEMENT, invoice_id: "inv-9" };
    const after = { ...MOVEMENT, invoice_id: "inv-1", updated_at: "t1" };
    movementApi.getById.mockResolvedValueOnce(other).mockResolvedValueOnce(after);
    movementApi.update.mockResolvedValue(after);

    const { svc } = fakeClient();
    await svc.execute({ ...base, action: "LINK_EXISTING_MOVEMENT" });

    expect(movementApi.update).toHaveBeenCalledWith("mv-1", { invoice_id: "inv-1" });
  });
});
