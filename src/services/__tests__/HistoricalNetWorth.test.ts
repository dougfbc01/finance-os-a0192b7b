// Patrimônio histórico: investimentos pelo valor do fim do mês e passivo pela situação na data.
import { describe, expect, it } from "vitest";
import { AssetType, AssetValuationSource, MovementStatus, MovementType } from "@/constants/enums";
import type { Asset, Movement } from "@/models";
import type { CardInvoice } from "@/models/CardInvoice";
import type { MarketPricePoint } from "@/models/MarketData";
import { DashboardServiceImpl } from "../DashboardService";
import { investmentMonthlyBase, monthEndInvestmentValues } from "../InvestmentAnalysisService";

const Dashboard = new DashboardServiceImpl();
const asset: Asset = { id: "a", workspace_id: "w", name: "A", asset_type: AssetType.ACAO, ticker: "AAA3", institution: null, currency: "BRL", quantity: 10, unit_price: 30, current_value: 300, acquisition_value: 100, acquisition_date: null, is_active: true, notes: null, valuation_source: AssetValuationSource.MOVEMENTS, account_id: null, opening_value: 0, created_at: "", updated_at: "", deleted_at: null };
const buy = { id: "m1", workspace_id: "w", account_id: null, transfer_account_id: null, category_id: null, subcategory_id: null, card_id: null, asset_id: "a", import_id: null, transfer_group_id: null, type: MovementType.INVESTMENT, status: MovementStatus.CLEARED, description: "Compra", notes: null, amount: 100, transaction_date: "2026-01-05", competence_date: null, due_date: null, tags: ["op:APORTE"], attachments: [], created_at: "", updated_at: "", deleted_at: null, duplicate_hash: null, invoice_id: null, is_historical: true, quantity: 10, unit_price: 10, external_ref: null } as Movement;
const px = (date: string, close: number): MarketPricePoint => ({ ticker: "AAA3", date, close, open: null, high: null, low: null, volume: null, provider: "t", fetchedAt: date });
const invoice = (o: Partial<CardInvoice>): CardInvoice => ({ id: "i", workspace_id: "w", card_id: "c", competence: "2026-01-01", closing_date: "2026-01-03", due_date: "2026-01-10", amount: 500, status: "PAID", paid_at: "2026-02-05", paid_movement_id: null, notes: null, created_at: "", updated_at: "", deleted_at: null, ...o });

describe("Patrimônio histórico", () => {
  it("investimento valorizado depois do mês entra pelo valor do fim do mês, não pelo de hoje", () => {
    const base = investmentMonthlyBase({ assets: [asset], movements: [buy], prices: { a: [px("2026-01-20", 12), px("2026-03-20", 30)] }, from: "2026-01-01", to: "2026-03-31" });
    const values = Object.fromEntries(Object.entries(monthEndInvestmentValues(base, "2026-03-31")).map(([k, v]) => [k, v.value]));
    const series = Dashboard.netWorthSeries({ accounts: [], movements: [buy], assets: [asset], invoices: [], months: ["2026-01", "2026-03"], investmentsByMonth: values, today: "2026-03-31" });
    expect(series[0].assets).toBe(120);
    expect(series[1].assets).toBe(300);
  });
  it("fatura paga depois do mês continua no passivo daquele mês", () => {
    const series = Dashboard.netWorthSeries({ accounts: [], movements: [], assets: [], invoices: [invoice({})], months: ["2026-01", "2026-02"], investmentsByMonth: {}, today: "2026-03-31" });
    expect(series[0].liabilities).toBe(500);
    expect(series[1].liabilities).toBe(0);
  });
  it("fatura com vencimento futuro não entra no passivo do mês", () => {
    expect(Dashboard.liabilitiesAt([invoice({ due_date: "2026-02-10", status: "OPEN", paid_at: null })], "2026-01-31")).toBe(0);
  });
});
