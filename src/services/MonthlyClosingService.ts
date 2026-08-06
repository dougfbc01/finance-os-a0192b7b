// MonthlyClosingService — Fechamento Mensal (Sprint 4.2).
// Regra central do módulo: monta um SNAPSHOT auditável do mês e persiste.
// Nunca substitui os cálculos do sistema; apenas congela o resultado deles.
import { BaseService } from "./BaseService";
import { DashboardServiceImpl } from "./DashboardService";
import { PatrimonyServiceImpl } from "./PatrimonyService";
import { MovementType } from "@/constants/enums";
import { toISODate } from "@/lib/format";
import type { Account, Asset, Movement, UUID, Category, Subcategory } from "@/models";
import type { Card } from "@/models/Card";
import type { CardInvoice } from "@/models/CardInvoice";
import type { FinancialInsight, InsightSummary } from "@/models/Insight";
import type {
  ClosingAccountRow,
  ClosingBreakdown,
  ClosingBreakdownRow,
  ClosingCardRow,
  ClosingComparison,
  ClosingComparisonRow,
  ClosingEvent,
  ClosingHealth,
  ClosingSnapshot,
  ClosingWarning,
  MonthlyClosing,
} from "@/models/MonthlyClosing";
import type { BudgetComparison } from "@/models/MonthlyBudget";
import { MonthlyBudgetService } from "./MonthlyBudgetService";

const Dashboard = new DashboardServiceImpl();

export interface BuildSnapshotParams {
  year: number;
  /** 1-12 */
  month: number;
  accounts: Account[];
  movements: Movement[];
  assets: Asset[];
  invoices: CardInvoice[];
  cards: Card[];
  categories: Pick<Category, "id" | "name">[];
  subcategories: Pick<Subcategory, "id" | "name">[];
  importsCount: number;
  duplicatesCount: number;
  ruleConflicts: number;
  ruleDuplicates: number;
  insights: FinancialInsight[];
  insightsSummary: InsightSummary;
  health: ClosingHealth;
  /** Comparação Planejado x Realizado do mês (Sprint 4.3). */
  budget?: BudgetComparison | null;
}

interface ClosingRow {
  id: UUID;
  workspace_id: UUID;
  year: number;
  month: number;
  status: MonthlyClosing["status"];
  closed_at: string | null;
  closed_by: string | null;
  reopened_at: string | null;
  reopened_by: string | null;
  reopen_reason: string | null;
  notes: string | null;
  snapshot_json: unknown;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

class MonthlyClosingServiceImpl extends BaseService {
  // ------------------------------------------------------------------
  // Período
  // ------------------------------------------------------------------
  periodRange(year: number, month: number) {
    const start = toISODate(new Date(year, month - 1, 1));
    const end = toISODate(new Date(year, month, 0));
    return { start, end };
  }

  private competenceIso(m: Movement): string {
    return m.competence_date ?? m.transaction_date;
  }

  private inPeriod(m: Movement, start: string, end: string): boolean {
    const iso = this.competenceIso(m);
    return iso >= start && iso <= end;
  }

  private label(
    id: UUID | null,
    lookup: { id: string; name: string }[],
    fallback = "Sem classificação",
  ): string {
    if (!id) return fallback;
    return lookup.find((l) => l.id === id)?.name ?? fallback;
  }

  private toRows(
    items: { id: UUID | null; amount: number; percent: number }[],
    lookup: { id: string; name: string }[],
  ): ClosingBreakdownRow[] {
    return items.map((i) => ({
      id: i.id,
      label: this.label(i.id, lookup),
      amount: i.amount,
      percent: i.percent,
    }));
  }

  // ------------------------------------------------------------------
  // Snapshot (função pura — não toca no banco)
  // ------------------------------------------------------------------
  buildSnapshot(params: BuildSnapshotParams): ClosingSnapshot {
    const { year, month } = params;
    const range = this.periodRange(year, month);
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;

    const summary = Dashboard.summaryInRange(params.movements, range);

    const netWorthSeries = Dashboard.netWorthSeries({
      accounts: params.accounts,
      movements: params.movements,
      assets: params.assets,
      invoices: params.invoices,
      months: [monthKey],
    });
    const nw = netWorthSeries[netWorthSeries.length - 1];
    const fallbackPatrimony = PatrimonyServiceImpl.snapshot({
      cashBalance: Dashboard.totalBalance(
        Dashboard.computeBalances(params.accounts, params.movements),
      ),
      assets: params.assets,
      invoices: params.invoices,
    });

    const totals = {
      income: summary.income,
      expense: summary.expense,
      result: summary.result,
      cash: nw?.cash ?? fallbackPatrimony.cash,
      assets: nw?.assets ?? fallbackPatrimony.assets,
      liabilities: nw?.liabilities ?? fallbackPatrimony.liabilities,
      netWorth: nw?.netWorth ?? fallbackPatrimony.netWorth,
    };

    const inMonth = params.movements.filter((m) =>
      this.inPeriod(m, range.start, range.end),
    );

    const byCategory: ClosingBreakdown = {
      income: this.toRows(
        Dashboard.incomeByCategory(params.movements, range),
        params.categories,
      ),
      expense: this.toRows(
        Dashboard.expensesByCategoryInRange(params.movements, range),
        params.categories,
      ),
    };

    const bySubcategory: ClosingBreakdown = {
      income: this.toRows(
        Dashboard.incomeBySubcategory(params.movements, range),
        params.subcategories,
      ),
      expense: this.toRows(
        Dashboard.expensesBySubcategoryInRange(params.movements, range),
        params.subcategories,
      ),
    };

    const accountSeries = Dashboard.accountBalanceSeries(
      params.accounts,
      params.movements,
      [monthKey],
    );
    const balances = accountSeries[accountSeries.length - 1]?.byAccount ?? {};
    const byAccount: ClosingAccountRow[] = params.accounts.map((a) => ({
      id: a.id,
      label: a.name,
      balance: balances[a.id] ?? 0,
    }));

    const byCard: ClosingCardRow[] = params.cards.map((c) => {
      const rows = inMonth.filter(
        (m) =>
          m.card_id === c.id &&
          m.type !== MovementType.CARD_PAYMENT &&
          m.type !== MovementType.TRANSFER,
      );
      return {
        id: c.id,
        label: c.name,
        amount: rows.reduce((s, m) => s + Number(m.amount), 0),
        count: rows.length,
      };
    });

    const transfersRows = inMonth.filter((m) => m.type === MovementType.TRANSFER);

    const snapshot: ClosingSnapshot = {
      version: 1,
      generated_at: new Date().toISOString(),
      period: { year, month, start: range.start, end: range.end },
      totals,
      quality: {
        movements: inMonth.length,
        imports: params.importsCount,
        uncategorized: inMonth.filter(
          (m) =>
            !m.category_id &&
            m.type !== MovementType.TRANSFER &&
            m.type !== MovementType.CARD_PAYMENT,
        ).length,
        duplicates: params.duplicatesCount,
        ruleConflicts: params.ruleConflicts,
        ruleDuplicates: params.ruleDuplicates,
      },
      health: params.health,
      insights: params.insights,
      insights_summary: params.insightsSummary,
      byCategory,
      bySubcategory,
      byAccount,
      byCard,
      cards: byCard,
      investments: {
        total: PatrimonyServiceImpl.totalAssetsValue(params.assets),
        profit: PatrimonyServiceImpl.totalAssetProfit(params.assets),
        count: params.assets.filter((a) => a.is_active && !a.deleted_at).length,
        contributions: inMonth
          .filter((m) => m.type === MovementType.INVESTMENT)
          .reduce((s, m) => s + Number(m.amount), 0),
      },
      budget: MonthlyBudgetService.toClosingBudget(params.budget ?? null),
      transfers: {
        count: transfersRows.length,
        amount: transfersRows.reduce((s, m) => s + Number(m.amount), 0),
      },
    };

    return snapshot;
  }

  // ------------------------------------------------------------------
  // Validações (avisos — nunca bloqueiam)
  // ------------------------------------------------------------------
  validate(snapshot: ClosingSnapshot): ClosingWarning[] {
    const q = snapshot.quality;
    const out: ClosingWarning[] = [];
    if (q.duplicates > 0)
      out.push({ key: "duplicates", label: "Duplicidades pendentes de revisão", count: q.duplicates });
    if (q.uncategorized > 0)
      out.push({
        key: "uncategorized",
        label: "Lançamentos sem categoria no período",
        count: q.uncategorized,
      });
    if (q.ruleConflicts > 0)
      out.push({ key: "ruleConflicts", label: "Regras conflitantes", count: q.ruleConflicts });
    if (q.ruleDuplicates > 0)
      out.push({ key: "ruleDuplicates", label: "Regras duplicadas", count: q.ruleDuplicates });
    if (snapshot.health.issues > 0)
      out.push({
        key: "health",
        label: "Alertas no Health Check de integridade",
        count: snapshot.health.issues,
      });
    if (snapshot.insights_summary.critical > 0)
      out.push({
        key: "insights",
        label: "Insights críticos em aberto",
        count: snapshot.insights_summary.critical,
      });
    return out;
  }

  /**
   * O fechamento está desatualizado quando alguma movimentação do período foi
   * criada/alterada depois do fechamento. Nunca alteramos o snapshot: apenas
   * sinalizamos para o usuário refazer o fechamento.
   */
  isStale(closing: MonthlyClosing, movements: Movement[]): boolean {
    if (!closing.closed_at) return false;
    const { start, end } = this.periodRange(closing.year, closing.month);
    const closedAt = new Date(closing.closed_at).getTime();
    return movements.some(
      (m) =>
        this.inPeriod(m, start, end) &&
        new Date(m.updated_at).getTime() > closedAt,
    );
  }

  // ------------------------------------------------------------------
  // Comparação entre fechamentos
  // ------------------------------------------------------------------
  compareClosing(current: MonthlyClosing, previous: MonthlyClosing): ClosingComparison {
    const a = current.snapshot_json.totals;
    const b = previous.snapshot_json.totals;
    const row = (key: string, label: string, cur: number, prev: number): ClosingComparisonRow => ({
      key,
      label,
      current: cur,
      previous: prev,
      delta: cur - prev,
      percent: prev === 0 ? null : ((cur - prev) / Math.abs(prev)) * 100,
    });
    return {
      from: { year: previous.year, month: previous.month },
      to: { year: current.year, month: current.month },
      rows: [
        row("income", "Receitas", a.income, b.income),
        row("expense", "Despesas", a.expense, b.expense),
        row("result", "Resultado", a.result, b.result),
        row("netWorth", "Patrimônio líquido", a.netWorth, b.netWorth),
        row("liabilities", "Passivo", a.liabilities, b.liabilities),
      ],
    };
  }

  // ------------------------------------------------------------------
  // Persistência
  // ------------------------------------------------------------------
  private map(row: ClosingRow): MonthlyClosing {
    return {
      ...row,
      snapshot_json: (row.snapshot_json ?? {}) as ClosingSnapshot,
    } as MonthlyClosing;
  }

  async list(workspaceId: UUID): Promise<MonthlyClosing[]> {
    const { data, error } = await this.client
      .from("monthly_closings")
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("year", { ascending: false })
      .order("month", { ascending: false });
    if (error) this.handleError(error, "list");
    return ((data ?? []) as unknown as ClosingRow[]).map((r) => this.map(r));
  }

  async get(workspaceId: UUID, year: number, month: number): Promise<MonthlyClosing | null> {
    const { data, error } = await this.client
      .from("monthly_closings")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("year", year)
      .eq("month", month)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) this.handleError(error, "get");
    return data ? this.map(data as unknown as ClosingRow) : null;
  }

  async listEvents(closingId: UUID): Promise<ClosingEvent[]> {
    const { data, error } = await this.client
      .from("monthly_closing_events")
      .select("*")
      .eq("closing_id", closingId)
      .order("created_at", { ascending: false });
    if (error) this.handleError(error, "listEvents");
    return (data ?? []) as unknown as ClosingEvent[];
  }

  private async recordEvent(params: {
    closingId: UUID;
    workspaceId: UUID;
    event: ClosingEvent["event"];
    reason?: string | null;
    performedBy?: UUID | null;
  }) {
    const { error } = await this.client.from("monthly_closing_events").insert({
      closing_id: params.closingId,
      workspace_id: params.workspaceId,
      event: params.event,
      reason: params.reason ?? null,
      performed_by: params.performedBy ?? null,
    } as never);
    if (error) this.handleError(error, "recordEvent");
  }

  /** Fecha (ou refecha) o mês gravando um novo snapshot. */
  async close(params: {
    workspaceId: UUID;
    year: number;
    month: number;
    snapshot: ClosingSnapshot;
    notes?: string | null;
    performedBy?: UUID | null;
  }): Promise<MonthlyClosing> {
    const existing = await this.get(params.workspaceId, params.year, params.month);
    const payload = {
      workspace_id: params.workspaceId,
      year: params.year,
      month: params.month,
      status: "CLOSED",
      closed_at: new Date().toISOString(),
      closed_by: params.performedBy ?? null,
      notes: params.notes ?? null,
      snapshot_json: params.snapshot as unknown,
    };

    const query = existing
      ? this.client.from("monthly_closings").update(payload as never).eq("id", existing.id)
      : this.client.from("monthly_closings").insert(payload as never);

    const { data, error } = await query.select("*").single();
    if (error) this.handleError(error, "close");

    const closing = this.map(data as unknown as ClosingRow);
    await this.recordEvent({
      closingId: closing.id,
      workspaceId: params.workspaceId,
      event: existing ? "RECLOSED" : "CLOSED",
      reason: params.notes ?? null,
      performedBy: params.performedBy ?? null,
    });
    return closing;
  }

  /** Reabre um fechamento — o snapshot antigo permanece intacto. */
  async reopen(params: {
    closing: MonthlyClosing;
    reason: string;
    performedBy?: UUID | null;
  }): Promise<MonthlyClosing> {
    const { data, error } = await this.client
      .from("monthly_closings")
      .update({
        status: "OPEN",
        reopened_at: new Date().toISOString(),
        reopened_by: params.performedBy ?? null,
        reopen_reason: params.reason,
      } as never)
      .eq("id", params.closing.id)
      .select("*")
      .single();
    if (error) this.handleError(error, "reopen");

    await this.recordEvent({
      closingId: params.closing.id,
      workspaceId: params.closing.workspace_id,
      event: "REOPENED",
      reason: params.reason,
      performedBy: params.performedBy ?? null,
    });
    return this.map(data as unknown as ClosingRow);
  }
}

export const MonthlyClosingService = new MonthlyClosingServiceImpl();
export { MonthlyClosingServiceImpl };
