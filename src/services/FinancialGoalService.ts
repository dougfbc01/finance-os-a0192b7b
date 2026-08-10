// FinancialGoalService — Metas Financeiras (Sprint 4.4).
// Toda a regra financeira das metas vive aqui.
// REGRAS:
//  • O banco guarda apenas a meta e os aportes REAIS informados pelo usuário.
//  • Valor atual, restante, percentual, ritmo, previsão e status são SEMPRE
//    recalculados — nunca persistidos.
//  • Metas do tipo PATRIMONY acompanham o patrimônio líquido já existente
//    (PatrimonyService), sem duplicar patrimônio nem criar movimentações.
import { BaseService } from "./BaseService";
import { MovementServiceImpl } from "./MovementService";
import { MovementType } from "@/constants/enums";
import { toISODate } from "@/lib/format";
import type { Account, Movement, UUID } from "@/models";
import type { PatrimonySnapshot } from "./PatrimonyService";
import type { BudgetComparison } from "@/models/MonthlyBudget";
import type {
  CreateContributionInput,
  CreateGoalInput,
  FinancialGoal,
  FinancialGoalStatus,
  GoalAccountBreakdown,
  GoalAccountConflict,
  GoalAccountLink,
  GoalBudgetRelation,
  GoalClosingLine,
  GoalContribution,
  GoalHistoryPoint,
  GoalProgress,
  GoalStatusLevel,
  GoalValueSource,
  GoalsOverview,
  UpdateGoalInput,
} from "@/models/FinancialGoal";

const MONTH_LABEL = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" });

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return MONTH_LABEL.format(new Date(y, (m ?? 1) - 1, 1));
}

function monthsBetween(fromISO: string, toISO: string): number {
  const a = new Date(`${fromISO.slice(0, 10)}T00:00:00`);
  const b = new Date(`${toISO.slice(0, 10)}T00:00:00`);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function daysBetween(fromISO: string, toISO: string): number {
  const a = new Date(`${fromISO.slice(0, 10)}T00:00:00`).getTime();
  const b = new Date(`${toISO.slice(0, 10)}T00:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

export interface GoalProgressParams {
  goal: FinancialGoal;
  contributions: GoalContribution[];
  /** Fonte real de patrimônio, usada apenas por metas do tipo PATRIMONY. */
  patrimony?: PatrimonySnapshot | null;
  /** Vínculos meta → conta (Sprint 4.4.1). */
  links?: GoalAccountLink[];
  /** Contas do workspace — usadas para nome e saldo inicial. */
  accounts?: Account[];
  /** Movimentações reais — nunca são criadas pela meta, apenas lidas. */
  movements?: Movement[];
  /** Data de referência (default: hoje). Facilita testes determinísticos. */
  today?: string;
}

class FinancialGoalServiceImpl extends BaseService {
  private readonly table = "financial_goals";
  private readonly contribTable = "financial_goal_contributions";
  private readonly accountsTable = "financial_goal_accounts";

  // ------------------------------------------------------------------
  // Persistência
  // ------------------------------------------------------------------
  async list(workspaceId: UUID): Promise<FinancialGoal[]> {
    const { data, error } = await this.client
      .from(this.table)
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) this.handleError(error, "list");
    return (data ?? []) as unknown as FinancialGoal[];
  }

  async listContributions(workspaceId: UUID): Promise<GoalContribution[]> {
    const { data, error } = await this.client
      .from(this.contribTable)
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("contribution_date", { ascending: true });
    if (error) this.handleError(error, "listContributions");
    return (data ?? []) as unknown as GoalContribution[];
  }

  async create(input: CreateGoalInput): Promise<FinancialGoal> {
    const { data, error } = await this.client
      .from(this.table)
      .insert({
        workspace_id: input.workspace_id,
        name: input.name.trim(),
        description: input.description ?? null,
        goal_type: input.goal_type,
        target_amount: input.target_amount,
        initial_amount: input.initial_amount ?? 0,
        target_date: input.target_date ?? null,
        notes: input.notes ?? null,
        status: input.status ?? "ACTIVE",
      })
      .select("*")
      .single();
    if (error) this.handleError(error, "create");
    return data as unknown as FinancialGoal;
  }

  async update(id: UUID, input: UpdateGoalInput): Promise<FinancialGoal> {
    const { data, error } = await this.client
      .from(this.table)
      .update(input)
      .eq("id", id)
      .select("*")
      .single();
    if (error) this.handleError(error, "update");
    return data as unknown as FinancialGoal;
  }

  /** Transição de status única — pausar/retomar/cancelar/concluir passam por aqui. */
  async setStatus(id: UUID, status: FinancialGoalStatus): Promise<FinancialGoal> {
    return this.update(id, { status });
  }

  pause(id: UUID) {
    return this.setStatus(id, "PAUSED");
  }

  resume(id: UUID) {
    return this.setStatus(id, "ACTIVE");
  }

  cancel(id: UUID) {
    return this.setStatus(id, "CANCELLED");
  }

  complete(id: UUID) {
    return this.setStatus(id, "COMPLETED");
  }

  async remove(id: UUID): Promise<void> {
    const { error } = await this.client
      .from(this.table)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) this.handleError(error, "remove");
  }

  async addContribution(input: CreateContributionInput): Promise<GoalContribution> {
    const { data, error } = await this.client
      .from(this.contribTable)
      .insert({
        workspace_id: input.workspace_id,
        goal_id: input.goal_id,
        amount: input.amount,
        contribution_date: input.contribution_date,
        notes: input.notes ?? null,
      })
      .select("*")
      .single();
    if (error) this.handleError(error, "addContribution");
    return data as unknown as GoalContribution;
  }

  async removeContribution(id: UUID): Promise<void> {
    const { error } = await this.client
      .from(this.contribTable)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) this.handleError(error, "removeContribution");
  }

  // ------------------------------------------------------------------
  // Vínculo Meta → Conta (Sprint 4.4.1)
  // A meta NUNCA cria movimentação: ela apenas observa contas reais.
  // ------------------------------------------------------------------
  async listGoalAccounts(workspaceId: UUID): Promise<GoalAccountLink[]> {
    const { data, error } = await this.client
      .from(this.accountsTable)
      .select("*")
      .eq("workspace_id", workspaceId);
    if (error) this.handleError(error, "listGoalAccounts");
    return (data ?? []) as unknown as GoalAccountLink[];
  }

  /**
   * Substitui os vínculos de uma meta. Valida a dupla contagem antes de
   * gravar: uma conta não pode pertencer a duas metas ATIVAS.
   */
  async setGoalAccounts(params: {
    goalId: UUID;
    workspaceId: UUID;
    accountIds: UUID[];
    goals: FinancialGoal[];
    links: GoalAccountLink[];
    accounts: Account[];
  }): Promise<void> {
    const conflicts = this.linkConflicts(params);
    if (conflicts.length > 0) {
      const first = conflicts[0];
      this.handleError(
        new Error(
          `A conta "${first.accountName}" já está vinculada à meta ativa "${first.goalName}". Remova o vínculo antes de reutilizá-la.`,
        ),
        "setGoalAccounts",
      );
    }

    const { error: delError } = await this.client
      .from(this.accountsTable)
      .delete()
      .eq("goal_id", params.goalId);
    if (delError) this.handleError(delError, "setGoalAccounts");

    const unique = Array.from(new Set(params.accountIds));
    if (unique.length === 0) return;

    const { error } = await this.client.from(this.accountsTable).insert(
      unique.map((accountId) => ({
        workspace_id: params.workspaceId,
        goal_id: params.goalId,
        account_id: accountId,
      })),
    );
    if (error) this.handleError(error, "setGoalAccounts");
  }

  /** Remove um único vínculo conta → meta. */
  async unlinkAccount(goalId: UUID, accountId: UUID): Promise<void> {
    const { error } = await this.client
      .from(this.accountsTable)
      .delete()
      .eq("goal_id", goalId)
      .eq("account_id", accountId);
    if (error) this.handleError(error, "unlinkAccount");
  }

  // ------------------------------------------------------------------
  // Cálculos puros
  // ------------------------------------------------------------------
  /** Aportes válidos da meta, ordenados por data. */
  contributionsOf(goalId: UUID, contributions: GoalContribution[]): GoalContribution[] {
    return contributions
      .filter((c) => c.goal_id === goalId && !c.deleted_at)
      .sort((a, b) => a.contribution_date.localeCompare(b.contribution_date));
  }

  /** Contas vinculadas a uma meta. */
  accountIdsOf(goalId: UUID, links: GoalAccountLink[] = []): UUID[] {
    return links.filter((l) => l.goal_id === goalId).map((l) => l.account_id);
  }

  /**
   * Conflitos de vínculo: contas já usadas por outra meta ATIVA.
   * Metas pausadas, concluídas ou canceladas não bloqueiam.
   */
  linkConflicts(params: {
    goalId: UUID;
    accountIds: UUID[];
    goals: FinancialGoal[];
    links: GoalAccountLink[];
    accounts?: Account[];
  }): GoalAccountConflict[] {
    const activeGoals = new Map(
      params.goals
        .filter((g) => !g.deleted_at && g.status === "ACTIVE" && g.id !== params.goalId)
        .map((g) => [g.id, g] as const),
    );
    const accountName = (id: UUID) =>
      params.accounts?.find((a) => a.id === id)?.name ?? "conta";
    const out: GoalAccountConflict[] = [];
    for (const accountId of new Set(params.accountIds)) {
      for (const link of params.links) {
        if (link.account_id !== accountId || link.goal_id === params.goalId) continue;
        const owner = activeGoals.get(link.goal_id);
        if (!owner) continue;
        out.push({
          accountId,
          accountName: accountName(accountId),
          goalId: owner.id,
          goalName: owner.name,
        });
        break;
      }
    }
    return out;
  }

  /**
   * Impacto de uma movimentação real sobre um conjunto de contas.
   * Transferências entre duas contas do conjunto se anulam — por isso o
   * patrimônio e o valor da meta nunca são duplicados.
   */
  private movementImpact(m: Movement, ids: Set<UUID>): number {
    let delta = 0;
    if (m.account_id && ids.has(m.account_id)) {
      delta += MovementServiceImpl.impactOnAccount(m, m.account_id);
    }
    if (m.type === MovementType.TRANSFER && m.transfer_account_id && ids.has(m.transfer_account_id)) {
      delta += MovementServiceImpl.impactOnAccount(m, m.transfer_account_id);
    }
    return delta;
  }

  /** Saldo real de um conjunto de contas (mesma regra do DashboardService). */
  accountsBalance(params: {
    accountIds: UUID[];
    accounts: Account[];
    movements: Movement[];
  }): number {
    const ids = new Set(params.accountIds);
    let total = params.accounts
      .filter((a) => ids.has(a.id))
      .reduce((s, a) => s + (Number(a.initial_balance) || 0), 0);
    for (const m of params.movements) {
      if (m.deleted_at) continue;
      total += this.movementImpact(m, ids);
    }
    return total;
  }

  /** "De onde vem o valor desta meta?" — saldo de cada conta vinculada. */
  accountsBreakdown(params: {
    accountIds: UUID[];
    accounts: Account[];
    movements: Movement[];
  }): GoalAccountBreakdown[] {
    return params.accountIds
      .map((accountId) => {
        const account = params.accounts.find((a) => a.id === accountId);
        return {
          accountId,
          name: account?.name ?? "Conta removida",
          balance: this.accountsBalance({ ...params, accountIds: [accountId] }),
        };
      })
      .sort((a, b) => b.balance - a.balance);
  }

  /** Deep link para o extrato filtrado pelas contas da meta. */
  drillDown(accountIds: UUID[]): { to: "/movimentacoes"; search: { account?: UUID } } {
    return {
      to: "/movimentacoes",
      search: accountIds.length === 1 ? { account: accountIds[0] } : {},
    };
  }

  /** Origem do valor atual da meta. */
  valueSource(params: GoalProgressParams): GoalValueSource {
    if (this.accountIdsOf(params.goal.id, params.links ?? []).length > 0) return "ACCOUNTS";
    if (params.goal.goal_type === "PATRIMONY" && params.patrimony) return "PATRIMONY";
    return "CONTRIBUTIONS";
  }

  /** Valor atual acumulado da meta. Sempre derivado — nunca persistido. */
  currentAmount(params: GoalProgressParams): number {
    const { goal, patrimony } = params;
    const accountIds = this.accountIdsOf(goal.id, params.links ?? []);
    if (accountIds.length > 0) {
      return this.accountsBalance({
        accountIds,
        accounts: params.accounts ?? [],
        movements: params.movements ?? [],
      });
    }
    if (goal.goal_type === "PATRIMONY" && patrimony) {
      return patrimony.netWorth;
    }
    const contributed = this.contributionsOf(goal.id, params.contributions).reduce(
      (s, c) => s + Number(c.amount),
      0,
    );
    return Number(goal.initial_amount) + contributed;
  }

  remainingAmount(target: number, current: number): number {
    return Math.max(Number(target) - current, 0);
  }

  percentAchieved(target: number, current: number): number | null {
    if (!target || Number(target) <= 0) return null;
    return (current / Number(target)) * 100;
  }

  /** Histórico mensal do saldo das contas vinculadas (movimentações reais). */
  accountsHistory(params: {
    accountIds: UUID[];
    accounts: Account[];
    movements: Movement[];
  }): GoalHistoryPoint[] {
    const ids = new Set(params.accountIds);
    const initial = params.accounts
      .filter((a) => ids.has(a.id))
      .reduce((s, a) => s + (Number(a.initial_balance) || 0), 0);

    const byMonth = new Map<string, number>();
    for (const m of params.movements) {
      if (m.deleted_at) continue;
      const delta = this.movementImpact(m, ids);
      if (delta === 0) continue;
      const k = monthKey(m.transaction_date);
      byMonth.set(k, (byMonth.get(k) ?? 0) + delta);
    }

    let accumulated = initial;
    return Array.from(byMonth.keys())
      .sort()
      .map((k) => {
        const contributed = byMonth.get(k) ?? 0;
        accumulated += contributed;
        return { month: k, label: monthLabel(k), contributed, accumulated };
      });
  }

  /** Histórico mensal acumulado — contas vinculadas ou aportes reais. */
  history(params: GoalProgressParams): GoalHistoryPoint[] {
    const { goal } = params;
    const accountIds = this.accountIdsOf(goal.id, params.links ?? []);
    if (accountIds.length > 0) {
      return this.accountsHistory({
        accountIds,
        accounts: params.accounts ?? [],
        movements: params.movements ?? [],
      });
    }
    const contributions = this.contributionsOf(goal.id, params.contributions);
    const byMonth = new Map<string, number>();
    for (const c of contributions) {
      const k = monthKey(c.contribution_date);
      byMonth.set(k, (byMonth.get(k) ?? 0) + Number(c.amount));
    }
    const startKey = monthKey(goal.created_at);
    const points: GoalHistoryPoint[] = [];
    let accumulated = Number(goal.initial_amount);
    const keys = Array.from(new Set([startKey, ...byMonth.keys()])).sort();
    for (const k of keys) {
      const contributed = byMonth.get(k) ?? 0;
      accumulated += contributed;
      points.push({ month: k, label: monthLabel(k), contributed, accumulated });
    }
    return points;
  }

  /**
   * Ritmo médio mensal. Exige histórico real: pelo menos 2 aportes distribuídos
   * em 2 ou mais meses. Sem isso, retorna null (nunca inventa previsão).
   * Com contas vinculadas, o ritmo vem da evolução real do saldo.
   */
  monthlyPace(params: GoalProgressParams): number | null {
    const accountIds = this.accountIdsOf(params.goal.id, params.links ?? []);
    if (accountIds.length > 0) {
      const points = this.history(params);
      if (points.length < 2) return null;
      const total = points.reduce((s, p) => s + p.contributed, 0);
      const span = monthsBetween(`${points[0].month}-01`, `${points[points.length - 1].month}-01`) + 1;
      if (span <= 0 || total <= 0) return null;
      return total / span;
    }
    const contributions = this.contributionsOf(params.goal.id, params.contributions);
    if (contributions.length < 2) return null;
    const months = new Set(contributions.map((c) => monthKey(c.contribution_date)));
    if (months.size < 2) return null;
    const first = contributions[0].contribution_date;
    const last = contributions[contributions.length - 1].contribution_date;
    const span = monthsBetween(first, last) + 1;
    const total = contributions.reduce((s, c) => s + Number(c.amount), 0);
    if (span <= 0 || total <= 0) return null;
    return total / span;
  }

  /** Semáforo da meta. Depende do ritmo esperado até a data alvo. */
  statusLevel(params: {
    status: FinancialGoalStatus;
    percent: number | null;
    remaining: number;
    createdAt: string;
    targetDate: string | null;
    today: string;
  }): GoalStatusLevel {
    if (params.status === "COMPLETED" || params.remaining <= 0) return "DONE";
    if (params.status === "PAUSED" || params.status === "CANCELLED") return "INACTIVE";
    const percent = params.percent ?? 0;
    if (!params.targetDate) return "ON_TRACK";
    if (params.today > params.targetDate) return "LATE";
    const total = daysBetween(params.createdAt.slice(0, 10), params.targetDate);
    if (total <= 0) return "LATE";
    const elapsed = Math.max(daysBetween(params.createdAt.slice(0, 10), params.today), 0);
    const expected = (elapsed / total) * 100;
    if (percent >= expected) return "ON_TRACK";
    if (percent >= expected * 0.8) return "ATTENTION";
    return "LATE";
  }

  /** Progresso completo da meta — única fonte de verdade para a UI. */
  progress(params: GoalProgressParams): GoalProgress {
    const today = params.today ?? toISODate(new Date());
    const goal = params.goal;
    const target = Number(goal.target_amount);
    const current = this.currentAmount({ ...params, today });
    const remaining = this.remainingAmount(target, current);
    const percent = this.percentAchieved(target, current);
    const history = this.history(params);
    const pace = this.monthlyPace(params);

    let monthsToComplete: number | null = null;
    let estimatedCompletionDate: string | null = null;
    let forecastMessage: string | null = null;

    if (remaining <= 0) {
      forecastMessage = null;
    } else if (pace && pace > 0) {
      monthsToComplete = Math.ceil(remaining / pace);
      const ref = new Date(`${today}T00:00:00`);
      estimatedCompletionDate = toISODate(
        new Date(ref.getFullYear(), ref.getMonth() + monthsToComplete + 1, 0),
      );
    } else {
      forecastMessage = "Dados insuficientes para estimativa.";
    }

    const monthsToTarget = goal.target_date ? Math.max(monthsBetween(today, goal.target_date), 0) : null;
    const requiredMonthly =
      goal.target_date && remaining > 0
        ? remaining / Math.max(monthsToTarget ?? 0, 1)
        : goal.target_date
          ? 0
          : null;

    const contributions = this.contributionsOf(goal.id, params.contributions);
    const last = contributions[contributions.length - 1];
    const accountIds = this.accountIdsOf(goal.id, params.links ?? []);
    const accounts =
      accountIds.length > 0
        ? this.accountsBreakdown({
            accountIds,
            accounts: params.accounts ?? [],
            movements: params.movements ?? [],
          })
        : [];

    return {
      goalId: goal.id,
      name: goal.name,
      type: goal.goal_type,
      status: goal.status,
      target,
      current,
      remaining,
      percent,
      level: this.statusLevel({
        status: goal.status,
        percent,
        remaining,
        createdAt: goal.created_at,
        targetDate: goal.target_date,
        today,
      }),
      history,
      monthlyPace: pace,
      monthsToComplete,
      estimatedCompletionDate,
      requiredMonthly,
      monthsToTarget,
      targetDate: goal.target_date,
      forecastMessage,
      daysSinceLastContribution: last ? daysBetween(last.contribution_date, today) : null,
      source: this.valueSource(params),
      accountIds,
      accounts,
    };
  }

  /** Progresso de todas as metas do workspace. */
  progressAll(params: {
    goals: FinancialGoal[];
    contributions: GoalContribution[];
    patrimony?: PatrimonySnapshot | null;
    links?: GoalAccountLink[];
    accounts?: Account[];
    movements?: Movement[];
    today?: string;
  }): GoalProgress[] {
    return params.goals
      .filter((g) => !g.deleted_at)
      .map((goal) =>
        this.progress({
          goal,
          contributions: params.contributions,
          patrimony: params.patrimony ?? null,
          links: params.links ?? [],
          accounts: params.accounts ?? [],
          movements: params.movements ?? [],
          today: params.today,
        }),
      );
  }

  /** Consolidado para o Dashboard. */
  overview(progressList: GoalProgress[]): GoalsOverview {
    const active = progressList.filter((p) => p.status === "ACTIVE");
    const totalTarget = active.reduce((s, p) => s + p.target, 0);
    const totalCurrent = active.reduce((s, p) => s + p.current, 0);
    const pending = active.filter((p) => p.remaining > 0);
    const closest =
      pending.slice().sort((a, b) => a.remaining - b.remaining)[0] ?? null;
    const best =
      active.slice().sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0))[0] ?? null;
    return {
      active: active.length,
      completed: progressList.filter((p) => p.status === "COMPLETED" || p.level === "DONE").length,
      paused: progressList.filter((p) => p.status === "PAUSED").length,
      late: active.filter((p) => p.level === "LATE").length,
      totalTarget,
      totalCurrent,
      percent: totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : null,
      closest,
      best,
    };
  }

  /**
   * Relação entre metas ativas e o orçamento do mês. Somente leitura:
   * nada do Planejamento é alterado.
   */
  budgetRelation(
    progressList: GoalProgress[],
    budget: BudgetComparison | null,
  ): GoalBudgetRelation[] {
    const plannedAvailable = budget
      ? budget.summary.income.planned - budget.summary.expense.planned
      : 0;
    return progressList
      .filter((p) => p.status === "ACTIVE" && p.remaining > 0)
      .map((p) => ({
        goalId: p.goalId,
        name: p.name,
        requiredMonthly: p.requiredMonthly,
        plannedAvailable,
        difference: p.requiredMonthly === null ? null : plannedAvailable - p.requiredMonthly,
        feasible:
          p.requiredMonthly === null ? null : plannedAvailable >= p.requiredMonthly,
      }));
  }

  /**
   * Evolução das metas dentro de um período de fechamento. Calculado sob
   * demanda — não altera nem regrava snapshots históricos.
   */
  closingLines(params: {
    goals: FinancialGoal[];
    contributions: GoalContribution[];
    start: string;
    end: string;
  }): GoalClosingLine[] {
    return params.goals
      .filter((g) => !g.deleted_at)
      .map((goal) => {
        const all = this.contributionsOf(goal.id, params.contributions);
        const untilEnd = all.filter((c) => c.contribution_date <= params.end);
        const inPeriod = untilEnd.filter((c) => c.contribution_date >= params.start);
        const accumulated =
          Number(goal.initial_amount) + untilEnd.reduce((s, c) => s + Number(c.amount), 0);
        return {
          goalId: goal.id,
          name: goal.name,
          type: goal.goal_type,
          target: Number(goal.target_amount),
          accumulated,
          contributedInPeriod: inPeriod.reduce((s, c) => s + Number(c.amount), 0),
          percent: this.percentAchieved(Number(goal.target_amount), accumulated),
        };
      });
  }
}

export const FinancialGoalService = new FinancialGoalServiceImpl();
export { FinancialGoalServiceImpl };
