import { describe, expect, it } from "vitest";
import {
  buildReviewPath,
  hasNewMovements,
  IMPORT_REVIEW_ROUTE,
  reviewImportId,
} from "@/services/ImportNavigationService";
import { ImportReviewServiceImpl } from "@/services/ImportReviewService";
import { MovementStatus, MovementType } from "@/constants/enums";
import type { Movement } from "@/models";
import type { CommitResult } from "@/services/ImportService";

const IMPORT_A = "11111111-1111-1111-1111-111111111111";
const IMPORT_B = "22222222-2222-2222-2222-222222222222";

function mov(over: Partial<Movement>): Movement {
  return {
    id: crypto.randomUUID(),
    workspace_id: "ws",
    account_id: "acc",
    card_id: null,
    invoice_id: null,
    asset_id: null,
    category_id: null,
    subcategory_id: null,
    type: MovementType.EXPENSE,
    status: MovementStatus.PAID,
    description: "Compra",
    amount: -100,
    transaction_date: "2026-08-01",
    competence_date: "2026-08-01",
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
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    deleted_at: null,
    ...over,
  } as Movement;
}

function commit(inserted: number, importId: string): CommitResult {
  return {
    importRecord: { id: importId } as CommitResult["importRecord"],
    inserted,
    duplicated: 0,
    ignored: 0,
    autoReconciled: 0,
  };
}

describe("Fluxo pós-importação — navegação para revisão", () => {
  it("A: importação com novos lançamentos expõe revisão com o import_id correto", () => {
    const res = commit(2, IMPORT_A);
    expect(hasNewMovements(res)).toBe(true);
    expect(reviewImportId(res)).toBe(IMPORT_A);
    expect(IMPORT_REVIEW_ROUTE).toBe("/importacoes/revisao/$importId");
    expect(buildReviewPath(reviewImportId(res)!)).toBe(`/importacoes/revisao/${IMPORT_A}`);
  });

  it("B: importação sem novos lançamentos não abre revisão", () => {
    const res = { ...commit(0, IMPORT_A), duplicated: 5 };
    expect(hasNewMovements(res)).toBe(false);
    expect(hasNewMovements(null)).toBe(false);
  });

  it("C: histórico gera a rota da importação selecionada", () => {
    expect(buildReviewPath(IMPORT_B)).toBe(`/importacoes/revisao/${IMPORT_B}`);
    expect(buildReviewPath(IMPORT_A)).not.toBe(buildReviewPath(IMPORT_B));
  });

  it("D: revisão contém somente os lançamentos daquela importação", () => {
    const movements = [
      mov({ import_id: IMPORT_A, description: "Novo 1" }),
      mov({ import_id: IMPORT_A, description: "Novo 2" }),
      mov({ import_id: IMPORT_B, description: "Outra importação" }),
      mov({ import_id: null, description: "Antigo manual" }),
      mov({ import_id: IMPORT_A, description: "Excluído", deleted_at: "2026-08-02T00:00:00Z" }),
    ];
    const rows = ImportReviewServiceImpl.buildRows(movements, IMPORT_A, []);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.movement.description).sort()).toEqual(["Novo 1", "Novo 2"]);
  });

  it("E: lançamentos classificados também aparecem na revisão", () => {
    const movements = [
      mov({ import_id: IMPORT_A, category_id: "cat-1", description: "Mercado" }),
    ];
    const rows = ImportReviewServiceImpl.buildRows(movements, IMPORT_A, []);
    expect(rows).toHaveLength(1);
    const summary = ImportReviewServiceImpl.summarize(rows);
    expect(summary.total).toBe(1);
    expect(summary.withoutCategory).toBe(0);
  });
});
