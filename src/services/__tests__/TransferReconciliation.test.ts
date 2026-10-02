import { afterEach, describe, expect, it, vi } from "vitest";
import { ReconciliationServiceImpl as RS } from "@/services/ReconciliationService";
import {
  ReconciliationDecisionService,
  ReconciliationDecisionServiceImpl as RD,
} from "@/services/ReconciliationDecisionService";
import { MovementServiceImpl as MS } from "@/services/MovementService";
import { MovementService } from "@/services/MovementService";
import { MovementStatus, MovementType } from "@/constants/enums";
import type { Movement } from "@/models";

const mv = (over: Partial<Movement>): Movement =>
  ({
    id: "x",
    workspace_id: "ws",
    account_id: "a1",
    transfer_account_id: null,
    category_id: null,
    subcategory_id: null,
    card_id: null,
    invoice_id: null,
    asset_id: null,
    import_id: null,
    transfer_group_id: null,
    type: MovementType.EXPENSE,
    status: MovementStatus.CLEARED,
    description: "PIX ENVIADO",
    notes: null,
    amount: 500,
    transaction_date: "2026-02-10",
    competence_date: "2026-02-10",
    due_date: null,
    tags: [],
    attachments: [],
    duplicate_hash: null,
    is_historical: false,
    quantity: null,
    unit_price: null,
    external_ref: null,
    created_at: "2026-02-10T00:00:00Z",
    updated_at: "2026-02-10T00:00:00Z",
    deleted_at: null,
    ...over,
  }) as Movement;

const out = mv({ id: "out", account_id: "a1" });
const inc = mv({
  id: "inc",
  account_id: "a2",
  type: MovementType.INCOME,
  description: "PIX RECEBIDO",
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Conciliação de transferências", () => {
  it("sugere par de mesmo valor, contas diferentes e direções opostas", () => {
    const [c] = RS.findCandidates([out, inc]);
    expect(c.outflow.id).toBe("out");
    expect(c.inflow.id).toBe("inc");
    expect(c.confidence).toBe("high");
    expect(c.signals.length).toBeGreaterThan(0);
  });

  it("ignora pares fora da janela de dias e da mesma conta", () => {
    expect(RS.findCandidates([out, mv({ ...inc, transaction_date: "2026-03-01" })])).toHaveLength(0);
    expect(RS.findCandidates([out, mv({ ...inc, account_id: "a1" })])).toHaveLength(0);
  });

  it("respeita decisões manuais REJECT e MATCH", () => {
    const rejected = RD.rejectedKeys(
      [{ movement_a_id: "out", movement_b_id: "inc", decision: "REJECT", kind: "TRANSFER_MATCH" }],
      "TRANSFER_MATCH",
    );
    expect(RS.findCandidates([out, inc], { rejectedPairKeys: rejected })).toHaveLength(0);

    const matched = RD.matchedKeys(
      [{ movement_a_id: "out", movement_b_id: "inc", decision: "MATCH", kind: "TRANSFER_MATCH" }],
      "TRANSFER_MATCH",
    );
    expect(RS.findCandidates([out, inc], { matchedPairKeys: matched })).toHaveLength(0);
  });

  it("não sugere lançamentos já conciliados ou históricos", () => {
    expect(RS.findCandidates([mv({ ...out, transfer_group_id: "g" }), inc])).toHaveLength(0);
    expect(RS.findCandidates([out, mv({ ...inc, is_historical: true })])).toHaveLength(0);
  });

  it("perna espelho não movimenta saldo nem duplica o valor", () => {
    const leg = mv({
      id: "out",
      type: MovementType.TRANSFER,
      account_id: "a1",
      transfer_account_id: "a2",
      transfer_group_id: "g",
    });
    const mirror = mv({
      id: "inc",
      type: MovementType.TRANSFER,
      account_id: "a2",
      transfer_account_id: null,
      transfer_group_id: "g",
    });
    expect(RS.isMirrorLeg(mirror)).toBe(true);
    expect(MS.impactOnAccount(leg, "a1")).toBe(-500);
    expect(MS.impactOnAccount(leg, "a2")).toBe(500);
    expect(MS.impactOnAccount(mirror, "a2")).toBe(0);
  });
});

describe("Escopo da conciliação por importação", () => {
  it("importação com movimento correspondente existente gera candidato", async () => {
    const importedOut = mv({ id: "imported-out", import_id: "import-1" });
    const oldIn = mv({ id: "old-in", account_id: "a2", type: MovementType.INCOME, import_id: "old" });
    const unrelatedOut = mv({ id: "unrelated-out", import_id: "other" });
    const importedIn = mv({ id: "imported-in", account_id: "a2", type: MovementType.INCOME, import_id: "import-1" });

    const all = [importedOut, oldIn, unrelatedOut, importedIn];
    vi.spyOn(MovementService, "listAll").mockResolvedValue(all);
    vi.spyOn(ReconciliationDecisionService, "list").mockResolvedValue([]);

    const candidates = await new RS().listCandidatesForImport("ws", "import-1");
    expect(candidates.some(c => c.outflow.id === "imported-out" && c.inflow.id === "old-in")).toBe(true);
    expect(candidates.some(c => c.outflow.id === "unrelated-out" && c.inflow.id === "imported-in")).toBe(true);
    expect(
      candidates.every(c => c.outflow.import_id === "import-1" || c.inflow.import_id === "import-1"),
    ).toBe(true);
  });

  it("somente detectar não reconcilia nem altera movimentos", async () => {
    const importedOut = mv({ id: "imported-out", import_id: "import-1" });
    const oldIn = mv({ id: "old-in", account_id: "a2", type: MovementType.INCOME });
    const update = vi.fn();
    const service = new RS({ from: () => ({ update }) } as never);

    const candidates = RS.findCandidates([importedOut, oldIn]);

    expect(candidates).toHaveLength(1);
    expect(update).not.toHaveBeenCalled();
    expect(importedOut.type).toBe(MovementType.EXPENSE);
    expect(oldIn.type).toBe(MovementType.INCOME);
    void service;
  });

  it("reimportação encontra contraparte que já é transferência", async () => {
    const existingTransfer = mv({
      id: "existing-transfer",
      type: MovementType.TRANSFER,
      account_id: "a1",
      transfer_account_id: "a2",
      transfer_group_id: "lonely-group",
      import_id: "old-import",
    });
    const importedIn = mv({
      id: "imported-in",
      account_id: "a2",
      type: MovementType.INCOME,
      import_id: "import-1",
      description: "PIX RECEBIDO",
    });
    vi.spyOn(MovementService, "listAll").mockResolvedValue([existingTransfer, importedIn]);
    vi.spyOn(ReconciliationDecisionService, "list").mockResolvedValue([]);

    const candidates = await new RS().listCandidatesForImport("ws", "import-1");

    expect(candidates).toHaveLength(1);
    expect(candidates[0].outflow).toBe(existingTransfer);
    expect(candidates[0].inflow).toBe(importedIn);
    expect(candidates[0].signals).toContain("Transferência existente");
  });

  it("não associa a transferência existente a uma conta diferente do destino", async () => {
    const existingTransfer = mv({
      id: "existing-transfer",
      type: MovementType.TRANSFER,
      account_id: "a1",
      transfer_account_id: "a2",
      transfer_group_id: "lonely-group",
    });
    const importedInWrongAccount = mv({
      id: "imported-in",
      account_id: "a3",
      type: MovementType.INCOME,
      import_id: "import-1",
    });
    vi.spyOn(MovementService, "listAll").mockResolvedValue([
      existingTransfer,
      importedInWrongAccount,
    ]);
    vi.spyOn(ReconciliationDecisionService, "list").mockResolvedValue([]);

    await expect(new RS().listCandidatesForImport("ws", "import-1")).resolves.toHaveLength(0);
  });

  it("não sugere terceira perna para um grupo de transferência completo", async () => {
    const existingOut = mv({
      id: "existing-out",
      type: MovementType.TRANSFER,
      account_id: "a1",
      transfer_account_id: "a2",
      transfer_group_id: "complete-group",
    });
    const existingMirror = mv({
      id: "existing-mirror",
      type: MovementType.TRANSFER,
      account_id: "a2",
      transfer_account_id: null,
      transfer_group_id: "complete-group",
    });
    const importedIn = mv({
      id: "imported-in",
      account_id: "a2",
      type: MovementType.INCOME,
      import_id: "import-1",
    });
    vi.spyOn(MovementService, "listAll").mockResolvedValue([
      existingOut,
      existingMirror,
      importedIn,
    ]);
    vi.spyOn(ReconciliationDecisionService, "list").mockResolvedValue([]);

    await expect(new RS().listCandidatesForImport("ws", "import-1")).resolves.toHaveLength(0);
  });

  it("mantém rejeição manual também na busca complementar", async () => {
    const existingTransfer = mv({
      id: "existing-transfer",
      type: MovementType.TRANSFER,
      account_id: "a1",
      transfer_account_id: "a2",
      transfer_group_id: "lonely-group",
    });
    const importedIn = mv({
      id: "imported-in",
      account_id: "a2",
      type: MovementType.INCOME,
      import_id: "import-1",
    });
    vi.spyOn(MovementService, "listAll").mockResolvedValue([existingTransfer, importedIn]);
    vi.spyOn(ReconciliationDecisionService, "list").mockResolvedValue([
      {
        movement_a_id: "existing-transfer",
        movement_b_id: "imported-in",
        decision: "REJECT",
        kind: "TRANSFER_MATCH",
      },
    ] as never);

    await expect(new RS().listCandidatesForImport("ws", "import-1")).resolves.toHaveLength(0);
  });

  it("confirmar atualiza somente as duas pernas e registra a decisão", async () => {
    const updates: Array<{ payload: Record<string, unknown>; id: string }> = [];
    const client = {
      from: () => ({
        update: (payload: Record<string, unknown>) => ({
          eq: async (_column: string, id: string) => {
            updates.push({ payload, id });
            return { error: null };
          },
        }),
      }),
    };
    const confirm = vi
      .spyOn(ReconciliationDecisionService, "confirmTransfer")
      .mockResolvedValue(undefined);
    const candidate = RS.findCandidates([out, inc])[0];

    await new RS(client as never).apply(candidate);

    expect(updates).toHaveLength(2);
    expect(updates.map((entry) => entry.id)).toEqual(["out", "inc"]);
    expect(updates.every((entry) => entry.payload.type === MovementType.TRANSFER)).toBe(true);
    expect(updates[0].payload.transfer_group_id).toBe(updates[1].payload.transfer_group_id);
    expect(confirm).toHaveBeenCalledOnce();

    const reconciledOut = mv({
      ...out,
      type: MovementType.TRANSFER,
      transfer_account_id: "a2",
      transfer_group_id: String(updates[0].payload.transfer_group_id),
    });
    const reconciledIn = mv({
      ...inc,
      type: MovementType.TRANSFER,
      transfer_account_id: null,
      transfer_group_id: String(updates[1].payload.transfer_group_id),
    });
    expect(MS.impactOnAccount(reconciledOut, "a1")).toBe(-500);
    expect(MS.impactOnAccount(reconciledOut, "a2")).toBe(500);
    expect(MS.impactOnAccount(reconciledIn, "a2")).toBe(0);
  });

  it("rejeitar registra a decisão sem reconciliar movimentos", async () => {
    const from = vi.fn();
    const reject = vi
      .spyOn(ReconciliationDecisionService, "rejectTransfer")
      .mockResolvedValue(undefined);
    const candidate = RS.findCandidates([out, inc])[0];

    await new RS({ from } as never).reject(candidate);

    expect(reject).toHaveBeenCalledWith({
      workspaceId: "ws",
      movementAId: "out",
      movementBId: "inc",
    });
    expect(from).not.toHaveBeenCalled();
  });
});
