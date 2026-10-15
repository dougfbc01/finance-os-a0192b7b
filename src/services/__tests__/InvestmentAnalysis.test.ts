import { describe, it, expect } from "vitest";
import { AssetType, AssetValuationSource, MovementType, MovementStatus } from "@/constants/enums";
import type { Asset, Movement } from "@/models";
import type { MarketPricePoint } from "@/models/MarketData";
import { investmentHistory, summarizeInvestments } from "../InvestmentAnalysisService";
import { AssetValuationServiceImpl } from "../AssetValuationService";
import { MarketQuotationServiceImpl } from "../MarketQuotationService";
import { InvestmentServiceImpl } from "../InvestmentService";

const asset = (overrides: Partial<Asset> = {}): Asset => ({ id: "a", workspace_id: "w", name: "Ação", asset_type: AssetType.ACAO, ticker: "TEST3", institution: null, currency: "BRL", quantity: 0, unit_price: 0, current_value: 0, acquisition_value: 0, acquisition_date: null, is_active: true, notes: null, valuation_source: AssetValuationSource.MOVEMENTS, account_id: null, opening_value: 0, created_at: "2026-01-01", updated_at: "2026-01-01", deleted_at: null, ...overrides });
const movement = (overrides: Partial<Movement> = {}): Movement => ({ id: "m", workspace_id: "w", account_id: null, transfer_account_id: null, category_id: null, subcategory_id: null, card_id: null, asset_id: "a", import_id: null, transfer_group_id: null, type: MovementType.INVESTMENT, status: MovementStatus.CLEARED, description: "Compra", notes: null, amount: 100, transaction_date: "2026-01-01", competence_date: null, due_date: null, tags: ["op:APORTE", "source:B3"], attachments: [], created_at: "2026-01-01", updated_at: "2026-01-01", deleted_at: null, duplicate_hash: null, invoice_id: null, is_historical: true, quantity: 10, unit_price: 10, external_ref: null, ...overrides });
const price = (date: string, close: number): MarketPricePoint => ({ ticker: "TEST3", date, close, open: null, high: null, low: null, volume: null, provider: "test", fetchedAt: date });

describe("Análise de investimentos reutiliza regras existentes", () => {
  it("agrupa por tipo e soma valores e retorno econômico sem duplicar rendimento conciliado", () => {
    const movements = [movement(), movement({ id: "yield", type: MovementType.DIVIDEND, tags: ["source:B3", "b3:event:DIVIDEND", "op:RENDIMENTO"], amount: 5, quantity: null, account_id: "bank" })];
    const projected = MarketQuotationServiceImpl.applyQuotes(AssetValuationServiceImpl.effectiveAssets([asset()], movements), { TEST3: { status: "FOUND", ticker: "TEST3", message: null, quote: { ticker: "TEST3", price: 12, currency: "BRL", quotedAt: null, change: null, changePercent: null, marketState: null, provider: "test" } } });
    const rows = InvestmentServiceImpl.rows(projected, movements);
    const group = summarizeInvestments(rows)[0];
    expect(group).toMatchObject({ invested: 100, current: 120, economicReturn: 25, accumulatedIncome: 5, profitPercent: 20, participation: 100 });
    expect(group?.economicReturn).toBe(rows[0]?.economicReturn);
  });
  it("participação considera valor atual de cada grupo", () => {
    const rows = InvestmentServiceImpl.rows([asset({ current_value: 120, acquisition_value: 100 }), asset({ id: "b", asset_type: AssetType.FII, current_value: 80, acquisition_value: 80 })]);
    expect(summarizeInvestments(rows).map((g) => g.participation)).toEqual([60, 40]);
  });
  it("não soma moedas diferentes", () => {
    const rows = InvestmentServiceImpl.rows([asset({ current_value: 120 }), asset({ id: "b", currency: "USD", current_value: 80 })]);
    expect(summarizeInvestments(rows).map((g) => g.participation)).toEqual([100, 100]);
  });
  it("reconstrói posição e rentabilidade com movimentos até a data e preço anterior", () => {
    const points = investmentHistory({ assets: [asset()], movements: [movement(), movement({ id: "later", transaction_date: "2026-03-01" })], prices: { a: [price("2026-01-10", 12), price("2026-03-01", 99)] }, dates: ["2026-02-01"] });
    expect(points[0]?.value).toBe(120);
    expect(points[0]?.returns.ACAO_BRL).toBe(20);
  });
  it("preço futuro e avaliação manual atual não preenchem lacunas históricas", () => {
    const points = investmentHistory({ assets: [asset()], movements: [movement()], prices: { a: [price("2026-03-01", 12)] }, dates: ["2026-02-01"] });
    expect(points[0]).toMatchObject({ value: null, missingAssets: 1 });
    expect(points[0]?.returns.ACAO_BRL).toBeNull();
    const manual = investmentHistory({ assets: [asset({ valuation_source: AssetValuationSource.MANUAL, current_value: 900 })], movements: [], prices: {}, dates: ["2026-02-01"] });
    expect(manual[0]?.value).toBeNull();
  });
  it("não muta ativos, cotações ou movimentos", () => {
    const input = { assets: [asset()], movements: [movement()], prices: { a: [price("2026-01-10", 12)] }, dates: ["2026-02-01"] };
    const before = JSON.stringify(input);
    investmentHistory(input);
    expect(JSON.stringify(input)).toBe(before);
  });
  it("capital zero não inventa percentual", () => {
    const points = investmentHistory({ assets: [asset()], movements: [movement({ amount: 0, tags: ["op:AJUSTE_QUANTIDADE", "qty:INCREASE"] })], prices: { a: [price("2026-01-10", 12)] }, dates: ["2026-02-01"] });
    expect(points[0]?.returns.ACAO_BRL).toBeNull();
  });
  it("posição vendida e posição futura não reaparecem pelas quantidades atuais do cadastro", () => {
    const points = investmentHistory({ assets: [asset({ quantity: 10, current_value: 120 })], movements: [movement(), movement({ id: "sale", transaction_date: "2026-02-01", tags: ["op:RESGATE"], amount: 120 })], prices: { a: [price("2026-01-10", 12)] }, dates: ["2025-12-01", "2026-03-01"] });
    expect(points.map((p) => p.value)).toEqual([0, 0]);
  });
  it("identifica o ativo sem preço sem inventar valor histórico", () => {
    const points = investmentHistory({ assets: [asset()], movements: [movement()], prices: {}, dates: ["2026-02-01"] });
    expect(points[0]?.limitations).toEqual([{ assetId: "a", name: "Ação", reason: "NO_PRICE" }]);
    expect(points[0]?.value).toBeNull();
  });
  it("não transforma saldo de abertura ou avaliação manual em aquisição histórica", () => {
    const points = investmentHistory({ assets: [asset({ opening_value: 500 })], movements: [], prices: {}, dates: ["2026-02-01"] });
    expect(points[0]?.value).toBeNull();
    expect(points[0]?.limitations[0]?.reason).toBe("NO_HISTORY");
  });
  it("preserva o último preço anterior e identifica sua data sem interpolação", () => {
    const points = investmentHistory({ assets: [asset()], movements: [movement()], prices: { a: [price("2026-01-10", 12), price("2026-03-01", 99)] }, dates: ["2026-02-01"] });
    expect(points[0]?.value).toBe(120);
    expect(points[0]?.carriedPrices).toEqual([{ assetId: "a", priceDate: "2026-01-10" }]);
  });
  it("mantém valor cotado mas não inventa rentabilidade com custo indeterminado", () => {
    const points = investmentHistory({ assets: [asset()], movements: [movement({ amount: 0, tags: ["op:AJUSTE_QUANTIDADE", "qty:INCREASE", "cost:INDETERMINATE"] })], prices: { a: [price("2026-01-10", 12)] }, dates: ["2026-02-01"] });
    expect(points[0]?.value).toBe(120);
    expect(points[0]?.returns.ACAO_BRL).toBeNull();
    expect(points[0]?.limitations[0]?.reason).toBe("UNKNOWN_COST");
  });
  it("lacuna em um grupo não apaga rentabilidade conhecida de outro", () => {
    const points = investmentHistory({ assets: [asset(), asset({ id: "b", asset_type: AssetType.FII, ticker: "FII11" })], movements: [movement(), movement({ id: "b-buy", asset_id: "b" })], prices: { a: [price("2026-01-10", 12)] }, dates: ["2026-02-01"] });
    expect(points[0]?.value).toBeNull();
    expect(points[0]?.returns.ACAO_BRL).toBe(20);
    expect(points[0]?.returns.FII_BRL).toBeNull();
  });
  it.each([AssetType.TESOURO, AssetType.POUPANCA])("não usa o custo de %s como avaliação histórica zerada", (asset_type) => {
    const points = investmentHistory({ assets: [asset({ asset_type, ticker: null })], movements: [movement()], prices: {}, dates: ["2026-02-01", "2026-03-01"] });
    expect(points.map((p) => p.returns[`${asset_type}_BRL`])).toEqual([null, null]);
    expect(points[0]?.limitations[0]?.reason).toBe("NO_VALUATION");
    expect(points[0]?.value).toBeNull();
  });
  it("custo zero de um ativo não pode inventar rentabilidade para seu grupo", () => {
    const points = investmentHistory({ assets: [asset(), asset({ id: "b", ticker: "ZERO3" })], movements: [movement(), movement({ id: "b", asset_id: "b", amount: 0, tags: ["op:AJUSTE_QUANTIDADE", "qty:INCREASE"] })], prices: { a: [price("2026-01-10", 12)], b: [price("2026-01-10", 10)] }, dates: ["2026-02-01"] });
    expect(points[0]?.returns.ACAO_BRL).toBeNull();
    expect(points[0]?.value).toBe(220);
  });
  it("soma proventos por tipo e moeda sem alterar retorno econômico", () => {
    const input = InvestmentServiceImpl.rows([asset(), asset({ id: "b", asset_type: AssetType.FII }), asset({ id: "usd", currency: "USD" })], [movement({ amount: 5, tags: ["op:RENDIMENTO"] }), movement({ id: "fii", asset_id: "b", amount: 7, tags: ["op:RENDIMENTO"] }), movement({ id: "usd", asset_id: "usd", amount: 3, tags: ["op:RENDIMENTO"] })]);
    expect(summarizeInvestments(input).map((g) => [g.key, g.accumulatedIncome]).sort()).toEqual([["ACAO_BRL", 5], ["ACAO_USD", 3], ["FII_BRL", 7]]);
  });
});