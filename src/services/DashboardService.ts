// DashboardService — Consolidação de indicadores financeiros.
// Todo cálculo derivado de movimentações vive aqui (nunca em componentes).

import { BaseService } from "./BaseService";
import { MovementServiceImpl } from "./MovementService";
import { DashboardFilterService, type DateRange } from "./DashboardFilterService";
import { INCOME_TYPES, EXPENSE_TYPES, MovementType } from "@/constants/enums";
import type { Account, Asset, Movement, UUID } from "@/models";
import type { CardInvoice } from "@/models/CardInvoice";

/** Item genérico de agrupamento (categoria/subcategoria) com percentual. */
export interface BreakdownItem {
  id: UUID | null;
  amount: number;
  percent: number;
}

export interface MonthlySeriesPoint {
  key: string; // yyyy-mm
  label: string;
  income: number;
  expense: number;
  result: number;
}

export interface AccountBalancePoint {
  key: string;
  label: string;
  total: number;
  byAccount: Record<UUID, number>;
}

export interface NetWorthPoint {
  key: string;
  label: string;
  cash: number;
  assets: number;
  liabilities: number;
  netWorth: number;
}

export interface ComparisonRow {
  label: string;
  current: number;
  previous: number;
  delta: number;
  /** null quando o período anterior é zero (variação indefinida). */
  percent: number | null;
}


export interface MonthSummary {
  income: number;
  expense: number;
  result: number;
}

export interface DashboardSnapshot {
  totalBalance: number;
  month: MonthSummary;
  balancesByAccount: Record<UUID, number>;
}

export interface CashflowPoint {
  key: string; // yyyy-mm
  label: string;
  income: number;
  expense: number;
  result: number;
  balance: number;
}

export interface CategoryBreakdown {
  categoryId: UUID | null;
  amount: number;
}

class DashboardServiceImpl extends BaseService {
  /**
   * Saldo por conta = saldo inicial + soma dos impactos das movimentações
   * (respeitando transferências como fluxo entre contas — nunca despesa/receita).
   */
  computeBalances(accounts: Account[], movements: Movement[]): Record<UUID, number> {
    const map: Record<UUID, number> = {};
    for (const a of accounts) map[a.id] = Number(a.initial_balance) || 0;
    for (const m of movements) {
      if (m.account_id && map[m.account_id] !== undefined) {
        map[m.account_id] += MovementServiceImpl.impactOnAccount(m, m.account_id);
      }
      if (
        m.type === MovementType.TRANSFER &&
        m.transfer_account_id &&
        map[m.transfer_account_id] !== undefined
      ) {
        map[m.transfer_account_id] += MovementServiceImpl.impactOnAccount(m, m.transfer_account_id);
      }
    }
    return map;
  }

  totalBalance(balances: Record<UUID, number>): number {
    return Object.values(balances).reduce((s, v) => s + v, 0);
  }

  /**
   * Sprint 4.0.1 — receitas/despesas usam SEMPRE a competência (fato gerador).
   * O caixa (saldo) continua seguindo a data da movimentação.
   */
  private competenceDate(m: Movement): Date {
    return new Date(`${m.competence_date ?? m.transaction_date}T00:00:00`);
  }

  monthSummary(movements: Movement[], year: number, month: number): MonthSummary {
    let income = 0;
    let expense = 0;
    for (const m of movements) {
      const d = this.competenceDate(m);
      if (d.getFullYear() !== year || d.getMonth() !== month) continue;
      if (INCOME_TYPES.includes(m.type)) income += m.amount;
      else if (EXPENSE_TYPES.includes(m.type)) expense += m.amount;
    }
    return { income, expense, result: income - expense };
  }

  /**
   * Evolução mensal do saldo total nos últimos `months` meses (inclusive o atual).
   */
  cashflow(accounts: Account[], movements: Movement[], months = 6): CashflowPoint[] {
    const initial = accounts.reduce((s, a) => s + Number(a.initial_balance || 0), 0);
    const now = new Date();
    const points: CashflowPoint[] = [];

    const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
    // Saldo até o dia anterior ao início da janela
    let runningBalance = initial;
    for (const m of movements) {
      const d = new Date(`${m.transaction_date}T00:00:00`);
      if (d < start) {
        runningBalance += this.balanceDelta(m);
      }
    }

    for (let i = 0; i < months; i++) {
      const ref = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const y = ref.getFullYear();
      const mo = ref.getMonth();
      let income = 0;
      let expense = 0;
      let delta = 0;
      for (const m of movements) {
        const comp = this.competenceDate(m);
        if (comp.getFullYear() === y && comp.getMonth() === mo) {
          if (INCOME_TYPES.includes(m.type)) income += m.amount;
          else if (EXPENSE_TYPES.includes(m.type)) expense += m.amount;
        }
        const cash = new Date(`${m.transaction_date}T00:00:00`);
        if (cash.getFullYear() === y && cash.getMonth() === mo) delta += this.balanceDelta(m);
      }
      runningBalance += delta;
      points.push({
        key: `${y}-${String(mo + 1).padStart(2, "0")}`,
        label: ref.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
        income,
        expense,
        result: income - expense,
        balance: runningBalance,
      });
    }

    return points;
  }

  /** Delta global de saldo bancário (soma sobre todas as contas do workspace). */
  private balanceDelta(m: Movement): number {
    if (m.type === MovementType.TRANSFER) return 0; // fluxo entre contas
    // Compras no cartão não impactam caixa (viram passivo). Pagamento sim.
    if (m.card_id && m.type !== MovementType.CARD_PAYMENT) return 0;
    if (INCOME_TYPES.includes(m.type)) return m.amount;
    if (EXPENSE_TYPES.includes(m.type)) return -m.amount;
    if (m.type === MovementType.INVESTMENT || m.type === MovementType.CARD_PAYMENT) return -m.amount;
    if (m.type === MovementType.ADJUSTMENT) return m.amount;
    return 0;
  }

  /** Despesas do mês por categoria. */
  expensesByCategory(movements: Movement[], year: number, month: number): CategoryBreakdown[] {
    const map = new Map<UUID | "none", number>();
    for (const m of movements) {
      if (!EXPENSE_TYPES.includes(m.type)) continue;
      const d = this.competenceDate(m);
      if (d.getFullYear() !== year || d.getMonth() !== month) continue;
      const key = m.category_id ?? "none";
      map.set(key, (map.get(key) ?? 0) + m.amount);
    }
    return Array.from(map.entries())
      .map(([categoryId, amount]) => ({
        categoryId: categoryId === "none" ? null : (categoryId as UUID),
        amount,
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  // ────────────────────────────────────────────────────────────────
  // Sprint 4.1 — Análises com filtro global de período.
  // O intervalo SEMPRE chega resolvido pelo DashboardFilterService.
  // Nenhuma regra financeira nova: reutiliza competência, impacto de
  // conta e delta de caixa já definidos acima.
  // ────────────────────────────────────────────────────────────────

  private monthKeyOf(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  private inRange(range: DateRange, iso: string | null | undefined): boolean {
    return DashboardFilterService.contains(range, iso);
  }

  /** Competência (yyyy-mm-dd) usada como fato gerador. */
  private competenceIso(m: Movement): string {
    return (m.competence_date ?? m.transaction_date).slice(0, 10);
  }

  /** Receitas/Despesas/Resultado dentro de um intervalo (por competência). */
  summaryInRange(movements: Movement[], range: DateRange): MonthSummary {
    let income = 0;
    let expense = 0;
    for (const m of movements) {
      if (!this.inRange(range, this.competenceIso(m))) continue;
      if (INCOME_TYPES.includes(m.type)) income += m.amount;
      else if (EXPENSE_TYPES.includes(m.type)) expense += m.amount;
    }
    return { income, expense, result: income - expense };
  }

  /** Receitas do período agrupadas por categoria (com percentual). */
  incomeByCategory(movements: Movement[], range: DateRange): BreakdownItem[] {
    return this.groupBreakdown(movements, range, INCOME_TYPES, (m) => m.category_id);
  }

  /** Despesas do período agrupadas por categoria (com percentual). */
  expensesByCategoryInRange(movements: Movement[], range: DateRange): BreakdownItem[] {
    return this.groupBreakdown(movements, range, EXPENSE_TYPES, (m) => m.category_id);
  }

  /** Receitas do período agrupadas por subcategoria (com percentual). */
  incomeBySubcategory(movements: Movement[], range: DateRange): BreakdownItem[] {
    return this.groupBreakdown(movements, range, INCOME_TYPES, (m) => m.subcategory_id);
  }

  private groupBreakdown(
    movements: Movement[],
    range: DateRange,
    types: MovementType[],
    keyOf: (m: Movement) => UUID | null,
  ): BreakdownItem[] {
    const map = new Map<UUID | "none", number>();
    let total = 0;
    for (const m of movements) {
      if (!types.includes(m.type)) continue;
      if (!this.inRange(range, this.competenceIso(m))) continue;
      const key = keyOf(m) ?? "none";
      map.set(key, (map.get(key) ?? 0) + m.amount);
      total += m.amount;
    }
    return Array.from(map.entries())
      .map(([id, amount]) => ({
        id: id === "none" ? null : (id as UUID),
        amount,
        percent: total > 0 ? (amount / total) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  /** Série mensal de receitas/despesas/resultado dentro do período. */
  monthlySeries(movements: Movement[], months: string[]): MonthlySeriesPoint[] {
    const base = new Map<string, MonthlySeriesPoint>();
    for (const key of months) {
      base.set(key, {
        key,
        label: DashboardFilterService.monthLabel(key),
        income: 0,
        expense: 0,
        result: 0,
      });
    }
    for (const m of movements) {
      const key = this.competenceIso(m).slice(0, 7);
      const point = base.get(key);
      if (!point) continue;
      if (INCOME_TYPES.includes(m.type)) point.income += m.amount;
      else if (EXPENSE_TYPES.includes(m.type)) point.expense += m.amount;
      point.result = point.income - point.expense;
    }
    return Array.from(base.values());
  }

  /**
   * Evolução mensal do saldo por conta (e consolidado) dentro do período.
   * Saldo acumulado: parte do saldo inicial + movimentações anteriores à janela.
   */
  accountBalanceSeries(
    accounts: Account[],
    movements: Movement[],
    months: string[],
  ): AccountBalancePoint[] {
    if (months.length === 0) return [];
    const running: Record<UUID, number> = {};
    for (const a of accounts) running[a.id] = Number(a.initial_balance) || 0;

    const firstMonth = months[0];
    const byMonth = new Map<string, Movement[]>();
    for (const m of movements) {
      const key = m.transaction_date.slice(0, 7);
      if (key < firstMonth) {
        this.applyAccountDelta(running, m);
        continue;
      }
      const list = byMonth.get(key);
      if (list) list.push(m);
      else byMonth.set(key, [m]);
    }

    const points: AccountBalancePoint[] = [];
    for (const key of months) {
      for (const m of byMonth.get(key) ?? []) this.applyAccountDelta(running, m);
      const byAccount = { ...running };
      points.push({
        key,
        label: DashboardFilterService.monthLabel(key),
        byAccount,
        total: Object.values(byAccount).reduce((s, v) => s + v, 0),
      });
    }
    return points;
  }

  private applyAccountDelta(running: Record<UUID, number>, m: Movement) {
    if (m.account_id && running[m.account_id] !== undefined) {
      running[m.account_id] += MovementServiceImpl.impactOnAccount(m, m.account_id);
    }
    if (
      m.type === MovementType.TRANSFER &&
      m.transfer_account_id &&
      running[m.transfer_account_id] !== undefined
    ) {
      running[m.transfer_account_id] += MovementServiceImpl.impactOnAccount(
        m,
        m.transfer_account_id,
      );
    }
  }

  /**
   * Evolução mensal do patrimônio total dentro do período.
   * Caixa: saldo acumulado real por mês.
   * Ativos: valor atual declarado (não há histórico de marcação a mercado).
   * Passivo: faturas não pagas com vencimento até o fim do mês.
   */
  netWorthSeries(params: {
    accounts: Account[];
    movements: Movement[];
    assets: Asset[];
    invoices: CardInvoice[];
    months: string[];
  }): NetWorthPoint[] {
    const balances = this.accountBalanceSeries(params.accounts, params.movements, params.months);
    const assetsValue = params.assets
      .filter((a) => a.is_active && !a.deleted_at)
      .reduce((s, a) => s + Number(a.current_value), 0);

    return balances.map((point) => {
      const liabilities = params.invoices
        .filter(
          (i) =>
            !i.deleted_at &&
            i.status !== "PAID" &&
            i.due_date.slice(0, 7) <= point.key,
        )
        .reduce((s, i) => s + Number(i.amount), 0);
      return {
        key: point.key,
        label: point.label,
        cash: point.total,
        assets: assetsValue,
        liabilities,
        netWorth: point.total + assetsValue - liabilities,
      };
    });
  }

  /** Comparativo do período atual x período anterior. */
  comparison(params: {
    accounts: Account[];
    movements: Movement[];
    assets: Asset[];
    invoices: CardInvoice[];
    current: DateRange;
    previous: DateRange;
  }): ComparisonRow[] {
    const cur = this.summaryInRange(params.movements, params.current);
    const prev = this.summaryInRange(params.movements, params.previous);

    const netWorthAt = (range: DateRange) => {
      const months = [range.end.slice(0, 7)];
      const series = this.netWorthSeries({
        accounts: params.accounts,
        movements: params.movements,
        assets: params.assets,
        invoices: params.invoices,
        months,
      });
      return series[0];
    };

    const curNet = netWorthAt(params.current);
    const prevNet = netWorthAt(params.previous);

    const row = (label: string, current: number, previous: number): ComparisonRow => ({
      label,
      current,
      previous,
      delta: current - previous,
      percent: previous !== 0 ? ((current - previous) / Math.abs(previous)) * 100 : null,
    });

    return [
      row("Receitas", cur.income, prev.income),
      row("Despesas", cur.expense, prev.expense),
      row("Saldo", cur.result, prev.result),
      row("Patrimônio", curNet?.netWorth ?? 0, prevNet?.netWorth ?? 0),
      row("Passivo", curNet?.liabilities ?? 0, prevNet?.liabilities ?? 0),
    ];
  }
}


export const DashboardService = new DashboardServiceImpl();
export { DashboardServiceImpl };

