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

  it("não calcula valor ou resultado sem posição suficiente", () => {
    const summary = InvestmentServiceImpl.positionSummary(asset(), []);
    expect(summary).toMatchObject({
      quantity: 0,
      historicalCost: 0,
      quote: 35,
      marketValue: null,
      result: null,
      resultPercent: null,
    });
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

describe("Sprint 4.17B — posição histórica e retorno econômico", () => {
  it("calcula retorno acumulado de R$ 1.800 e 18%", () => {
    const summary = InvestmentServiceImpl.positionSummary(
      asset({ quote: { ...asset().quote!, price: 112.5 } }),
      [
        movement({ amount: 10000, quantity: 100, is_historical: true, account_id: null }),
        movement({ amount: 2000, quantity: 20, tags: ["op:RESGATE"], is_historical: true, account_id: null, transaction_date: "2026-02-10" }),
        movement({ amount: 800, quantity: null, type: MovementType.DIVIDEND, tags: ["source:B3", "b3:event:DIVIDEND", "op:RENDIMENTO"], is_historical: true, account_id: null, transaction_date: "2026-03-10" }),
      ],
    );
    expect(summary).toMatchObject({ investedCapital: 10000, realizedValue: 2000, incomeReceived: 800, marketValue: 9000, economicReturn: 1800, economicReturnPercent: 18 });
  });

  it("conta dividendos conciliados com a conta no retorno econômico", () => {
    const summary = InvestmentServiceImpl.positionSummary(
      asset({ quote: { ...asset().quote!, price: 120 } }),
      [
        movement({ amount: 1000, quantity: 10, account_id: "account-1", is_historical: true }),
        movement({
          amount: 100,
          quantity: null,
          type: MovementType.DIVIDEND,
          tags: ["source:B3", "b3:event:DIVIDEND", "op:RENDIMENTO"],
          account_id: "account-1",
          is_historical: true,
          transaction_date: "2026-02-10",
        }),
      ],
    );
    expect(summary).toMatchObject({
      incomeReceived: 100,
      economicReturn: 300,
      economicReturnPercent: 30,
      realizedResult: 0,
    });
  });

  it("preserva o ativo quando a posição chega a zero", () => {
    const summary = InvestmentServiceImpl.positionSummary(asset(), [
      movement({ amount: 1000, quantity: 10, is_historical: true }),
      movement({ amount: 1200, quantity: 10, tags: ["op:RESGATE"], is_historical: true, transaction_date: "2026-02-10" }),
    ]);
    expect(summary).toMatchObject({ quantity: 0, historicalCost: 0, realizedValue: 1200, economicReturn: 200, economicReturnPercent: 20 });
  });

  it("permite recompra após posição zero sem recriar o ativo", () => {
    const summary = InvestmentServiceImpl.positionSummary(asset({ quote: { ...asset().quote!, price: 60 } }), [
      movement({ amount: 1000, quantity: 10 }),
      movement({ amount: 1100, quantity: 10, tags: ["op:RESGATE"], transaction_date: "2026-02-10" }),
      movement({ amount: 500, quantity: 10, transaction_date: "2026-03-10" }),
    ]);
    expect(summary).toMatchObject({ quantity: 10, historicalCost: 500, averagePrice: 50, marketValue: 600 });
  });

  it.each([
    ["BONUS", "qty:INCREASE", 12],
    ["SPLIT", "qty:INCREASE", 12],
    ["REVERSE_SPLIT", "qty:DECREASE", 8],
  ])("aplica %s à quantidade sem duplicar custo", (event, direction, expected) => {
    const summary = InvestmentServiceImpl.positionSummary(asset(), [
      movement({ amount: 1000, quantity: 10 }),
      movement({ amount: 0, quantity: 2, type: MovementType.ADJUSTMENT, tags: ["op:AJUSTE_QUANTIDADE", `b3:event:${event}`, direction], transaction_date: "2026-02-10" }),
    ]);
    expect(summary?.quantity).toBe(expected);
    expect(summary?.historicalCost).toBe(1000);
  });

  it("não inventa retorno econômico para posição aberta sem cotação", () => {
    expect(InvestmentServiceImpl.positionSummary(asset({ quote: null }), [movement()])?.economicReturn).toBeNull();
  });
});

describe("Retorno econômico — distribuições e exibição", () => {
  const b3Distribution = (event: "DIVIDEND" | "JCP" | "YIELD", amount: number) =>
    movement({
      amount,
      quantity: null,
      type: event === "DIVIDEND" ? MovementType.DIVIDEND : MovementType.INTEREST,
      tags: ["source:B3", `b3:event:${event}`, "op:RENDIMENTO"],
      is_historical: true,
      account_id: null,
      transaction_date: "2026-02-10",
    });

  it.each([
    ["dividendo", "DIVIDEND" as const],
    ["JCP", "JCP" as const],
    ["rendimento", "YIELD" as const],
  ])("inclui %s histórico B3 no retorno econômico", (_label, event) => {
    const summary = InvestmentServiceImpl.positionSummary(
      asset({ quote: { ...asset().quote!, price: 120 } }),
      [movement({ is_historical: true }), b3Distribution(event, 100)],
    );

    expect(summary).toMatchObject({
      incomeReceived: 100,
      economicReturn: 300,
      economicReturnPercent: 30,
    });
  });

  it("não considera evento corporativo B3 como rendimento financeiro", () => {
    const summary = InvestmentServiceImpl.positionSummary(
      asset({ quote: { ...asset().quote!, price: 120 } }),
      [
        movement({ is_historical: true }),
        movement({
          amount: 100,
          quantity: null,
          type: MovementType.INTEREST,
          tags: ["source:B3", "b3:event:CAPITAL_RETURN", "op:RENDIMENTO"],
          is_historical: true,
        }),
      ],
    );

    expect(summary).toMatchObject({ incomeReceived: 0, economicReturn: 200 });
  });

  it("usa o resultado realizado da venda, sem tratar o valor bruto como lucro", () => {
    const summary = InvestmentServiceImpl.positionSummary(asset(), [
      movement({ amount: 1000, quantity: 10, is_historical: true }),
      movement({
        amount: 600,
        quantity: 5,
        tags: ["source:B3", "b3:event:REDEMPTION", "op:RESGATE"],
        is_historical: true,
        transaction_date: "2026-02-10",
      }),
    ]);

    expect(summary).toMatchObject({ realizedValue: 600, realizedResult: 100, economicReturn: -225 });
  });

  it("calcula o retorno absoluto com capital zero e omite somente o percentual", () => {
    const summary = InvestmentServiceImpl.positionSummary(asset(), [
      movement({
        amount: 0,
        quantity: 3.37,
        type: MovementType.ADJUSTMENT,
        tags: ["source:B3", "b3:event:SPLIT", "op:AJUSTE_QUANTIDADE", "qty:INCREASE"],
        is_historical: true,
      }),
      b3Distribution("DIVIDEND", 51.58),
    ]);

    expect(summary).toMatchObject({
      marketValue: 117.95,
      incomeReceived: 51.58,
      economicReturn: 169.53,
      economicReturnPercent: null,
    });
  });

  it("entrega o mesmo retorno econômico ao detalhe e à listagem", () => {
    const quotedAsset = asset({ quote: { ...asset().quote!, price: 120 } });
    const movements = [movement({ is_historical: true }), b3Distribution("JCP", 100)];
    const detail = InvestmentServiceImpl.positionSummary(quotedAsset, movements);
    const [row] = InvestmentServiceImpl.rows([quotedAsset], movements);

    expect(detail?.economicReturn).toBe(300);
    expect(row?.economicReturn).toBe(detail?.economicReturn);
  });
});