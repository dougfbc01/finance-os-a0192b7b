import { describe, expect, it } from "vitest";
import { AssetType } from "@/constants/enums";
import type { InvestmentRow } from "../InvestmentService";
import type { InvestmentHistoryPoint } from "../InvestmentAnalysisService";
import { historicalChartView, investmentHistoryDates, investmentPeriodStart, portfolioView, validInvestmentRange, type InvestmentSortKey } from "../InvestmentViewService";

const row = (id: string, name: string, type: AssetType, number: number): InvestmentRow => ({
  asset: { id, name, asset_type: type, ticker: id, institution: name, currency: "BRL", quantity: number, unit_price: number, quote: number > 0 ? { price: number } : null } as InvestmentRow["asset"],
  invested: number, current: number, profit: number, profitPercent: number, economicReturn: number > 0 ? number : null, accumulatedIncome: number,
});
const rows = [row("B3", "Beta", AssetType.ACAO, 20), row("A11", "Álpha", AssetType.FII, 10), row("C3", "Zero", AssetType.ACAO, 0)];
const point = (date: string, value: number | null, returns: Record<string, number | null>): InvestmentHistoryPoint => ({ date, value, returns, missingAssets: 0, limitations: [], carriedPrices: [] });

describe("Operações de apresentação dos investimentos", () => {
  it("mantém todas as datas do período inclusive em históricos com mais de 100 dias", () => {
    const dates = investmentHistoryDates("2026-01-01", "2026-05-01");
    expect(dates).toHaveLength(121);
    expect(dates[0]).toBe("2026-01-01");
    expect(dates.at(-1)).toBe("2026-05-01");
    expect(dates).toContain("2026-04-15");
    expect(investmentHistoryDates("2026-05-01", "2026-01-01")).toEqual([]);
  });
  it("combina busca por nome, tipo e ordenação sem mutar dados", () => {
    const before = JSON.stringify(rows);
    expect(portfolioView(rows, { search: "a", type: AssetType.ACAO, sortKey: "name", direction: "desc" }).map((r) => r.asset.id)).toEqual(["B3"]);
    expect(portfolioView(rows, { search: "alpha", type: "ALL", sortKey: null, direction: "asc" }).map((r) => r.asset.id)).toEqual(["A11"]);
    expect(JSON.stringify(rows)).toBe(before);
  });
  it("busca por ticker e retorna lista vazia sem correspondência", () => {
    expect(portfolioView(rows, { search: "b3", type: "ALL", sortKey: "quantity", direction: "asc" }).map((r) => r.asset.id)).toEqual(["B3"]);
    expect(portfolioView(rows, { search: "b3", type: AssetType.FII, sortKey: "quantity", direction: "asc" })).toEqual([]);
  });
  it("ordena ativo de A–Z e Z–A", () => {
    expect(portfolioView(rows, { search: "", type: "ALL", sortKey: "name", direction: "asc" }).map((r) => r.asset.id)).toEqual(["A11", "B3", "C3"]);
    expect(portfolioView(rows, { search: "", type: "ALL", sortKey: "name", direction: "desc" }).map((r) => r.asset.id)).toEqual(["C3", "B3", "A11"]);
  });
  it.each<InvestmentSortKey>(["quantity", "averagePrice", "quote", "invested", "current", "profitPercent", "economicReturn", "accumulatedIncome"])("ordena %s nos dois sentidos mantendo indisponíveis ao final", (sortKey) => {
    const input = rows.slice(0, 2);
    expect(portfolioView(input, { search: "", type: "ALL", sortKey, direction: "asc" }).map((r) => r.asset.id)).toEqual(["A11", "B3"]);
    expect(portfolioView(input, { search: "", type: "ALL", sortKey, direction: "desc" }).map((r) => r.asset.id)).toEqual(["B3", "A11"]);
  });
  it("cotação e retorno indisponíveis nunca viram zero na ordenação", () => {
    for (const sortKey of ["quote", "economicReturn"] as const) for (const direction of ["asc", "desc"] as const) {
      expect(portfolioView(rows, { search: "", type: "ALL", sortKey, direction }).at(-1)?.asset.id).toBe("C3");
    }
  });
  it("remove séries sem dados válidos, preserva lacunas e zero verdadeiro", () => {
    const chart = historicalChartView([point("2026-01-01", null, { A: null, B: 0, C: NaN }), point("2026-01-02", 100, { A: null, B: 5, C: Infinity })], ["A", "B", "C"]);
    expect(chart.returnKeys).toEqual(["B"]);
    expect(chart.hasValues).toBe(true);
    expect(chart.data[0]).toEqual({ date: "2026-01-01", value: null, A: null, B: 0, C: null });
  });
  it("não cria patrimônio nem rentabilidade quando tudo está indisponível", () => {
    expect(historicalChartView([point("2026-01-01", null, { A: null })], ["A"])).toMatchObject({ hasValues: false, returnKeys: [] });
  });
  it("respeita período e grupo recebidos sem incluir séries de outro grupo", () => {
    const chart = historicalChartView([point("2026-02-01", 100, { A: 5, B: 10 })], ["B"]);
    expect(chart.returnKeys).toEqual(["B"]);
    expect(chart.data).toEqual([{ date: "2026-02-01", value: 100, B: 10 }]);
  });
  it("identifica um ponto isolado válido sem preencher as lacunas", () => {
    const chart = historicalChartView([point("2026-01-01", null, { A: null }), point("2026-01-02", 100, { A: 20 }), point("2026-01-03", null, { A: null })], ["A"]);
    expect(chart.isolatedReturns).toEqual([{ key: "A", date: "2026-01-02" }]);
    expect(chart.data).toEqual([{ date: "2026-01-01", value: null, A: null }, { date: "2026-01-02", value: 100, A: 20 }, { date: "2026-01-03", value: null, A: null }]);
  });
  it("limita mês anterior ao último dia existente, inclusive ano bissexto", () => {
    expect(investmentPeriodStart("2026-03-31", 1)).toBe("2026-02-28");
    expect(investmentPeriodStart("2024-03-31", 1)).toBe("2024-02-29");
    expect(investmentPeriodStart("2026-10-14", 3)).toBe("2026-07-14");
  });
  it("rejeita período vazio, impossível, invertido ou futuro", () => {
    for (const [from, to] of [["", "2026-10-14"], ["2026-02-30", "2026-10-14"], ["2026-10-14", "2026-10-01"], ["2026-01-01", "2026-10-15"]]) expect(validInvestmentRange(from, to, "2026-10-14")).toBe(false);
    expect(validInvestmentRange("2026-01-01", "2026-10-14", "2026-10-14")).toBe(true);
  });
});