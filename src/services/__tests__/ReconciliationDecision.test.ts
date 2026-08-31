import { describe, expect, it } from "vitest";
import { ReconciliationDecisionServiceImpl as RD } from "@/services/ReconciliationDecisionService";
import { SimilarityServiceImpl } from "@/services/SimilarityService";
import { MovementStatus, MovementType } from "@/constants/enums";
import type { Movement } from "@/models";

const mv = (id: string, date: string, amount: number): Movement =>
  ({
    id,
    workspace_id: "ws",
    account_id: "acc",
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
    description: "Mercado Central",
    notes: null,
    amount,
    transaction_date: date,
    competence_date: date,
    due_date: null,
    tags: [],
    attachments: [],
    duplicate_hash: null,
    is_historical: false,
    quantity: null,
    unit_price: null,
    external_ref: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
  }) as Movement;

describe("ReconciliationDecisionService", () => {
  it("gera chave canônica independente da ordem", () => {
    expect(RD.pairKey("b", "a")).toBe(RD.pairKey("a", "b"));
  });

  it("considera apenas decisões REJECT", () => {
    const keys = RD.rejectedKeys([
      { movement_a_id: "a", movement_b_id: "b", decision: "REJECT" },
      { movement_a_id: "c", movement_b_id: "d", decision: "MATCH" },
    ]);
    expect(RD.isRejected(keys, "b", "a")).toBe(true);
    expect(RD.isRejected(keys, "c", "d")).toBe(false);
    expect(RD.isRejected(undefined, "a", "b")).toBe(false);
  });

  it("motor de similaridade não sugere pares rejeitados", () => {
    const movements = [mv("a", "2026-01-10", 150), mv("b", "2026-01-11", 150)];
    expect(SimilarityServiceImpl.findPairs(movements).length).toBeGreaterThan(0);
    const rejected = RD.rejectedKeys([
      { movement_a_id: "a", movement_b_id: "b", decision: "REJECT" },
    ]);
    expect(SimilarityServiceImpl.findPairs(movements, undefined, rejected)).toHaveLength(0);
  });
});
