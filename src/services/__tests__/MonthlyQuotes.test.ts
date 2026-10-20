import { describe, it, expect } from "vitest";
import { firstSessionPerMonth } from "../MarketHistoricalPriceService";
import { investmentMonthlyDates } from "../InvestmentViewService";
const p = (date: string, close: number) => ({ ticker: "X", date, close, open: null, high: null, low: null, volume: null, provider: "t", fetchedAt: "" });
describe("cotações mensais", () => {
  it("guarda o primeiro pregão válido de cada mês", () => {
    const r = firstSessionPerMonth([p("2026-01-06", 11), p("2026-01-02", 10), p("2026-02-03", 0), p("2026-02-04", 12)]);
    expect(r.map((x) => [x.date, x.close])).toEqual([["2026-01-02", 10], ["2026-02-04", 12]]);
  });
  it("datas mensais em dia útil, sem datas futuras", () => {
    expect(investmentMonthlyDates("2025-11-15", "2026-02-10")).toEqual(["2025-12-01", "2026-01-01", "2026-02-02", "2026-02-10"]);
  });
});
