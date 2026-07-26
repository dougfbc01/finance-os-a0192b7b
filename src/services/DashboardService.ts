// DashboardService — Consolidação de indicadores financeiros.
// Todo cálculo derivado de movimentações vive aqui (nunca em componentes).

import { BaseService } from "./BaseService";
import { MovementServiceImpl } from "./MovementService";
import { INCOME_TYPES, EXPENSE_TYPES, MovementType } from "@/constants/enums";
import type { Account, Movement, UUID } from "@/models";

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

  monthSummary(movements: Movement[], year: number, month: number): MonthSummary {
    let income = 0;
    let expense = 0;
    for (const m of movements) {
      const d = new Date(`${m.transaction_date}T00:00:00`);
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
        const d = new Date(`${m.transaction_date}T00:00:00`);
        if (d.getFullYear() !== y || d.getMonth() !== mo) continue;
        if (INCOME_TYPES.includes(m.type)) income += m.amount;
        else if (EXPENSE_TYPES.includes(m.type)) expense += m.amount;
        delta += this.balanceDelta(m);
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
      const d = new Date(`${m.transaction_date}T00:00:00`);
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
}


export const DashboardService = new DashboardServiceImpl();
