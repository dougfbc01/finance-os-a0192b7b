import { describe, expect, it } from "vitest";
import { CardServiceImpl } from "@/services/CardService";

const card = (closing_day: number, due_day: number) => ({ closing_day, due_day });

describe("computeInvoicePeriod", () => {
  it("fecha 28 / vence 06 — compra em 29/06 vai para a fatura de agosto", () => {
    const p = CardServiceImpl.computeInvoicePeriod(card(28, 6), "2026-06-29");
    expect(p.closing_date).toBe("2026-07-28");
    expect(p.due_date).toBe("2026-08-06");
    expect(p.competence).toBe("2026-08-01");
    expect(p.period_start).toBe("2026-06-29");
  });

  it("fecha 28 / vence 06 — compra em 28/07 continua na fatura de agosto", () => {
    const p = CardServiceImpl.computeInvoicePeriod(card(28, 6), "2026-07-28");
    expect(p.competence).toBe("2026-08-01");
    expect(p.due_date).toBe("2026-08-06");
  });

  it("fecha 28 / vence 06 — compra em 29/07 vai para setembro", () => {
    const p = CardServiceImpl.computeInvoicePeriod(card(28, 6), "2026-07-29");
    expect(p.closing_date).toBe("2026-08-28");
    expect(p.competence).toBe("2026-09-01");
  });

  it("fechamento dia 1", () => {
    const p = CardServiceImpl.computeInvoicePeriod(card(1, 10), "2026-03-02");
    expect(p.closing_date).toBe("2026-04-01");
    expect(p.due_date).toBe("2026-04-10");
    expect(p.competence).toBe("2026-04-01");
  });

  it("fechamento dia 31 em mês de 30 dias ajusta para o último dia", () => {
    const p = CardServiceImpl.computeInvoicePeriod(card(31, 10), "2026-04-30");
    expect(p.closing_date).toBe("2026-04-30");
    expect(p.due_date).toBe("2026-05-10");
  });

  it("fevereiro em ano não bissexto", () => {
    const p = CardServiceImpl.computeInvoicePeriod(card(30, 5), "2026-02-20");
    expect(p.closing_date).toBe("2026-02-28");
    expect(p.due_date).toBe("2026-03-05");
  });

  it("fevereiro em ano bissexto", () => {
    const p = CardServiceImpl.computeInvoicePeriod(card(30, 5), "2028-02-20");
    expect(p.closing_date).toBe("2028-02-29");
    expect(p.due_date).toBe("2028-03-05");
  });

  it("virada de ano em dezembro", () => {
    const p = CardServiceImpl.computeInvoicePeriod(card(28, 6), "2026-12-29");
    expect(p.closing_date).toBe("2027-01-28");
    expect(p.due_date).toBe("2027-02-06");
    expect(p.competence).toBe("2027-02-01");
  });
});

describe("computeInvoiceStatus", () => {
  const inv = { closing_date: "2026-07-28", due_date: "2026-08-06" };

  it("OPEN antes do fechamento", () => {
    expect(CardServiceImpl.computeInvoiceStatus(inv, "2026-07-20")).toBe("OPEN");
  });

  it("CLOSED após o fechamento e antes do vencimento", () => {
    expect(CardServiceImpl.computeInvoiceStatus(inv, "2026-07-31")).toBe("CLOSED");
    expect(CardServiceImpl.computeInvoiceStatus(inv, "2026-08-06")).toBe("CLOSED");
  });

  it("nunca OVERDUE antes do vencimento", () => {
    for (const d of ["2026-06-29", "2026-07-28", "2026-08-05", "2026-08-06"]) {
      expect(CardServiceImpl.computeInvoiceStatus(inv, d)).not.toBe("OVERDUE");
    }
  });

  it("OVERDUE somente depois do vencimento e sem pagamento", () => {
    expect(CardServiceImpl.computeInvoiceStatus(inv, "2026-08-07")).toBe("OVERDUE");
  });

  it("PAID prevalece sobre as datas", () => {
    expect(
      CardServiceImpl.computeInvoiceStatus({ ...inv, paid_at: "2026-08-06" }, "2026-09-30"),
    ).toBe("PAID");
  });
});
