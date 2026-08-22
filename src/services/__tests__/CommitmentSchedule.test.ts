import { describe, expect, it } from "vitest";
import { CommitmentServiceImpl } from "../CommitmentService";
import type { Commitment, CommitmentInstallment } from "@/models/Commitment";

const WS = "ws-1";

function commitment(over: Partial<Commitment> = {}): Commitment {
  return {
    id: "c1",
    workspace_id: WS,
    name: "Financiamento",
    description: null,
    commitment_type: "FINANCING",
    status: "ACTIVE",
    total_amount: 1000,
    installment_amount: 0,
    installments_count: 3,
    due_day: 10,
    start_date: "2026-01-10",
    account_id: null,
    card_id: null,
    category_id: "cat-1",
    subcategory_id: null,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    ...over,
  } as Commitment;
}

function installment(over: Partial<CommitmentInstallment>): CommitmentInstallment {
  return {
    id: "i1",
    workspace_id: WS,
    commitment_id: "c1",
    installment_number: 1,
    due_date: "2026-01-10",
    competence_date: "2026-01-10",
    amount: 100,
    status: "FORECAST",
    movement_id: null,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    ...over,
  } as CommitmentInstallment;
}

describe("CommitmentService.splitAmount", () => {
  it("coloca o resíduo de centavos na última parcela", () => {
    const parts = CommitmentServiceImpl.splitAmount(100, 3);
    expect(parts).toEqual([33.33, 33.33, 33.34]);
    expect(Number(parts.reduce((s, v) => s + v, 0).toFixed(2))).toBe(100);
  });

  it("divide exatamente quando não há resíduo", () => {
    expect(CommitmentServiceImpl.splitAmount(300, 3)).toEqual([100, 100, 100]);
  });
});

describe("CommitmentService.schedule", () => {
  it("gera o cronograma respeitando o dia de vencimento", () => {
    const rows = CommitmentServiceImpl.schedule({
      total_amount: 100,
      installments_count: 3,
      start_date: "2026-01-15",
      due_day: 31,
    });
    expect(rows.map((r) => r.due_date)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
    expect(rows.at(-1)!.amount).toBe(33.34);
  });

  it("rejeita número de parcelas inválido", () => {
    expect(() =>
      CommitmentServiceImpl.schedule({
        total_amount: 100,
        installments_count: 0,
        start_date: "2026-01-10",
      }),
    ).toThrow();
  });
});

describe("CommitmentService.displayStatus", () => {
  it("deriva ATRASADA de parcelas vencidas em aberto", () => {
    expect(
      CommitmentServiceImpl.displayStatus(
        { status: "FORECAST", due_date: "2026-01-10" },
        "2026-02-01",
      ),
    ).toBe("OVERDUE");
  });

  it("não marca parcela paga como atrasada", () => {
    expect(
      CommitmentServiceImpl.displayStatus(
        { status: "PAID", due_date: "2026-01-10" },
        "2026-02-01",
      ),
    ).toBe("PAID");
  });
});

describe("CommitmentService.view", () => {
  it("consolida progresso, atrasos e próxima parcela", () => {
    const c = commitment();
    const rows = [
      installment({ id: "a", installment_number: 1, amount: 300, status: "PAID" }),
      installment({ id: "b", installment_number: 2, amount: 300, due_date: "2026-02-10" }),
      installment({ id: "c", installment_number: 3, amount: 400, due_date: "2026-03-10" }),
    ];
    const v = CommitmentServiceImpl.view(c, rows, "2026-02-20");
    expect(v.paidCount).toBe(1);
    expect(v.overdueCount).toBe(1);
    expect(v.next?.id).toBe("b");
    expect(v.remainingAmount).toBe(700);
    expect(v.installments[0].label).toBe("1/3");
  });
});

describe("CommitmentService.forecastForCompetence", () => {
  const c = commitment();
  const rows = [
    installment({ id: "a", installment_number: 1, amount: 300, status: "PAID" }),
    installment({
      id: "b",
      installment_number: 2,
      amount: 300,
      due_date: "2026-02-10",
      competence_date: "2026-02-10",
    }),
  ];

  it("ignora parcelas pagas e projeta apenas a competência pedida", () => {
    const f = CommitmentServiceImpl.forecastForCompetence({
      competence: "2026-02",
      commitments: [c],
      installments: rows,
    });
    expect(f.lines).toHaveLength(1);
    expect(f.forecastTotal).toBe(300);
    expect(f.uncoveredTotal).toBe(300);
  });

  it("não soma em dobro quando a categoria já está orçada", () => {
    const f = CommitmentServiceImpl.forecastForCompetence({
      competence: "2026-02",
      commitments: [c],
      installments: rows,
      budgetedCategoryIds: ["cat-1"],
    });
    expect(f.lines[0].alreadyBudgeted).toBe(true);
    expect(f.uncoveredTotal).toBe(0);
    expect(f.forecastTotal).toBe(300);
  });

  it("ignora compromissos cancelados", () => {
    const f = CommitmentServiceImpl.forecastForCompetence({
      competence: "2026-02",
      commitments: [commitment({ status: "CANCELLED" })],
      installments: rows,
    });
    expect(f.lines).toHaveLength(0);
  });
});
