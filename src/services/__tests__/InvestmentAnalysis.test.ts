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
    expect(group).toMatchObject({ invested: 100, current: 120, economicReturn: 25, profitPercent: 20, participation: 100 });
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
});