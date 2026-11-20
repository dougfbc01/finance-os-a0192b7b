// MonthlySummaryService — "Resumo do mês" (Relatórios). Somente leitura.
// Nenhum valor é gravado; tudo é projetado a partir das movimentações e dos
// Services existentes (Dashboard, Fechamento, Orçamento, base mensal de investimentos).
import { BaseService } from "./BaseService";
import { DashboardServiceImpl } from "./DashboardService";
import { MovementServiceImpl } from "./MovementService";
import { AssetValuationServiceImpl } from "./AssetValuationService";
import { InvestmentServiceImpl } from "./InvestmentService";
import { MonthlyClosingServiceImpl } from "./MonthlyClosingService";
import { MovementType } from "@/constants/enums";
import type { Account, Asset, Movement, UUID } from "@/models";
import type { Card } from "@/models/Card";
import type { CardInvoice } from "@/models/CardInvoice";
import type { ClosingWarning, MonthlyClosing } from "@/models/MonthlyClosing";
import type { BudgetComparison } from "@/models/MonthlyBudget";

const Dashboard = new DashboardServiceImpl();
const Closing = new MonthlyClosingServiceImpl();

export type MonthStatus = "CLOSED" | "STALE" | "REOPENED" | "OPEN" | "IN_PROGRESS";

export interface Kpi {
  key: "income" | "expense" | "result" | "savingsRate";
  label: string;
  value: number | null;
  previous: number | null;
  average6: number | null;
  deltaPrevious: number | null;
  deltaAverage: number | null;
}

export interface ChecklistItem { key: string; label: string; ok: boolean; count: number }

export interface NetWorthBridge {
  start: number;
  result: number;
  valuation: number;
  others: number;
  unexplained: number;
  end: number;
}

export interface MonthlySummary {
  monthKey: string;
  status: MonthStatus;
  ready: boolean;
  checklist: ChecklistItem[];
  kpis: Kpi[];
  bridge: NetWorthBridge;
  categoryChanges: { id: UUID | null; label: string; current: number; previous: number; delta: number }[];
  topExpenses: { id: UUID; description: string; date: string; amount: number; category: string }[];
  unusual: { id: UUID; description: string; date: string; amount: number; category: string; average: number }[];
  cards: { id: UUID; label: string; purchases: number; paidInvoices: number; open: number }[];
  budget: { key: string; label: string; planned: number; actual: number; difference: number }[];
  investments: { contributions: number; income: number; valuation: number; endValue: number; atCost: number };
}

export interface BuildSummaryParams {
  year: number;
  /** 1-12 */
  month: number;
  accounts: Account[];
  movements: Movement[];
  assets: Asset[];
  invoices: CardInvoice[];
  cards: Card[];
  categories: { id: string; name: string }[];
  investmentsByMonth: Record<string, number>;
  investmentsAtCostByMonth?: Record<string, number>;
  budget: BudgetComparison | null;
  closing: MonthlyClosing | null;
  stale: boolean;
  warnings: ClosingWarning[];
  today?: string;
}

/** Ticket mínimo (R$) para um gasto ser sinalizado como incomum. */
export const UNUSUAL_MIN_AMOUNT = 100;
/** Múltiplo do ticket médio da categoria (6 meses anteriores) que define gasto incomum. */
export const UNUSUAL_FACTOR = 2;

const CHECKLIST: { key: string; label: string }[] = [
  { key: "duplicates", label: "Sem duplicidades pendentes" },
  { key: "uncategorized", label: "Todos os lançamentos categorizados" },
  { key: "ruleConflicts", label: "Sem regras conflitantes" },
  { key: "ruleDuplicates", label: "Sem regras duplicadas" },
  { key: "health", label: "Verificação de integridade sem alertas" },
  { key: "insights", label: "Sem alertas críticos" },
];

export function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}
const keyOf = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;

class MonthlySummaryServiceImpl extends BaseService {
  protected readonly serviceName = "MonthlySummaryService";

  status(closing: MonthlyClosing | null, stale: boolean, monthKey: string, today: string): MonthStatus {
    if (closing?.status === "CLOSED" || closing?.status === "LOCKED") return stale ? "STALE" : "CLOSED";
    if (closing?.reopened_at) return "REOPENED";
    return monthKey >= today.slice(0, 7) ? "IN_PROGRESS" : "OPEN";
  }

  checklist(warnings: ClosingWarning[], monthKey: string, today: string): ChecklistItem[] {
    const ended = monthKey < today.slice(0, 7);
    return [
      { key: "ended", label: "Mês encerrado", ok: ended, count: ended ? 0 : 1 },
      ...CHECKLIST.map((c) => {
        const w = warnings.find((x) => x.key === c.key);
        return { key: c.key, label: c.label, ok: !w, count: w?.count ?? 0 };
      }),
    ];
  }

  private kpi(key: Kpi["key"], label: string, value: number | null, previous: number | null, history: (number | null)[]): Kpi {
    const valid = history.filter((v): v is number => v !== null);
    const average6 = valid.length ? valid.reduce((s, v) => s + v, 0) / valid.length : null;
    return {
      key, label, value, previous, average6,
      deltaPrevious: value !== null && previous !== null ? value - previous : null,
      deltaAverage: value !== null && average6 !== null ? value - average6 : null,
    };
  }

  private savingsRate(income: number, result: number): number | null {
    return income > 0 ? (result / income) * 100 : null;
  }

  /** Custo das posições de investimento na data (positionOf), para separar aportes de valorização. */
  private investedCost(assets: Asset[], movements: Movement[], date: string): number {
    const upTo = movements.filter((m) => !m.deleted_at && m.transaction_date <= date);
    return InvestmentServiceImpl.filterInvestments(assets).filter((a) => !a.deleted_at)
      .reduce((s, a) => s + Math.max(0, AssetValuationServiceImpl.positionOf(a.id, upTo).cost ?? 0), 0);
  }

  build(p: BuildSummaryParams): MonthlySummary {
    const today = p.today ?? new Date().toISOString().slice(0, 10);
    const monthKey = keyOf(p.year, p.month);
    const prev = shiftMonth(p.year, p.month, -1);
    const prevKey = keyOf(prev.year, prev.month);
    const range = Closing.periodRange(p.year, p.month);
    const prevRange = Closing.periodRange(prev.year, prev.month);
    const label = (id: string | null) => (id ? p.categories.find((c) => c.id === id)?.name : null) ?? "Sem categoria";

    // KPIs (competência) vs mês anterior e média dos 6 meses anteriores.
    const cur = Dashboard.summaryInRange(p.movements, range);
    const prevSum = Dashboard.summaryInRange(p.movements, prevRange);
    const history = Array.from({ length: 6 }, (_, i) => {
      const s = shiftMonth(p.year, p.month, -(i + 1));
      return Dashboard.summaryInRange(p.movements, Closing.periodRange(s.year, s.month));
    });
    const kpis: Kpi[] = [
      this.kpi("income", "Receitas", cur.income, prevSum.income, history.map((h) => h.income)),
      this.kpi("expense", "Despesas", cur.expense, prevSum.expense, history.map((h) => h.expense)),
      this.kpi("result", "Resultado", cur.result, prevSum.result, history.map((h) => h.result)),
      this.kpi("savingsRate", "Taxa de poupança (%)", this.savingsRate(cur.income, cur.result),
        this.savingsRate(prevSum.income, prevSum.result), history.map((h) => this.savingsRate(h.income, h.result))),
    ];

    // Por que o patrimônio mudou.
    const nw = Dashboard.netWorthSeries({ accounts: p.accounts, movements: p.movements, assets: p.assets,
      invoices: p.invoices, months: [prevKey, monthKey], investmentsByMonth: p.investmentsByMonth, today });
    const start = nw[0]?.netWorth ?? 0;
    const end = nw[1]?.netWorth ?? 0;
    const startDate = Dashboard.monthEndDate(prevKey, today);
    const endDate = Dashboard.monthEndDate(monthKey, today);
    const invDelta = (p.investmentsByMonth[monthKey] ?? 0) - (p.investmentsByMonth[prevKey] ?? 0);
    const costDelta = this.investedCost(p.assets, p.movements, endDate) - this.investedCost(p.assets, p.movements, startDate);
    const valuation = invDelta - costDelta;
    const investmentIds = new Set(InvestmentServiceImpl.filterInvestments(p.assets).map((a) => a.id));
    const cashInMonth = p.movements.filter((m) => !m.deleted_at && m.transaction_date >= range.start && m.transaction_date <= range.end);
    const others = cashInMonth
      .filter((m) => (m.type === MovementType.ADJUSTMENT || m.type === MovementType.REFUND) && !(m.asset_id && investmentIds.has(m.asset_id)) && m.account_id)
      .reduce((s, m) => s + MovementServiceImpl.impactOnAccount(m, m.account_id as string), 0);
    const bridge: NetWorthBridge = { start, result: cur.result, valuation, others,
      unexplained: end - start - cur.result - valuation - others, end };

    // Categorias que mais mudaram.
    const curCats = Dashboard.expensesByCategoryInRange(p.movements, range);
    const prevCats = Dashboard.expensesByCategoryInRange(p.movements, prevRange);
    const ids = new Set([...curCats, ...prevCats].map((c) => c.id));
    const categoryChanges = [...ids].map((id) => {
      const c = curCats.find((x) => x.id === id)?.amount ?? 0;
      const pv = prevCats.find((x) => x.id === id)?.amount ?? 0;
      return { id, label: label(id), current: c, previous: pv, delta: c - pv };
    }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 5);

    // Maiores despesas e gastos incomuns (competência).
    const comp = (m: Movement) => (m.competence_date ?? m.transaction_date).slice(0, 10);
    const expenses = p.movements.filter((m) => MovementServiceImpl.isExpense(m));
    const monthExpenses = expenses.filter((m) => comp(m) >= range.start && comp(m) <= range.end);
    const topExpenses = [...monthExpenses].sort((a, b) => b.amount - a.amount).slice(0, 10)
      .map((m) => ({ id: m.id, description: m.description, date: comp(m), amount: m.amount, category: label(m.category_id) }));
    const histStart = Closing.periodRange(shiftMonth(p.year, p.month, -6).year, shiftMonth(p.year, p.month, -6).month).start;
    const past = expenses.filter((m) => comp(m) >= histStart && comp(m) < range.start);
    const unusual = monthExpenses.flatMap((m) => {
      const same = past.filter((x) => x.category_id === m.category_id);
      if (same.length < 3) return [];
      const average = same.reduce((s, x) => s + x.amount, 0) / same.length;
      return m.amount >= UNUSUAL_MIN_AMOUNT && m.amount >= average * UNUSUAL_FACTOR
        ? [{ id: m.id, description: m.description, date: comp(m), amount: m.amount, category: label(m.category_id), average }] : [];
    }).sort((a, b) => b.amount - a.amount).slice(0, 10);

    // Cartões: compras do mês × faturas pagas no mês × fatura aberta.
    const cards = p.cards.filter((c) => !c.deleted_at).map((c) => {
      const purchases = monthExpenses.filter((m) => m.card_id === c.id).reduce((s, m) => s + m.amount, 0);
      const own = p.invoices.filter((i) => i.card_id === c.id && !i.deleted_at);
      const paidInvoices = own.filter((i) => i.paid_at && i.paid_at.slice(0, 10) >= range.start && i.paid_at.slice(0, 10) <= range.end)
        .reduce((s, i) => s + Number(i.amount), 0);
      const open = own.filter((i) => i.status === "OPEN").reduce((s, i) => s + Number(i.amount), 0);
      return { id: c.id, label: c.name, purchases, paidInvoices, open };
    }).filter((c) => c.purchases || c.paidInvoices || c.open);

    // Orçamento: maiores desvios.
    const budget = (p.budget?.lines ?? []).filter((l) => l.planned > 0 || l.actual > 0)
      .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference)).slice(0, 5)
      .map((l) => ({ key: l.key, label: l.subcategoryName ? `${l.categoryName} › ${l.subcategoryName}` : l.categoryName,
        planned: l.planned, actual: l.actual, difference: l.difference }));

    const inMonth = (m: Movement) => !m.deleted_at && comp(m) >= range.start && comp(m) <= range.end;
    const investments = {
      contributions: p.movements.filter((m) => inMonth(m) && m.type === MovementType.INVESTMENT && !m.is_historical).reduce((s, m) => s + m.amount, 0),
      income: p.movements.filter((m) => MovementServiceImpl.isIncome(m) && inMonth(m) && (m.type === MovementType.DIVIDEND || m.type === MovementType.INTEREST)).reduce((s, m) => s + m.amount, 0),
      valuation,
      endValue: p.investmentsByMonth[monthKey] ?? 0,
      atCost: p.investmentsAtCostByMonth?.[monthKey] ?? 0,
    };

    const checklist = this.checklist(p.warnings, monthKey, today);
    return {
      monthKey,
      status: this.status(p.closing, p.stale, monthKey, today),
      ready: checklist.every((c) => c.ok),
      checklist, kpis, bridge, categoryChanges, topExpenses, unusual, cards, budget, investments,
    };
  }
}

export const MonthlySummaryService = new MonthlySummaryServiceImpl();
export { MonthlySummaryServiceImpl };

export interface MonthGridCell { year: number; month: number; key: string; status: MonthStatus; closingId: UUID | null }

/** Últimos `count` meses (mais antigo primeiro, incluindo o atual) com o status de fechamento. */
export function lastMonthsGrid(closings: MonthlyClosing[], staleIds: Set<UUID>, today = new Date().toISOString().slice(0, 10), count = 12): MonthGridCell[] {
  const [ty, tm] = today.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const { year, month } = shiftMonth(ty, tm, i - (count - 1));
    const key = keyOf(year, month);
    const closing = closings.find((c) => c.year === year && c.month === month) ?? null;
    return { year, month, key, closingId: closing?.id ?? null,
      status: MonthlySummaryService.status(closing, !!closing && staleIds.has(closing.id), key, today) };
  });
}

/** Meses que o fechamento em lote pode fechar: abertos ou reabertos e já encerrados, em ordem cronológica. */
export function monthsToBatchClose(grid: MonthGridCell[]): MonthGridCell[] {
  return grid.filter((c) => c.status === "OPEN" || c.status === "REOPENED");
}

/** Série de resultado e patrimônio para o gráfico dos Fechamentos (mesmas regras do Dashboard). */
export function closingTrend(p: { accounts: Account[]; movements: Movement[]; assets: Asset[]; invoices: CardInvoice[];
  investmentsByMonth: Record<string, number>; months: string[]; today?: string }) {
  const results = Dashboard.monthlySeries(p.movements, p.months);
  const nw = Dashboard.netWorthSeries({ ...p });
  return p.months.map((key, i) => ({ key, label: results[i]?.label ?? key, result: results[i]?.result ?? 0, netWorth: nw[i]?.netWorth ?? 0 }));
}
