import { describe, expect, it } from "vitest";
import { MonthlyClosingServiceImpl } from "@/services/MonthlyClosingService";
import { MovementType, MovementStatus } from "@/constants/enums";
import type { Movement, Account } from "@/models";
import type { ClosingHealth, MonthlyClosing } from "@/models/MonthlyClosing";

const Service = new MonthlyClosingServiceImpl();

const account: Account = {
  id: "acc-1",
  workspace_id: "ws",
  name: "Conta",
  institution: null,
  account_type: "CHECKING",
  currency: "BRL",
  initial_balance: 1000,
  color: "#000",
  icon: "wallet",
  display_order: 0,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
} as unknown as Account;

function mov(partial: Partial<Movement>): Movement {
  return {
    id: "m",
    workspace_id: "ws",
    account_id: "acc-1",
    transfer_account_id: null,
    category_id: "cat-1",
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

const health: ClosingHealth = { issues: 0, checkedAt: null, items: [] };

function baseParams(year: number, month: number, movements: Movement[]) {
  return {
    year,
    month,
    accounts: [account],
    movements,
    assets: [],
    invoices: [],
    cards: [],
    categories: [{ id: "cat-1", name: "Alimentação" }],
    subcategories: [],
    importsCount: 2,
    duplicatesCount: 0,
    ruleConflicts: 0,
    ruleDuplicates: 0,
    insights: [],
    insightsSummary: { critical: 0, warning: 0, info: 0, total: 0 },
    health,
  };
}

describe("MonthlyClosingService", () => {
  it("gera snapshot íntegro do mês (fechamento simples)", () => {
    const movements = [
      mov({ id: "a", type: MovementType.INCOME, amount: 5000, competence_date: "2026-07-05" }),
      mov({ id: "b", amount: 1200, competence_date: "2026-07-12" }),
      mov({ id: "c", amount: 999, competence_date: "2026-06-12" }), // fora do período
    ];
    const snap = Service.buildSnapshot(baseParams(2026, 7, movements));

    expect(snap.version).toBe(1);
    expect(snap.period).toMatchObject({ year: 2026, month: 7, start: "2026-07-01", end: "2026-07-31" });
    expect(snap.totals.income).toBe(5000);
    expect(snap.totals.expense).toBe(1200);
    expect(snap.totals.result).toBe(3800);
    expect(snap.quality.movements).toBe(2);
    expect(snap.quality.imports).toBe(2);
    expect(snap.byAccount[0]?.label).toBe("Conta");
    expect(snap.byCategory.expense[0]?.label).toBe("Alimentação");
  });

  it("conta lançamentos sem categoria, transferências e aportes", () => {
    const movements = [
      mov({ id: "a", category_id: null, amount: 300 }),
      mov({ id: "b", type: MovementType.TRANSFER, amount: 700, category_id: null }),
      mov({ id: "c", type: MovementType.INVESTMENT, amount: 500 }),
    ];
    const snap = Service.buildSnapshot(baseParams(2026, 7, movements));
    expect(snap.quality.uncategorized).toBe(2); // despesa sem categoria + investimento? não
    expect(snap.transfers).toEqual({ count: 1, amount: 700 });
    expect(snap.investments.contributions).toBe(500);
  });

  it("emite avisos sem bloquear o fechamento", () => {
    const params = {
      ...baseParams(2026, 7, [mov({ category_id: null })]),
      duplicatesCount: 3,
      ruleConflicts: 1,
      ruleDuplicates: 2,
      health: { issues: 4, checkedAt: "2026-08-01T00:00:00Z", items: [] },
    };
    const snap = Service.buildSnapshot(params);
    const warnings = Service.validate(snap);
    const keys = warnings.map((w) => w.key);
    expect(keys).toContain("duplicates");
    expect(keys).toContain("uncategorized");
    expect(keys).toContain("ruleConflicts");
    expect(keys).toContain("ruleDuplicates");
    expect(keys).toContain("health");
  });

  it("incorpora Health Check e Insights no snapshot", () => {
    const params = {
      ...baseParams(2026, 7, []),
      health: {
        issues: 2,
        checkedAt: "2026-08-01T00:00:00Z",
        items: [{ key: "invoices_orfas", label: "Faturas órfãs", count: 2, ok: false }],
      },
      insights: [
        {
          id: "i1",
          type: "DUPLICATES",
          severity: "WARNING",
          title: "Duplicidades",
          description: "x",
          source: "DEDUP",
          related_entity: "none",
          related_entity_id: null,
          quantity: 1,
          value: 0,
          recommended_action: "NONE",
          action_label: null,
          action_route: null,
          action_filters: {},
          dismissible: true,
          created_at: "2026-08-01T00:00:00Z",
          resolved: false,
          priority: 10,
          details: [],
          signature: "sig",
        },
      ],
      insightsSummary: { critical: 0, warning: 1, info: 0, total: 1 },
    } as Parameters<typeof Service.buildSnapshot>[0];

    const snap = Service.buildSnapshot(params);
    expect(snap.health.issues).toBe(2);
    expect(snap.health.items).toHaveLength(1);
    expect(snap.insights).toHaveLength(1);
    expect(snap.insights_summary.warning).toBe(1);
  });

  it("compara dois fechamentos", () => {
    const july = Service.buildSnapshot(
      baseParams(2026, 7, [mov({ type: MovementType.INCOME, amount: 4000 })]),
    );
    const august = Service.buildSnapshot(
      baseParams(2026, 8, [
        mov({ type: MovementType.INCOME, amount: 5000, competence_date: "2026-08-05" }),
      ]),
    );
    const cmp = Service.compareClosing(
      { year: 2026, month: 8, snapshot_json: august } as MonthlyClosing,
      { year: 2026, month: 7, snapshot_json: july } as MonthlyClosing,
    );
    const income = cmp.rows.find((r) => r.key === "income");
    expect(income?.delta).toBe(1000);
    expect(income?.percent).toBeCloseTo(25);
    expect(cmp.rows.find((r) => r.key === "expense")?.percent).toBeNull();
  });

  it("detecta fechamento desatualizado após alteração de movimentação", () => {
    const closing = {
      id: "c1",
      year: 2026,
      month: 7,
      closed_at: "2026-08-01T10:00:00Z",
    } as MonthlyClosing;

    const untouched = [mov({ updated_at: "2026-07-20T10:00:00Z" })];
    const touched = [mov({ updated_at: "2026-08-02T10:00:00Z" })];
    const otherMonth = [
      mov({ competence_date: "2026-06-10", updated_at: "2026-08-02T10:00:00Z" }),
    ];

    expect(Service.isStale(closing, untouched)).toBe(false);
    expect(Service.isStale(closing, touched)).toBe(true);
    expect(Service.isStale(closing, otherMonth)).toBe(false);
    expect(Service.isStale({ ...closing, closed_at: null }, touched)).toBe(false);
  });
});
