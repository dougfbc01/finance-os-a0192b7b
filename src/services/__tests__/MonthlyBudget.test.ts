// Sprint 4.3.1 — testes do refinamento do Planejamento Mensal.
import { describe, expect, it } from "vitest";
import { MonthlyBudgetService } from "@/services/MonthlyBudgetService";
import { FinancialInsightsService } from "@/services/FinancialInsightsService";
import { MovementType, MovementStatus, CategoryType } from "@/constants/enums";
import type { Movement } from "@/models";
import type { MonthlyBudgetItem } from "@/models/MonthlyBudget";

const YEAR = 2026;
const MONTH = 7;

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

function item(partial: Partial<MonthlyBudgetItem>): MonthlyBudgetItem {
  return {
    id: "i",
    budget_id: "b",
    workspace_id: "ws",
    category_id: "cat-food",
    subcategory_id: null,
    planned_amount: 1000,
    goal_kind: null,
    notes: null,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    deleted_at: null,
    ...partial,
  };
}

const categories = [
  { id: "cat-food", name: "Alimentação", type: CategoryType.EXPENSE },
  { id: "cat-home", name: "Moradia", type: CategoryType.EXPENSE },
  { id: "cat-salary", name: "Salário", type: CategoryType.INCOME },
];

const subcategories = [
  { id: "sub-market", name: "Mercado", category_id: "cat-food" },
  { id: "sub-delivery", name: "Delivery", category_id: "cat-food" },
];

function advancedComparison() {
  return MonthlyBudgetService.compare({
    year: YEAR,
    month: MONTH,
    mode: "ADVANCED",
    budgetId: "b",
    items: [
      item({ id: "i1", subcategory_id: "sub-market", planned_amount: 800 }),
      item({ id: "i2", subcategory_id: "sub-delivery", planned_amount: 200 }),
      item({ id: "i3", category_id: "cat-home", planned_amount: 500 }),
      item({ id: "i4", category_id: "cat-salary", planned_amount: 5000 }),
    ],
    movements: [
      mov({ id: "m1", subcategory_id: "sub-market", amount: 600 }),
      mov({ id: "m2", subcategory_id: "sub-delivery", amount: 300 }),
      mov({
        id: "m3",
        category_id: "cat-salary",
        type: MovementType.INCOME,
        amount: 4000,
      }),
    ],
    categories,
    subcategories,
  });
}

describe("Sprint 4.3.1 — status e KPIs", () => {
  it("classifica o status pelas faixas 80% e 100%", () => {
    expect(MonthlyBudgetService.statusLevel(null)).toBe("OK");
    expect(MonthlyBudgetService.statusLevel(50)).toBe("OK");
    expect(MonthlyBudgetService.statusLevel(80)).toBe("WARNING");
    expect(MonthlyBudgetService.statusLevel(99.9)).toBe("WARNING");
    expect(MonthlyBudgetService.statusLevel(100)).toBe("WARNING");
    expect(MonthlyBudgetService.statusLevel(150)).toBe("OVER");
  });

  it("calcula dias, consumo médio diário e projeção", () => {
    const kpis = MonthlyBudgetService.kpis(
      { planned: 1000, actual: 310, difference: 690, percent: 31, remaining: 690 },
      { year: YEAR, month: MONTH, today: new Date(2026, 6, 10) },
    );
    expect(kpis.daysTotal).toBe(31);
    expect(kpis.daysElapsed).toBe(10);
    expect(kpis.daysRemaining).toBe(21);
    expect(kpis.dailyAverage).toBe(31);
    expect(kpis.projection).toBe(961);
    expect(kpis.projectionPercent).toBeCloseTo(96.1);
    expect(kpis.status).toBe("OK");
  });

  it("não projeta antes do início do período", () => {
    const kpis = MonthlyBudgetService.kpis(
      { planned: 1000, actual: 0, difference: 1000, percent: 0, remaining: 1000 },
      { year: YEAR, month: MONTH, today: new Date(2026, 5, 1) },
    );
    expect(kpis.daysElapsed).toBe(0);
    expect(kpis.projection).toBe(0);
  });
});

describe("Sprint 4.3.1 — resumo por categoria", () => {
  it("consolida categorias e mantém subcategorias como filhas", () => {
    const comparison = advancedComparison();
    const expenses = comparison.lines.filter((l) => l.kind === "EXPENSE");
    const groups = MonthlyBudgetService.groupByCategory(expenses);

    const food = groups.find((g) => g.categoryId === "cat-food");
    expect(food).toBeDefined();
    expect(food?.planned).toBe(1000);
    expect(food?.actual).toBe(900);
    expect(food?.difference).toBe(100);
    expect(food?.percent).toBe(90);
    expect(food?.remaining).toBe(100);
    expect(food?.status).toBe("WARNING");
    expect(food?.children.map((c) => c.subcategoryName).sort()).toEqual([
      "Delivery",
      "Mercado",
    ]);

    const home = groups.find((g) => g.categoryId === "cat-home");
    expect(home?.children).toHaveLength(0);
    expect(home?.status).toBe("OK");
  });

  it("ordena grupos conforme a chave de ordenação", () => {
    const comparison = advancedComparison();
    const expenses = comparison.lines.filter((l) => l.kind === "EXPENSE");
    expect(MonthlyBudgetService.groupByCategory(expenses, "SPENT")[0].categoryId).toBe(
      "cat-food",
    );
    expect(MonthlyBudgetService.groupByCategory(expenses, "PLANNED")[0].categoryId).toBe(
      "cat-food",
    );
  });

  it("expandir tudo e recolher tudo operam apenas em memória", () => {
    const comparison = advancedComparison();
    const groups = MonthlyBudgetService.groupByCategory(
      comparison.lines.filter((l) => l.kind === "EXPENSE"),
    );
    const expandAll = new Set(groups.map((g) => g.key));
    expect(expandAll.size).toBe(groups.length);
    const collapsed = new Set<string>();
    expect(collapsed.size).toBe(0);
    const toggled = new Set(collapsed);
    toggled.add(groups[0].key);
    expect(toggled.has(groups[0].key)).toBe(true);
  });
});

describe("Sprint 4.3.1 — receitas", () => {
  it("gera linhas de receita com as mesmas métricas das despesas", () => {
    const comparison = advancedComparison();
    const income = comparison.lines.filter((l) => l.kind === "INCOME");
    expect(income).toHaveLength(1);
    expect(income[0].planned).toBe(5000);
    expect(income[0].actual).toBe(4000);
    expect(income[0].difference).toBe(1000);
    expect(income[0].percent).toBe(80);
    expect(income[0].remaining).toBe(1000);

    const kpis = MonthlyBudgetService.kpis(comparison.summary.income, {
      year: YEAR,
      month: MONTH,
      today: new Date(2026, 6, 31),
    });
    expect(kpis.planned).toBe(5000);
    expect(kpis.actual).toBe(4000);
    expect(kpis.percent).toBe(80);
    expect(kpis.status).toBe("WARNING");
  });
});

describe("Sprint 4.3.1 — drill down", () => {
  it("monta deep link com categoria, subcategoria e período", () => {
    const link = MonthlyBudgetService.drillDown({
      year: YEAR,
      month: MONTH,
      categoryId: "cat-food",
      subcategoryId: "sub-market",
    });
    expect(link.to).toBe("/movimentacoes");
    expect(link.search).toEqual({
      category: "cat-food",
      subcategory: "sub-market",
      from: "2026-07-01",
      to: "2026-07-31",
    });
  });

  it("omite a subcategoria quando o drill down é por categoria", () => {
    const link = MonthlyBudgetService.drillDown({
      year: YEAR,
      month: MONTH,
      categoryId: "cat-home",
    });
    expect(link.search.subcategory).toBeUndefined();
    expect(link.search.category).toBe("cat-home");
  });
});

describe("Sprint 4.3.1 — insights de orçamento", () => {
  const comparison = advancedComparison();
  const insights = FinancialInsightsService.budgetInsights(comparison);

  it("detecta categorias sem utilização", () => {
    const unused = insights.find((i) => i.id === "budget:unused");
    expect(unused).toBeDefined();
    expect(unused?.quantity).toBe(1);
    expect(unused?.value).toBe(500);
  });

  it("aponta o maior excesso com deep link para o extrato", () => {
    const excess = insights.find((i) => i.id === "budget:excess");
    expect(excess).toBeDefined();
    expect(excess?.action_route).toBe("/movimentacoes");
    expect(excess?.action_filters.subcategory).toBe("sub-delivery");
    expect(excess?.action_filters.from).toBe("2026-07-01");
  });

  it("mantém os alertas de limite com deep link", () => {
    expect(insights.every((i) => i.action_route !== null)).toBe(true);
    expect(insights.some((i) => i.id.startsWith("budget:over:"))).toBe(true);
  });
});
