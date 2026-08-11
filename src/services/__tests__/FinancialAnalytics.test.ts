// Sprint 4.5 — testes da Inteligência Financeira (análise comportamental).
import { describe, expect, it } from "vitest";
import { FinancialAnalyticsService } from "@/services/FinancialAnalyticsService";
import { FinancialInsightsService } from "@/services/FinancialInsightsService";
import { MovementType, MovementStatus } from "@/constants/enums";
import type { Movement } from "@/models";

function mov(partial: Partial<Movement>): Movement {
  return {
    id: "m",
    workspace_id: "ws",
    account_id: "acc-1",
    transfer_account_id: null,
    category_id: "cat-food",
    subcategory_id: null,
    card_id: null,
    invoice_id: null,
    asset_id: null,
    import_id: null,
    transfer_group_id: null,
    type: MovementType.EXPENSE,
    status: MovementStatus.CLEARED,
    description: "x",
    notes: null,
    amount: 100,
    transaction_date: "2026-07-10",
    competence_date: "2026-07-10",
    due_date: null,
    tags: [],
    attachments: [],
    created_at: "2026-07-10T00:00:00Z",
    updated_at: "2026-07-10T00:00:00Z",
    deleted_at: null,
    ...partial,
  } as Movement;
}

const categories = [
  { id: "cat-food", name: "Alimentação" },
  { id: "cat-fun", name: "Lazer" },
];

const range = { start: "2026-07-01", end: "2026-07-31" };

function history(): Movement[] {
  const out: Movement[] = [];
  for (const month of ["04", "05", "06"]) {
    for (let i = 1; i <= 4; i++) {
      out.push(
        mov({
          id: `h-${month}-${i}`,
          amount: 100,
          transaction_date: `2026-${month}-0${i}`,
          competence_date: `2026-${month}-0${i}`,
        }),
      );
    }
  }
  return out;
}

describe("FinancialAnalyticsService", () => {
  it("usa até 6 meses de histórico e reporta a confiabilidade", () => {
    const report = FinancialAnalyticsService.analyze({
      range,
      movements: history(),
      categories,
    });
    expect(report.window.monthsAnalyzed).toBe(3);
    expect(report.window.confidence).toBe("NORMAL");
    expect(report.window.label).toContain("3");
  });

  it("marca confiabilidade baixa com pouco histórico", () => {
    const report = FinancialAnalyticsService.analyze({
      range,
      movements: [mov({ id: "h1", transaction_date: "2026-06-01", competence_date: "2026-06-01" })],
      categories,
    });
    expect(report.window.confidence).toBe("LOW");
  });

  it("detecta categoria em crescimento frente à média histórica", () => {
    const movements = [
      ...history(),
      mov({ id: "c1", amount: 800, competence_date: "2026-07-05", transaction_date: "2026-07-05" }),
    ];
    const report = FinancialAnalyticsService.analyze({ range, movements, categories });
    const trend = report.trends.find((t) => t.categoryId === "cat-food");
    expect(trend?.average).toBe(400);
    expect(trend?.current).toBe(800);
    expect(trend?.direction).toBe("UP");
    expect(report.growing.map((t) => t.categoryId)).toContain("cat-food");
  });

  it("detecta categoria em redução", () => {
    const movements = [
      ...history(),
      mov({ id: "c1", amount: 100, competence_date: "2026-07-05", transaction_date: "2026-07-05" }),
    ];
    const report = FinancialAnalyticsService.analyze({ range, movements, categories });
    expect(report.decreasing.map((t) => t.categoryId)).toContain("cat-food");
  });

  it("identifica lançamento atípico dentro da categoria", () => {
    const movements = [
      ...history(),
      mov({
        id: "big",
        amount: 900,
        description: "Compra atípica",
        competence_date: "2026-07-05",
        transaction_date: "2026-07-05",
      }),
    ];
    const report = FinancialAnalyticsService.analyze({ range, movements, categories });
    expect(report.outliers[0]?.movementId).toBe("big");
    expect(report.outliers[0]?.times).toBeGreaterThanOrEqual(3);
  });

  it("calcula concentração de gastos do período", () => {
    const movements = [
      ...history(),
      mov({ id: "a", amount: 900, competence_date: "2026-07-05", transaction_date: "2026-07-05" }),
      mov({
        id: "b",
        amount: 100,
        category_id: "cat-fun",
        competence_date: "2026-07-06",
        transaction_date: "2026-07-06",
      }),
    ];
    const report = FinancialAnalyticsService.analyze({ range, movements, categories });
    expect(report.concentration[0]?.categoryId).toBe("cat-food");
    expect(Math.round(report.concentration[0]?.percent ?? 0)).toBe(90);
  });

  it("compara com o mesmo mês do ano anterior quando há dados", () => {
    const movements = [
      ...history(),
      mov({ id: "old", amount: 500, competence_date: "2025-07-10", transaction_date: "2025-07-10" }),
      mov({ id: "new", amount: 1000, competence_date: "2026-07-10", transaction_date: "2026-07-10" }),
    ];
    const report = FinancialAnalyticsService.analyze({ range, movements, categories });
    expect(report.seasonality?.reference).toBe(500);
    expect(report.seasonality?.variationPercent).toBe(100);
  });

  it("não gera insights comportamentais sem histórico", () => {
    const report = FinancialAnalyticsService.analyze({
      range,
      movements: [mov({ id: "only", competence_date: "2026-07-02", transaction_date: "2026-07-02" })],
      categories,
    });
    expect(report.window.monthsAnalyzed).toBe(0);
    expect(FinancialInsightsService.behaviorInsights(report)).toHaveLength(0);
    expect(FinancialInsightsService.behaviorSummary(report)[0]).toContain("Sem histórico");
  });

  it("traduz o relatório em insights acionáveis", () => {
    const movements = [
      ...history(),
      mov({ id: "c1", amount: 900, competence_date: "2026-07-05", transaction_date: "2026-07-05" }),
    ];
    const report = FinancialAnalyticsService.analyze({ range, movements, categories });
    const insights = FinancialInsightsService.behaviorInsights(report);
    expect(insights.length).toBeGreaterThan(0);
    expect(insights.some((i) => i.type === "CATEGORY_TREND")).toBe(true);
    expect(insights.every((i) => i.source === "ANALYTICS")).toBe(true);
    const summary = FinancialInsightsService.behaviorSummary(report);
    expect(summary[0]).toContain("Análise baseada em 3");
  });
});
