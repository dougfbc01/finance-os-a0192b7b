import { describe, expect, it } from "vitest";
import { MovementStatus, MovementType } from "@/constants/enums";
import type { Account, Movement } from "@/models";
import { MonthlySummaryServiceImpl } from "../MonthlySummaryService";

const S = new MonthlySummaryServiceImpl();
const account = { id: "acc", workspace_id: "w", name: "C", initial_balance: 1000, is_active: true, deleted_at: null } as unknown as Account;
let n = 0;
const mv = (o: Partial<Movement>): Movement => ({ id: `m${++n}`, workspace_id: "w", account_id: "acc", transfer_account_id: null, category_id: "food", subcategory_id: null, card_id: null, invoice_id: null, asset_id: null, import_id: null, transfer_group_id: null, type: MovementType.EXPENSE, status: MovementStatus.CLEARED, description: "x", notes: null, amount: 50, transaction_date: "2026-03-10", competence_date: null, due_date: null, tags: [], attachments: [], created_at: "", updated_at: "", deleted_at: null, is_historical: false, ...o } as Movement);
const base = (movements: Movement[]) => ({ year: 2026, month: 3, accounts: [account], movements, assets: [], invoices: [], cards: [],
  categories: [{ id: "food", name: "Alimentação" }], investmentsByMonth: {}, budget: null, closing: null, stale: false, warnings: [], today: "2026-04-15" });

describe("Resumo do mês", () => {
  it("KPIs com variação vs mês anterior e taxa de poupança", () => {
    const s = S.build(base([mv({ type: MovementType.INCOME, amount: 1000 }), mv({ amount: 200 }), mv({ amount: 100, transaction_date: "2026-02-10" })]));
    const exp = s.kpis.find((k) => k.key === "expense")!;
    expect(exp.value).toBe(200);
    expect(exp.deltaPrevious).toBe(100);
    expect(s.kpis.find((k) => k.key === "savingsRate")!.value).toBe(80);
  });
  it("ponte do patrimônio fecha: início + resultado + valorização + outros + não explicado = fim", () => {
    const s = S.build(base([mv({ type: MovementType.INCOME, amount: 1000 }), mv({ amount: 200 })]));
    const b = s.bridge;
    expect(b.start + b.result + b.valuation + b.others + b.unexplained).toBeCloseTo(b.end);
    expect(b.end - b.start).toBe(800);
    expect(b.unexplained).toBe(0);
  });
  it("gasto incomum = 2× ticket médio da categoria nos 6 meses anteriores", () => {
    const hist = ["2026-01-05", "2026-01-20", "2026-02-05"].map((d) => mv({ transaction_date: d, amount: 60 }));
    const s = S.build(base([...hist, mv({ amount: 150, description: "Jantar" })]));
    expect(s.unusual.map((u) => u.description)).toEqual(["Jantar"]);
  });
  it("checklist: pendência impede 'pronto para fechar'", () => {
    const s = S.build({ ...base([]), warnings: [{ key: "uncategorized", label: "x", count: 3 }] });
    expect(s.ready).toBe(false);
    expect(s.checklist.find((c) => c.key === "uncategorized")).toMatchObject({ ok: false, count: 3 });
  });
});

import { lastMonthsGrid, monthsToBatchClose } from "../MonthlySummaryService";
import type { MonthlyClosing } from "@/models/MonthlyClosing";

describe("Grade de fechamentos", () => {
  it("12 meses até o atual; lote só pega meses encerrados e abertos", () => {
    const closed = { id: "c1", year: 2026, month: 2, status: "CLOSED", reopened_at: null } as unknown as MonthlyClosing;
    const grid = lastMonthsGrid([closed], new Set(), "2026-04-15");
    expect(grid).toHaveLength(12);
    expect(grid.at(-1)).toMatchObject({ key: "2026-04", status: "IN_PROGRESS" });
    expect(grid.find((g) => g.key === "2026-02")?.status).toBe("CLOSED");
    expect(lastMonthsGrid([closed], new Set(["c1"]), "2026-04-15").find((g) => g.key === "2026-02")?.status).toBe("STALE");
    const batch = monthsToBatchClose(grid).map((g) => g.key);
    expect(batch).not.toContain("2026-02");
    expect(batch).not.toContain("2026-04");
    expect(batch.at(-1)).toBe("2026-03");
  });
});
