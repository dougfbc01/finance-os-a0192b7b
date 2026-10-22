import { describe, it, expect } from "vitest";
import { AssetType, AssetValuationSource, MovementType, MovementStatus } from "@/constants/enums";
import type { Asset, Movement } from "@/models";
import type { MarketPricePoint } from "@/models/MarketData";
import { investmentMonthlyBase, monthlyInvestmentHistory } from "../InvestmentAnalysisService";
import { wealthChartView } from "../InvestmentViewService";

const asset: Asset = { id: "a", workspace_id: "w", name: "A", asset_type: AssetType.ACAO, ticker: "TEST3", institution: null, currency: "BRL", quantity: 100, unit_price: 10, current_value: 1000, acquisition_value: 1000, acquisition_date: null, is_active: true, notes: null, valuation_source: AssetValuationSource.MOVEMENTS, account_id: null, opening_value: 0, created_at: "", updated_at: "", deleted_at: null };
const movement = (override: Partial<Movement> = {}): Movement => ({ id: "buy", workspace_id: "w", account_id: null, transfer_account_id: null, category_id: null, subcategory_id: null, card_id: null, asset_id: "a", import_id: null, transfer_group_id: null, type: MovementType.INVESTMENT, status: MovementStatus.CLEARED, description: "Compra", notes: null, amount: 100, transaction_date: "2026-01-02", competence_date: null, due_date: null, tags: ["op:APORTE"], attachments: [], created_at: "", updated_at: "", deleted_at: null, duplicate_hash: null, invoice_id: null, is_historical: true, quantity: 10, unit_price: 10, external_ref: null, ...override });
const price = (date: string, close: number): MarketPricePoint => ({ ticker: "TEST3", date, close, open: null, high: null, low: null, volume: null, provider: "test", fetchedAt: date });
const base = (movements = [movement()], prices = [price("2026-01-02", 12)], to = "2026-03-20") => investmentMonthlyBase({ assets: [asset], movements, prices: { a: prices }, from: "2026-01-01", to });

describe("Base mensal histórica somente leitura", () => {
  it("cria uma linha por ativo/mês desde a primeira movimentação no primeiro pregão disponível", () => {
    const rows = base([movement({ transaction_date: "2026-01-15" })], [price("2026-01-05", 12), price("2026-01-20", 15), price("2026-02-03", 13)]);
    expect(rows.map((r) => [r.month, r.referenceDate, r.quantity])).toEqual([["2026-01", "2026-01-05", 0], ["2026-02", "2026-02-03", 10], ["2026-03", "2026-03-02", 10]]);
  });
  it("carrega cotação anterior com data real e status desatualizado", () => {
    expect(base()[1]).toMatchObject({ referenceDate: "2026-02-02", quantity: 10, unitQuote: 12, quoteDate: "2026-01-02", totalValue: 120, status: "STALE_PRICE" });
  });
  it("sem cotação anterior mantém valor indisponível, nunca usa preço futuro", () => {
    const rows = base([movement({ transaction_date: "2026-01-01" })], [price("2026-03-02", 20), price("2026-04-01", 99)]);
    expect(rows[0]).toMatchObject({ totalValue: null, unitQuote: null, quoteDate: null, status: "NO_PRICE" });
    expect(rows[1]?.totalValue).toBeNull();
    expect(rows[2]?.totalValue).toBe(200);
    expect(rows).toHaveLength(3);
  });
  it("reconstrói eventos acumulados e mantém zero após encerramento sem cotação", () => {
    const rows = base([movement({ transaction_date: "2026-01-01" }), movement({ id: "split", transaction_date: "2026-01-15", quantity: 10, amount: 0, tags: ["op:AJUSTE_QUANTIDADE", "qty:INCREASE"] }), movement({ id: "sale", transaction_date: "2026-02-10", quantity: 20, amount: 250, tags: ["op:RESGATE"] }), movement({ id: "future", transaction_date: "2026-04-02", quantity: 200 })], []);
    expect(rows.map((r) => r.quantity)).toEqual([10, 20, 0]);
    expect(rows[2]).toMatchObject({ totalValue: 0, status: "CLOSED" });
  });
  it("não infere quantidade ou preço pelo custo quando falta histórico", () => {
    expect(base([movement({ quantity: null })])[0]).toMatchObject({ quantity: null, totalValue: null, status: "NO_HISTORY" });
    expect(base([])[0]).toMatchObject({ quantity: null, totalValue: null, status: "NO_HISTORY" });
  });
  it("gráficos usam os valores da base, separam parcial e preservam a rentabilidade existente", () => {
    const rows = investmentMonthlyBase({ assets: [asset, { ...asset, id: "b", asset_type: AssetType.FII }], movements: [movement(), movement({ id: "b", asset_id: "b", transaction_date: "2026-01-01" })], prices: { a: [price("2026-01-02", 12)] }, from: "2026-01-01", to: "2026-02-20" });
    const points = monthlyInvestmentHistory(rows, "2026-01-01", "2026-02-20");
    expect(points[0]).toMatchObject({ value: null, calculableValue: 120, valuesByGroup: { ACAO_BRL: 120, FII_BRL: null }, returns: { ACAO_BRL: 20, FII_BRL: null } });
    expect(points[0]?.calculableValue).toBe(rows.filter((r) => r.month === "2026-01").reduce((s, r) => s + (r.totalValue ?? 0), 0));
  });
  it("não substitui cotação válida por zero/erro nem muda dados de entrada", () => {
    const input = { assets: [asset], movements: [movement()], prices: { a: [price("2026-01-02", 12), price("2026-02-02", 0), price("2026-02-03", NaN)] }, from: "2026-01-01", to: "2026-03-20" };
    const before = structuredClone(input);
    const rows = investmentMonthlyBase(input);
    expect(rows[1]).toMatchObject({ unitQuote: 12, quoteDate: "2026-01-02", status: "STALE_PRICE" });
    expect(input).toEqual(before);
  });
  it("não consolida moedas diferentes", () => {
    const rows = investmentMonthlyBase({ assets: [asset, { ...asset, id: "b", currency: "USD" }], movements: [movement(), movement({ id: "b", asset_id: "b" })], prices: { a: [price("2026-01-02", 12)], b: [price("2026-01-02", 13)] }, from: "2026-01-01", to: "2026-01-20" });
    expect(monthlyInvestmentHistory(rows, "2026-01-01", "2026-01-20")[0]).toMatchObject({ value: null, calculableValue: null, valuesByGroup: { ACAO_BRL: 120, ACAO_USD: 130 } });
  });
  it("o consolidado não antecede nenhuma das referências ou cotações individuais", () => {
    const rows = investmentMonthlyBase({ assets: [asset, { ...asset, id: "b" }], movements: [movement(), movement({ id: "b", asset_id: "b" })], prices: { a: [price("2026-01-02", 12)], b: [price("2026-01-05", 13)] }, from: "2026-01-01", to: "2026-01-20" });
    const point = monthlyInvestmentHistory(rows, "2026-01-01", "2026-01-20")[0];
    expect(point).toMatchObject({ date: "2026-01-05", value: 250 });
    expect(rows.every((r) => r.referenceDate <= (point?.date ?? "") && (r.quoteDate ?? "") <= (point?.date ?? ""))).toBe(true);
  });
  it("identifica entrada tardia de cotação sem alterar os valores parciais de 1 mil e 11 mil", () => {
    const rows = investmentMonthlyBase({ assets: [asset, { ...asset, id: "b", ticker: "LATE3" }, { ...asset, id: "missing" }],
      movements: [movement({ transaction_date: "2026-01-01" }), movement({ id: "b", asset_id: "b", transaction_date: "2026-01-01" }), movement({ id: "missing", asset_id: "missing", transaction_date: "2026-01-01" })],
      prices: { a: [price("2026-01-02", 100)], b: [price("2026-02-02", 1000)] }, from: "2026-01-01", to: "2026-02-20" });
    const before = structuredClone(rows);
    const points = monthlyInvestmentHistory(rows, "2026-01-01", "2026-02-20");
    const view = wealthChartView(points, "TOTAL", rows);
    expect(view.data.map((r) => [r.complete, r.calculable])).toEqual([[null, 1000], [null, 11000]]);
    expect(view.coverageChanges).toEqual([{ date: "2026-02-02", added: ["LATE3"], removed: [] }]);
    expect(view.data.map((r) => r.valuedAssets)).toEqual([1, 2]);
    expect(rows).toEqual(before);
  });
  it("não classifica compra nova, encerramento ou cotação carregada como mudança de cobertura", () => {
    const rows = investmentMonthlyBase({ assets: [asset, { ...asset, id: "b" }],
      movements: [movement({ transaction_date: "2026-01-01" }), movement({ id: "sale", transaction_date: "2026-02-01", tags: ["op:RESGATE"] }), movement({ id: "b", asset_id: "b", transaction_date: "2026-02-01" })],
      prices: { a: [price("2026-01-02", 12)], b: [price("2026-02-02", 15)] }, from: "2026-01-01", to: "2026-03-20" });
    const view = wealthChartView(monthlyInvestmentHistory(rows, "2026-01-01", "2026-03-20"), "TOTAL", rows);
    expect(view.coverageChanges).toEqual([]);
    expect(view.data.map((r) => r.complete)).toEqual([120, 150, 150]);
    expect(view.data[2]?.staleNames).toEqual(["TEST3"]);
  });
  it("acompanha identidades mesmo com igual número de faltas e respeita o grupo", () => {
    const rows = base().filter((r) => r.month !== "2026-03");
    const unavailable = rows.map((r) => ({ ...r, assetId: "b", ticker: "B11", group: "FII_BRL", totalValue: null, status: "NO_PRICE" as const }));
    rows[1] = { ...rows[1], totalValue: null, status: "NO_PRICE" };
    const second = unavailable[1];
    if (!second) throw new Error("Missing fixture month");
    unavailable[1] = { ...second, totalValue: 120 };
    const ledger = [...rows, ...unavailable];
    const points = [{ date: "2026-01-02", value: null, calculableValue: 120, missingAssets: 1, returns: {}, limitations: [], carriedPrices: [] },
      { date: "2026-02-02", value: null, calculableValue: 120, missingAssets: 1, returns: {}, limitations: [], carriedPrices: [] }];
    expect(wealthChartView(points, "TOTAL", ledger).coverageChanges).toEqual([{ date: "2026-02-02", added: ["B11"], removed: ["TEST3"] }]);
    expect(wealthChartView(points, "FII_BRL", ledger).coverageChanges).toEqual([{ date: "2026-02-02", added: ["B11"], removed: [] }]);
  });
});