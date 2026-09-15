import { describe, expect, it } from "vitest";
import { AssetType, AssetValuationSource, MovementStatus, MovementType } from "@/constants/enums";
import type { Asset, Movement } from "@/models";
import type { QuotedAsset } from "@/services/MarketQuotationService";
import { InvestmentServiceImpl } from "@/services/InvestmentService";
import { MovementServiceImpl } from "@/services/MovementService";

const asset = (overrides: Partial<Asset & Partial<QuotedAsset>> = {}) =>
  ({
    id: "asset-1",
    workspace_id: "workspace-1",
    name: "WEG",
    asset_type: AssetType.ACAO,
    institution: "Corretora",
    ticker: "WEGE3",
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
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    deleted_at: null,
    quote: {
      ticker: "WEGE3",
      price: 35,
      currency: "BRL",
      quotedAt: "2026-09-15T20:00:00.000Z",
      change: null,
      changePercent: null,
      marketState: "CLOSED",
      provider: "mock",
    },
    ...overrides,
  }) as Asset & Partial<QuotedAsset>;

let sequence = 0;
const movement = (overrides: Partial<Movement> = {}): Movement => ({
  id: `movement-${++sequence}`,
  workspace_id: "workspace-1",
  account_id: "account-1",
  transfer_account_id: null,
  category_id: null,
  subcategory_id: null,
  card_id: null,
  invoice_id: null,
  asset_id: "asset-1",
  import_id: null,
  transfer_group_id: null,
  type: MovementType.INVESTMENT,
  status: MovementStatus.CLEARED,
  description: "Compra",
  notes: null,
  amount: 1000,
  transaction_date: "2026-01-10",
  competence_date: "2026-01-10",
  due_date: null,
  tags: ["op:APORTE"],
  attachments: [],
  duplicate_hash: null,
  is_historical: false,
  quantity: 10,
  unit_price: 100,
  external_ref: null,
  created_at: "2026-01-10",
  updated_at: "2026-01-10",
  deleted_at: null,
  ...overrides,
});

describe("Sprint 4.16A — resumo da posição atual", () => {
  it("reconstrói uma posição com uma compra", () => {
    const summary = InvestmentServiceImpl.positionSummary(asset(), [movement()]);
    expect(summary).toMatchObject({ quantity: 10, historicalCost: 1000, averagePrice: 100 });
  });

  it("soma múltiplas compras", () => {
    const summary = InvestmentServiceImpl.positionSummary(asset(), [
      movement({ amount: 1000, quantity: 10 }),
      movement({ amount: 1800, quantity: 20, transaction_date: "2026-02-10" }),
    ]);
    expect(summary?.quantity).toBe(30);
    expect(summary?.historicalCost).toBe(2800);
  });

  it("calcula o preço médio pelo custo da posição", () => {
    const summary = InvestmentServiceImpl.positionSummary(asset(), [
      movement({ amount: 1000, quantity: 10 }),
      movement({ amount: 1800, quantity: 20, transaction_date: "2026-02-10" }),
    ]);
    expect(summary?.averagePrice).toBeCloseTo(93.333333, 6);
  });

  it("usa o custo histórico das aquisições válidas", () => {
    const summary = InvestmentServiceImpl.positionSummary(asset(), [
      movement({ amount: 1000, quantity: 10 }),
      movement({ amount: 900, quantity: 9, deleted_at: "2026-03-01" }),
    ]);
    expect(summary?.historicalCost).toBe(1000);
  });

  it("calcula o valor atual usando quantidade e cotação", () => {
    const summary = InvestmentServiceImpl.positionSummary(asset(), [movement()]);
    expect(summary?.marketValue).toBe(350);
  });

  it("calcula resultado em reais e percentual", () => {
    const summary = InvestmentServiceImpl.positionSummary(
      asset({ quote: { ...asset().quote!, price: 120 } }),
      [movement()],
    );
    expect(summary?.result).toBe(200);
    expect(summary?.resultPercent).toBe(20);
  });

  it("venda reduz quantidade e custo da posição pelo preço médio", () => {
    const summary = InvestmentServiceImpl.positionSummary(asset(), [
      movement({ amount: 1000, quantity: 10 }),
      movement({
        amount: 450,
        quantity: 4,
        type: MovementType.INCOME,
        tags: ["op:RESGATE"],
        transaction_date: "2026-02-10",
      }),
    ]);
    expect(summary).toMatchObject({ quantity: 6, historicalCost: 600, averagePrice: 100 });
  });

  it("não calcula valor ou resultado sem cotação", () => {
    const summary = InvestmentServiceImpl.positionSummary(asset({ quote: null }), [movement()]);
    expect(summary).toMatchObject({ quote: null, marketValue: null, result: null, resultPercent: null });
  });

  it("não trata ativo ACCOUNT como posição cotada", () => {
    const summary = InvestmentServiceImpl.positionSummary(
      asset({ valuation_source: AssetValuationSource.ACCOUNT, account_id: "account-1" }),
      [movement()],
    );
    expect(summary).toBeNull();
  });

  it("operação histórica compõe a posição sem alterar saldo da conta", () => {
    const historical = movement({ is_historical: true, account_id: "account-1" });
    const summary = InvestmentServiceImpl.positionSummary(asset(), [historical]);
    expect(summary?.historicalCost).toBe(1000);
    expect(MovementServiceImpl.impactOnAccount(historical, "account-1")).toBe(0);
  });
});