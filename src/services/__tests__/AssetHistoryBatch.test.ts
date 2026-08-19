import { describe, expect, it } from "vitest";
import { AssetHistoryServiceImpl } from "@/services/AssetHistoryService";
import { AssetValuationServiceImpl } from "@/services/AssetValuationService";
import { MovementStatus, MovementType } from "@/constants/enums";
import type { Movement } from "@/models";

const WS = "ws-1";
const ASSET = "asset-1";

function movementFrom(input: ReturnType<typeof build>["inputs"][number], id: string): Movement {
  return {
    id,
    workspace_id: WS,
    account_id: null,
    transfer_account_id: null,
    category_id: null,
    subcategory_id: null,
    card_id: null,
    invoice_id: null,
    asset_id: input.asset_id ?? null,
    import_id: null,
    transfer_group_id: null,
    type: input.type,
    status: input.status ?? MovementStatus.CLEARED,
    description: input.description ?? "",
    notes: null,
    amount: input.amount,
    transaction_date: input.transaction_date,
    competence_date: input.competence_date ?? null,
    due_date: null,
    tags: input.tags ?? [],
    attachments: [],
    duplicate_hash: null,
    is_historical: !!input.is_historical,
    quantity: input.quantity ?? null,
    unit_price: input.unit_price ?? null,
    external_ref: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
  };
}

function build(entries: { date: string; quantity: number; unit_price: number }[], existing: Movement[] = []) {
  return AssetHistoryServiceImpl.buildMovementInputs({
    workspaceId: WS,
    assetId: ASSET,
    assetName: "WEGE3",
    entries,
    existingMovements: existing,
  });
}

describe("Sprint 4.8.1 — histórico de ativos em lote", () => {
  it("consolida totais e preço médio das linhas válidas", () => {
    const totals = AssetHistoryServiceImpl.totals([
      { date: "2024-01-10", quantity: 10, unit_price: 30 },
      { date: "2024-02-10", quantity: 10, unit_price: 40 },
      { date: "", quantity: 5, unit_price: 10 },
    ]);
    expect(totals.count).toBe(2);
    expect(totals.quantity).toBe(20);
    expect(totals.cost).toBe(700);
    expect(totals.averagePrice).toBe(35);
  });

  it("gera movimentações históricas de aporte sem tocar em conta/cartão", () => {
    const { inputs, invalid } = build([
      { date: "2024-01-10", quantity: 10, unit_price: 30 },
      { date: "2024-01-11", quantity: 0, unit_price: 30 },
    ]);
    expect(invalid).toHaveLength(1);
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toMatchObject({
      asset_id: ASSET,
      account_id: null,
      card_id: null,
      type: MovementType.INVESTMENT,
      is_historical: true,
      amount: 300,
      quantity: 10,
    });
    expect(inputs[0].tags).toContain("op:APORTE");
  });

  it("ignora linhas duplicadas dentro do lote e contra o histórico existente", () => {
    const first = build([{ date: "2024-01-10", quantity: 10, unit_price: 30 }]);
    const existing = [movementFrom(first.inputs[0], "m1")];
    const again = build(
      [
        { date: "2024-01-10", quantity: 10, unit_price: 30 },
        { date: "2024-03-01", quantity: 5, unit_price: 20 },
        { date: "2024-03-01", quantity: 5, unit_price: 20 },
      ],
      existing,
    );
    expect(again.inputs).toHaveLength(1);
    expect(again.duplicates).toHaveLength(2);
  });

  it("posição do ativo reflete o lote gravado", () => {
    const { inputs } = build([
      { date: "2024-01-10", quantity: 10, unit_price: 30 },
      { date: "2024-02-10", quantity: 10, unit_price: 40 },
    ]);
    const movements = inputs.map((i, idx) => movementFrom(i, `m${idx}`));
    const position = AssetValuationServiceImpl.positionOf(ASSET, movements);
    expect(position.quantity).toBe(20);
    expect(position.cost).toBe(700);
    expect(position.averagePrice).toBe(35);
    expect(position.historicalOperations).toBe(2);
  });
});
