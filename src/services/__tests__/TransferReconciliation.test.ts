import { describe, expect, it } from "vitest";
import { ReconciliationServiceImpl as RS } from "@/services/ReconciliationService";
import { ReconciliationDecisionServiceImpl as RD } from "@/services/ReconciliationDecisionService";
import { MovementServiceImpl as MS } from "@/services/MovementService";
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
