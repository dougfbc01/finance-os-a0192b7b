import { describe, expect, it } from "vitest";
import { AssetValuationServiceImpl } from "../AssetValuationService";
import { PatrimonyServiceImpl } from "../PatrimonyService";
import { ImportReviewServiceImpl } from "../ImportReviewService";
import {
  AssetType,
  AssetValuationSource,
  MovementStatus,
  MovementType,
} from "@/constants/enums";
import type { Asset, Movement } from "@/models";

const asset = (over: Partial<Asset> = {}): Asset => ({
  id: "a1",
  workspace_id: "w",
  name: "Poupança Santander",
  asset_type: AssetType.CDB,
  institution: "Santander",
  ticker: null,
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
  created_at: "",
  updated_at: "",
  deleted_at: null,
  ...over,
});

const mov = (over: Partial<Movement> = {}): Movement => ({
  id: "m1",
  workspace_id: "w",
  account_id: "acc1",
  transfer_account_id: null,
  category_id: null,
  subcategory_id: null,
  card_id: null,
  invoice_id: null,
  asset_id: "a1",
  import_id: null,
  transfer_group_id: null,
  type: MovementType.INVESTMENT,
  status: MovementStatus.CLEARED,
  description: "Aplicação",
  notes: null,
  amount: 50,
  transaction_date: "2026-01-10",
  competence_date: null,
  due_date: null,
  tags: ["op:APORTE"],
  attachments: [],
  duplicate_hash: null,
  is_historical: false,
  quantity: null,
  unit_price: null,
  external_ref: null,
  created_at: "",
  updated_at: "",
  deleted_at: null,
  ...over,
});

describe("AssetValuationService", () => {
  it("aplicação em ativo soma no ativo", () => {
    const [a] = AssetValuationServiceImpl.effectiveAssets([asset()], [mov()]);
    expect(a.effective_value).toBe(50);
  });

  it("resgate reduz o valor do ativo", () => {
    const [a] = AssetValuationServiceImpl.effectiveAssets(
      [asset({ opening_value: 100 })],
      [mov({ tags: ["op:RESGATE"], amount: 40 })],
    );
    expect(a.effective_value).toBe(60);
  });

  it("rendimento sem conta aumenta o patrimônio do ativo", () => {
    const [a] = AssetValuationServiceImpl.effectiveAssets(
      [asset()],
      [mov({ tags: ["op:RENDIMENTO"], account_id: null, amount: 7 })],
    );
    expect(a.effective_value).toBe(7);
    expect(a.impact.yields).toBe(7);
  });

  it("rendimento creditado em conta não duplica no ativo", () => {
    const [a] = AssetValuationServiceImpl.effectiveAssets(
      [asset()],
      [mov({ tags: ["op:RENDIMENTO"], amount: 7 })],
    );
    expect(a.effective_value).toBe(0);
  });

  it("caixinha baseada em conta espelha o saldo e não conta duas vezes", () => {
    const caixinha = asset({
      id: "a2",
      valuation_source: AssetValuationSource.ACCOUNT,
      account_id: "acc1",
    });
    const [a] = AssetValuationServiceImpl.effectiveAssets([caixinha], [], { acc1: 300 });
    expect(a.effective_value).toBe(300);
    expect(a.counts_in_total).toBe(false);
    expect(PatrimonyServiceImpl.totalAssetsValue([a])).toBe(0);
  });

  it("transferência conta → ativo não altera o patrimônio líquido", () => {
    const [a] = AssetValuationServiceImpl.effectiveAssets([asset()], [mov()]);
    const snap = PatrimonyServiceImpl.snapshot({
      cashBalance: 1000 - 50,
      assets: [a],
      invoices: [],
    });
    expect(snap.netWorth).toBe(1000);
  });
});

describe("ImportReviewService", () => {
  const rows = (extra: Movement[] = []) =>
    ImportReviewServiceImpl.buildRows(
      [
        mov({ id: "n1", import_id: "imp1", asset_id: null, type: MovementType.EXPENSE }),
        mov({ id: "n2", import_id: "imp1", asset_id: null, type: MovementType.INCOME, amount: 200 }),
        mov({ id: "old", import_id: "imp0", asset_id: null, type: MovementType.EXPENSE }),
        mov({ id: "del", import_id: "imp1", asset_id: null, deleted_at: "2026-01-01" }),
        ...extra,
      ],
      "imp1",
      [],
    );

  it("mostra somente os lançamentos novos da importação", () => {
    const ids = rows().map((r) => r.movement.id);
    expect(ids).toEqual(["n1", "n2"]);
  });

  it("resume as pendências da revisão", () => {
    const s = ImportReviewServiceImpl.summarize(rows());
    expect(s.total).toBe(2);
    expect(s.withoutCategory).toBe(2);
    expect(s.needsAttention).toBe(2);
    expect(s.net).toBe(150);
  });

  it("sinaliza possível duplicidade contra a base anterior", () => {
    const r = rows().find((x) => x.movement.id === "n1");
    expect(r?.flags).toContain("POSSIBLE_DUPLICATE");
  });
});
