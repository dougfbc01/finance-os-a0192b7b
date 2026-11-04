// Valor patrimonial por tipo e regra de custo ausente na rentabilidade por grupo.
import { describe, expect, it } from "vitest";
import { AssetType, AssetValuationSource, MovementStatus, MovementType } from "@/constants/enums";
import type { Asset, Movement } from "@/models";
import type { MarketPricePoint, MarketQuoteMap } from "@/models/MarketData";
import { AssetValuationServiceImpl } from "../AssetValuationService";
import { InvestmentServiceImpl } from "../InvestmentService";
import { MarketQuotationServiceImpl } from "../MarketQuotationService";
import { investmentMonthlyBase, monthlyInvestmentHistory, monthlyWealthByType, summarizeInvestments, UNVALUED_AT_COST_BAND } from "../InvestmentAnalysisService";

const asset = (o: Partial<Asset> = {}): Asset => ({ id: "a", workspace_id: "w", name: "A", asset_type: AssetType.ACAO, ticker: "AAA3", institution: null, currency: "BRL", quantity: 0, unit_price: 0, current_value: 0, acquisition_value: 0, acquisition_date: null, is_active: true, notes: null, valuation_source: AssetValuationSource.MOVEMENTS, account_id: null, opening_value: 0, created_at: "", updated_at: "", deleted_at: null, ...o });
let n = 0;
const mv = (o: Partial<Movement> = {}): Movement => ({ id: `m${++n}`, workspace_id: "w", account_id: null, transfer_account_id: null, category_id: null, subcategory_id: null, card_id: null, asset_id: "a", import_id: null, transfer_group_id: null, type: MovementType.INVESTMENT, status: MovementStatus.CLEARED, description: "Compra", notes: null, amount: 100, transaction_date: "2026-01-05", competence_date: null, due_date: null, tags: ["op:APORTE"], attachments: [], created_at: "", updated_at: "", deleted_at: null, duplicate_hash: null, invoice_id: null, is_historical: true, quantity: 10, unit_price: 10, external_ref: null, ...o });
const px = (ticker: string, date: string, close: number): MarketPricePoint => ({ ticker, date, close, open: null, high: null, low: null, volume: null, provider: "test", fetchedAt: date });

describe("Rentabilidade por grupo com ativo sem custo", () => {
  it("ativo sem base de custo fica fora do cálculo e não apaga o grupo", () => {
    const assets = [asset(), asset({ id: "nu", name: "NU Holdings", ticker: "ROXO34" })];
    const movements = [mv(), mv({ asset_id: "nu", amount: 0, tags: ["op:AJUSTE_QUANTIDADE", "qty:INCREASE", "cost:INDETERMINATE"] })];
    const base = investmentMonthlyBase({ assets, movements, prices: { a: [px("AAA3", "2026-01-20", 12)], nu: [px("ROXO34", "2026-01-20", 50)] }, from: "2026-01-01", to: "2026-01-31" });
    const [point] = monthlyInvestmentHistory(base, "2026-01-01", "2026-01-31");
    expect(point?.returns.ACAO_BRL).toBe(20);
    expect(point?.returnCoverage?.ACAO_BRL).toMatchObject({ valued: 1, noCost: 1, noCostNames: ["NU Holdings"] });
    expect(point?.limitations.some((l) => l.assetId === "nu" && l.reason === "UNKNOWN_COST")).toBe(true);
  });
  it("grupo só com ativos sem custo continua sem rentabilidade", () => {
    const base = investmentMonthlyBase({ assets: [asset()], movements: [mv({ amount: 0, tags: ["op:AJUSTE_QUANTIDADE", "qty:INCREASE", "cost:INDETERMINATE"] })], prices: { a: [px("AAA3", "2026-01-20", 12)] }, from: "2026-01-01", to: "2026-01-31" });
    expect(monthlyInvestmentHistory(base, "2026-01-01", "2026-01-31")[0]?.returns.ACAO_BRL).toBeNull();
  });
});

describe("Valor patrimonial por tipo", () => {
  const assets = [
    asset(),
    asset({ id: "f", name: "FII", asset_type: AssetType.FII, ticker: "FFF11" }),
    asset({ id: "s", name: "Sem cotação", ticker: "SEM3" }),
    asset({ id: "t", name: "Tesouro", asset_type: AssetType.TESOURO, ticker: null }),
    asset({ id: "c", name: "Encerrado", ticker: "ENC3" }),
    asset({ id: "u", name: "Sem movimentos", asset_type: AssetType.FII, ticker: "UND11", quantity: 2, unit_price: 50, acquisition_value: 100, current_value: 100 }),
  ];
  const movements = [
    mv(), mv({ asset_id: "f", amount: 200, quantity: 2 }), mv({ asset_id: "s", amount: 300, quantity: 3 }),
    mv({ asset_id: "t", amount: 500, quantity: 1 }),
    mv({ asset_id: "c", amount: 100 }), mv({ asset_id: "c", amount: 150, transaction_date: "2026-02-10", tags: ["op:RESGATE"] }),
  ];
  const prices = { a: [px("AAA3", "2026-01-20", 12), px("AAA3", "2026-02-25", 15)], f: [px("FFF11", "2026-02-25", 110)], c: [px("ENC3", "2026-01-20", 11)], u: [px("UND11", "2026-02-25", 60)] };
  const base = investmentMonthlyBase({ assets, movements, prices, from: "2026-01-01", to: "2026-02-28" });
  const points = monthlyWealthByType(base, "2026-01-01", "2026-02-28");

  it("soma por tipo só valor comprovado; sem cotação vai à faixa a custo; renda fixa rotulada a custo", () => {
    expect(points[0]).toMatchObject({ values: { ACAO_BRL: 230, TESOURO_BRL: 500 }, unvaluedAtCost: 500, undatedCurrent: 0, total: 1230, excludedAssets: 3 });
    expect(points[0]?.origins.TESOURO_BRL).toEqual(["COST"]);
    expect(points[1]).toMatchObject({ values: { ACAO_BRL: 150, FII_BRL: 220, TESOURO_BRL: 500 }, unvaluedAtCost: 300, total: 1170, excludedAssets: 2 });
    expect(UNVALUED_AT_COST_BAND).toBe("__UNVALUED_AT_COST");
  });

  it("total do último mês bate com a Composição atual da aba Investimentos", () => {
    const today = "2026-02-28";
    const past = movements.filter((m) => m.transaction_date <= today);
    const quotes: MarketQuoteMap = {};
    for (const a of assets) {
      const last = (prices[a.id as keyof typeof prices] ?? []).filter((p) => p.date <= today).at(-1);
      if (a.ticker && last) quotes[a.ticker] = { status: "FOUND", ticker: a.ticker, message: null, quote: { ticker: a.ticker, price: last.close, currency: "BRL", quotedAt: `${last.date}T00:00:00Z`, change: null, changePercent: null, marketState: null, provider: "test" } };
    }
    const quoted = MarketQuotationServiceImpl.applyQuotes(AssetValuationServiceImpl.effectiveAssets(assets, past), quotes);
    const composition = summarizeInvestments(InvestmentServiceImpl.rows(quoted, past));
    const compositionTotal = Number(composition.reduce((s, g) => s + g.current, 0).toFixed(2));
    const currentValues = Object.fromEntries(InvestmentServiceImpl.rows(quoted, past).map((r) => [r.asset.id, r.current]));
    const withCurrent = monthlyWealthByType(base, "2026-01-01", today, currentValues);
    expect(withCurrent.at(-1)?.total).toBe(compositionTotal);
    expect(withCurrent.at(-1)?.undatedCurrent).toBe(120);
    expect(compositionTotal).toBe(1290);
    // Undated assets never enter past months.
    expect(withCurrent[0]?.undatedCurrent).toBe(0);
  });
});
