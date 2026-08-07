// MonthlyBudgetService — Planejamento Mensal (Sprint 4.3).
// Toda a regra financeira do orçamento vive aqui.
// REGRAS:
//  • O banco guarda apenas o valor PLANEJADO.
//  • O REALIZADO é sempre recalculado a partir das movimentações, por
//    COMPETÊNCIA (nunca por data de pagamento), reutilizando o DashboardService.
//  • Nenhum indicador derivado é persistido.
import { BaseService } from "./BaseService";
import { DashboardService } from "./DashboardService";
import { CategoryType } from "@/constants/enums";
import { toISODate } from "@/lib/format";
import type { Category, Movement, Subcategory, UUID } from "@/models";
import type { MonthlyClosing } from "@/models/MonthlyClosing";
import type {
  BudgetCategoryGroup,
  BudgetComparison,
  BudgetDrillDown,
  BudgetItemDraft,
  BudgetKpis,
  BudgetLine,
  BudgetLineKind,
  BudgetMode,
  BudgetSideTotals,
  BudgetSortKey,
  BudgetStatusLevel,
  BudgetSuggestionSource,
  BudgetSummary,
  ClosingBudget,
  MonthlyBudget,
  MonthlyBudgetItem,
} from "@/models/MonthlyBudget";


export interface CompareParams {
  year: number;
  month: number;
  mode: BudgetMode;
  budgetId?: UUID | null;
  items: MonthlyBudgetItem[];
  movements: Movement[];
  categories: Pick<Category, "id" | "name" | "type">[];
  subcategories: Pick<Subcategory, "id" | "name" | "category_id">[];
}

interface BudgetRow {
  id: UUID;
  workspace_id: UUID;
  year: number;
  month: number;
  status: MonthlyBudget["status"];
  mode: BudgetMode;
  name: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

const EMPTY_SIDE: BudgetSideTotals = {
  planned: 0,
  actual: 0,
  difference: 0,
  percent: null,
  remaining: 0,
};

class MonthlyBudgetServiceImpl extends BaseService {
  // ------------------------------------------------------------------
  // Período (competência)
  // ------------------------------------------------------------------
  periodRange(year: number, month: number) {
    return {
      start: toISODate(new Date(year, month - 1, 1)),
      end: toISODate(new Date(year, month, 0)),
    };
  }

  // ------------------------------------------------------------------
  // Cálculos puros
  // ------------------------------------------------------------------
  /** Percentual consumido do planejado (null quando não há planejado). */
  percentUsed(planned: number, actual: number): number | null {
    if (planned <= 0) return null;
    return (actual / planned) * 100;
  }

  /** Saldo restante do planejado — nunca negativo. */
  remaining(planned: number, actual: number): number {
    return Math.max(planned - actual, 0);
  }

  private kindOf(
    categoryId: UUID | null,
    categories: Pick<Category, "id" | "name" | "type">[],
  ): BudgetLineKind {
    const cat = categories.find((c) => c.id === categoryId);
    return cat?.type === CategoryType.INCOME ? "INCOME" : "EXPENSE";
  }

  private toMap(rows: { id: UUID | null; amount: number }[]): Map<string, number> {
    const map = new Map<string, number>();
    for (const r of rows) {
      if (!r.id) continue;
      map.set(r.id, (map.get(r.id) ?? 0) + r.amount);
    }
    return map;
  }

  private line(params: {
    itemId: UUID | null;
    categoryId: UUID | null;
    subcategoryId: UUID | null;
    categoryName: string;
    subcategoryName: string | null;
    kind: BudgetLineKind;
    planned: number;
    actual: number;
  }): BudgetLine {
    const { planned, actual } = params;
    return {
      key: `${params.categoryId ?? "none"}:${params.subcategoryId ?? "all"}`,
      itemId: params.itemId,
      categoryId: params.categoryId,
      subcategoryId: params.subcategoryId,
      categoryName: params.categoryName,
      subcategoryName: params.subcategoryName,
      kind: params.kind,
      planned,
      actual,
      difference: planned - actual,
      percent: this.percentUsed(planned, actual),
      remaining: this.remaining(planned, actual),
      over: planned > 0 && actual > planned,
    };
  }

  /** Comparação Planejado x Realizado do período. */
  compare(params: CompareParams): BudgetComparison {
    const range = this.periodRange(params.year, params.month);
    const advanced = params.mode === "ADVANCED";

    const expenseByCat = this.toMap(
      DashboardService.expensesByCategoryInRange(params.movements, range),
    );
    const incomeByCat = this.toMap(
      DashboardService.incomeByCategory(params.movements, range),
    );
    const expenseBySub = this.toMap(
      DashboardService.expensesBySubcategoryInRange(params.movements, range),
    );
    const incomeBySub = this.toMap(
      DashboardService.incomeBySubcategory(params.movements, range),
    );

    const catName = new Map(params.categories.map((c) => [c.id, c.name]));
    const subName = new Map(params.subcategories.map((s) => [s.id, s.name]));
    const subParent = new Map(params.subcategories.map((s) => [s.id, s.category_id]));

    const lines: BudgetLine[] = [];
    const usedCats = new Set<string>();
    const usedSubs = new Set<string>();

    const activeItems = params.items.filter((i) => !i.deleted_at);

    for (const item of activeItems) {
      const kind = this.kindOf(item.category_id, params.categories);
      const useSub = advanced && !!item.subcategory_id;
      const actual = useSub
        ? (kind === "INCOME" ? incomeBySub : expenseBySub).get(item.subcategory_id as string) ?? 0
        : (kind === "INCOME" ? incomeByCat : expenseByCat).get(item.category_id as string) ?? 0;

      if (useSub) usedSubs.add(item.subcategory_id as string);
      else if (item.category_id) usedCats.add(item.category_id);

      lines.push(
        this.line({
          itemId: item.id,
          categoryId: item.category_id,
          subcategoryId: useSub ? item.subcategory_id : null,
          categoryName: catName.get(item.category_id ?? "") ?? "Sem categoria",
          subcategoryName: useSub ? subName.get(item.subcategory_id as string) ?? null : null,
          kind,
          planned: Number(item.planned_amount) || 0,
          actual,
        }),
      );
    }

    // Realizado sem planejamento — exibido para dar visibilidade total.
    const pushUnplanned = (
      map: Map<string, number>,
      kind: BudgetLineKind,
      bySub: boolean,
    ) => {
      for (const [id, amount] of map) {
        if (amount <= 0) continue;
        if (bySub) {
          if (usedSubs.has(id)) continue;
          const parent = subParent.get(id) ?? null;
          if (parent && usedCats.has(parent)) continue;
          lines.push(
            this.line({
              itemId: null,
              categoryId: parent,
              subcategoryId: id,
              categoryName: catName.get(parent ?? "") ?? "Sem categoria",
              subcategoryName: subName.get(id) ?? null,
              kind,
              planned: 0,
              actual: amount,
            }),
          );
        } else {
          if (usedCats.has(id)) continue;
          lines.push(
            this.line({
              itemId: null,
              categoryId: id,
              subcategoryId: null,
              categoryName: catName.get(id) ?? "Sem categoria",
              subcategoryName: null,
              kind,
              planned: 0,
              actual: amount,
            }),
          );
        }
      }
    };

    if (advanced) {
      pushUnplanned(expenseBySub, "EXPENSE", true);
      pushUnplanned(incomeBySub, "INCOME", true);
    } else {
      pushUnplanned(expenseByCat, "EXPENSE", false);
      pushUnplanned(incomeByCat, "INCOME", false);
    }

    return {
      budgetId: params.budgetId ?? null,
      year: params.year,
      month: params.month,
      mode: params.mode,
      lines,
      summary: this.summarize(lines),
    };
  }

  private side(lines: BudgetLine[]): BudgetSideTotals {
    if (lines.length === 0) return { ...EMPTY_SIDE };
    const planned = lines.reduce((s, l) => s + l.planned, 0);
    const actual = lines.reduce((s, l) => s + l.actual, 0);
    return {
      planned,
      actual,
      difference: planned - actual,
      percent: this.percentUsed(planned, actual),
      remaining: this.remaining(planned, actual),
    };
  }

  /** Resumo executivo do orçamento. */
  summarize(lines: BudgetLine[]): BudgetSummary {
    const expenses = lines.filter((l) => l.kind === "EXPENSE");
    const incomes = lines.filter((l) => l.kind === "INCOME");
    return {
      expense: this.side(expenses),
      income: this.side(incomes),
      overCount: expenses.filter((l) => l.over).length,
      warningCount: expenses.filter(
        (l) => !l.over && l.percent !== null && l.percent >= 80,
      ).length,
      lines: lines.length,
    };
  }

  /** Ordenação das linhas para a tela (regra de negócio, não de UI). */
  sortLines(lines: BudgetLine[], key: BudgetSortKey): BudgetLine[] {
    const copy = [...lines];
    if (key === "PLANNED") return copy.sort((a, b) => b.planned - a.planned);
    if (key === "DEVIATION")
      return copy.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
    return copy.sort((a, b) => b.actual - a.actual);
  }

  // ------------------------------------------------------------------
  // Sprint 4.3.1 — status, KPIs, consolidação e drill down
  // ------------------------------------------------------------------
  /** Semáforo de utilização: até 80% OK, 80–100% atenção, acima disso estouro. */
  statusLevel(percent: number | null): BudgetStatusLevel {
    if (percent === null) return "OK";
    if (percent > 100) return "OVER";
    if (percent >= 80) return "WARNING";
    return "OK";
  }

  /** Dias do período e quantos já decorreram até a data de referência. */
  periodDays(year: number, month: number, today = new Date()) {
    const daysTotal = new Date(year, month, 0).getDate();
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month - 1, daysTotal);
    const ref = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    let daysElapsed: number;
    if (ref < start) daysElapsed = 0;
    else if (ref > end) daysElapsed = daysTotal;
    else daysElapsed = ref.getDate();
    return { daysTotal, daysElapsed, daysRemaining: daysTotal - daysElapsed };
  }

  /** KPIs executivos de um lado do orçamento (despesas ou receitas). */
  kpis(
    side: BudgetSideTotals,
    params: { year: number; month: number; today?: Date },
  ): BudgetKpis {
    const { daysTotal, daysElapsed, daysRemaining } = this.periodDays(
      params.year,
      params.month,
      params.today ?? new Date(),
    );
    const dailyAverage = daysElapsed > 0 ? side.actual / daysElapsed : 0;
    const projection = daysElapsed > 0 ? dailyAverage * daysTotal : side.actual;
    return {
      planned: side.planned,
      actual: side.actual,
      difference: side.difference,
      remaining: side.remaining,
      percent: side.percent,
      daysTotal,
      daysElapsed,
      daysRemaining,
      dailyAverage,
      projection,
      projectionPercent: this.percentUsed(side.planned, projection),
      status: this.statusLevel(side.percent),
    };
  }

  /**
   * Consolida as linhas por categoria mantendo as subcategorias como filhas.
   * Uma única estrutura hierárquica — a UI apenas expande/recolhe em memória.
   */
  groupByCategory(lines: BudgetLine[], sort: BudgetSortKey = "SPENT"): BudgetCategoryGroup[] {
    const map = new Map<string, BudgetCategoryGroup>();

    for (const line of lines) {
      const key = `${line.kind}:${line.categoryId ?? "none"}`;
      let group = map.get(key);
      if (!group) {
        group = {
          key,
          categoryId: line.categoryId,
          categoryName: line.categoryName,
          kind: line.kind,
          planned: 0,
          actual: 0,
          difference: 0,
          percent: null,
          remaining: 0,
          over: false,
          status: "OK",
          children: [],
        };
        map.set(key, group);
      }
      group.planned += line.planned;
      group.actual += line.actual;
      if (line.subcategoryId) group.children.push(line);
    }

    const groups = Array.from(map.values()).map((g) => {
      const percent = this.percentUsed(g.planned, g.actual);
      return {
        ...g,
        difference: g.planned - g.actual,
        percent,
        remaining: this.remaining(g.planned, g.actual),
        over: g.planned > 0 && g.actual > g.planned,
        status: this.statusLevel(percent),
        children: this.sortLines(g.children, sort),
      };
    });

    if (sort === "PLANNED") return groups.sort((a, b) => b.planned - a.planned);
    if (sort === "DEVIATION")
      return groups.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
    return groups.sort((a, b) => b.actual - a.actual);
  }

  /** Deep link para o extrato filtrado por competência do período. */
  drillDown(params: {
    year: number;
    month: number;
    categoryId?: UUID | null;
    subcategoryId?: UUID | null;
  }): BudgetDrillDown {
    const range = this.periodRange(params.year, params.month);
    return {
      to: "/movimentacoes",
      search: {
        ...(params.categoryId ? { category: params.categoryId } : {}),
        ...(params.subcategoryId ? { subcategory: params.subcategoryId } : {}),
        from: range.start,
        to: range.end,
      },
    };
  }


  /** Bloco congelado no Fechamento Mensal — nunca recalculado depois. */
  toClosingBudget(comparison: BudgetComparison | null): ClosingBudget {
    if (!comparison) {
      return {
        budgetId: null,
        mode: null,
        planned: 0,
        actual: 0,
        difference: 0,
        percent: null,
        lines: [],
      };
    }
    const e = comparison.summary.expense;
    return {
      budgetId: comparison.budgetId,
      mode: comparison.mode,
      planned: e.planned,
      actual: e.actual,
      difference: e.difference,
      percent: e.percent,
      lines: comparison.lines.map((l) => ({
        categoryId: l.subcategoryId ?? l.categoryId,
        label: l.subcategoryName ? `${l.categoryName} › ${l.subcategoryName}` : l.categoryName,
        kind: l.kind,
        planned: l.planned,
        actual: l.actual,
        difference: l.difference,
        percent: l.percent,
      })),
    };
  }

  // ------------------------------------------------------------------
  // Sugestões automáticas
  // ------------------------------------------------------------------
  /** Converte itens existentes em rascunhos (duplicação/cópia). */
  draftsFromItems(items: MonthlyBudgetItem[], mode: BudgetMode): BudgetItemDraft[] {
    const advanced = mode === "ADVANCED";
    const map = new Map<string, BudgetItemDraft>();
    for (const i of items) {
      if (i.deleted_at) continue;
      const subId = advanced ? i.subcategory_id : null;
      const key = `${i.category_id ?? "none"}:${subId ?? "all"}`;
      const current = map.get(key);
      const amount = Number(i.planned_amount) || 0;
      if (current) current.planned_amount += amount;
      else
        map.set(key, {
          category_id: i.category_id,
          subcategory_id: subId,
          planned_amount: amount,
          goal_kind: i.goal_kind ?? null,
        });
    }
    return Array.from(map.values());
  }

  /**
   * Média dos últimos N fechamentos (fonte: snapshots do MonthlyClosingService).
   * Snapshots são imutáveis — aqui apenas lemos os valores congelados.
   */
  draftsFromClosings(
    closings: MonthlyClosing[],
    count: number,
    mode: BudgetMode,
  ): BudgetItemDraft[] {
    const advanced = mode === "ADVANCED";
    const used = closings
      .filter((c) => !!c.snapshot_json)
      .slice(0, count);
    if (used.length === 0) return [];

    const totals = new Map<string, { id: string | null; sum: number }>();
    const add = (id: string | null, amount: number) => {
      if (!id || amount <= 0) return;
      const cur = totals.get(id);
      if (cur) cur.sum += amount;
      else totals.set(id, { id, sum: amount });
    };

    for (const c of used) {
      const snap = c.snapshot_json;
      const breakdown = advanced ? snap.bySubcategory : snap.byCategory;
      for (const row of breakdown?.expense ?? []) add(row.id, row.amount);
      for (const row of breakdown?.income ?? []) add(row.id, row.amount);
    }

    return Array.from(totals.values()).map((t) => ({
      category_id: advanced ? null : (t.id as UUID),
      subcategory_id: advanced ? (t.id as UUID) : null,
      planned_amount: Math.round((t.sum / used.length) * 100) / 100,
    }));
  }

  /** Resolve a estratégia escolhida em rascunhos de itens. */
  buildSuggestion(params: {
    source: BudgetSuggestionSource;
    mode: BudgetMode;
    previousItems?: MonthlyBudgetItem[];
    lastActiveItems?: MonthlyBudgetItem[];
    closings?: MonthlyClosing[];
  }): BudgetItemDraft[] {
    switch (params.source) {
      case "PREVIOUS_MONTH":
        return this.draftsFromItems(params.previousItems ?? [], params.mode);
      case "LAST_ACTIVE":
        return this.draftsFromItems(params.lastActiveItems ?? [], params.mode);
      case "AVERAGE_3":
        return this.draftsFromClosings(params.closings ?? [], 3, params.mode);
      case "AVERAGE_6":
        return this.draftsFromClosings(params.closings ?? [], 6, params.mode);
      default:
        return [];
    }
  }

  // ------------------------------------------------------------------
  // Persistência
  // ------------------------------------------------------------------
  private map(row: BudgetRow): MonthlyBudget {
    return row as MonthlyBudget;
  }

  async list(workspaceId: UUID): Promise<MonthlyBudget[]> {
    const { data, error } = await this.client
      .from("monthly_budgets")
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("year", { ascending: false })
      .order("month", { ascending: false });
    if (error) this.handleError(error, "list");
    return ((data ?? []) as unknown as BudgetRow[]).map((r) => this.map(r));
  }

  async listItems(workspaceId: UUID): Promise<MonthlyBudgetItem[]> {
    const { data, error } = await this.client
      .from("monthly_budget_items")
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null);
    if (error) this.handleError(error, "listItems");
    return (data ?? []) as unknown as MonthlyBudgetItem[];
  }

  async create(params: {
    workspaceId: UUID;
    year: number;
    month: number;
    mode: BudgetMode;
    name?: string;
    notes?: string | null;
    status?: MonthlyBudget["status"];
    items?: BudgetItemDraft[];
  }): Promise<MonthlyBudget> {
    const { data, error } = await this.client
      .from("monthly_budgets")
      .insert({
        workspace_id: params.workspaceId,
        year: params.year,
        month: params.month,
        mode: params.mode,
        status: params.status ?? "DRAFT",
        name: params.name?.trim() || "Planejamento",
        notes: params.notes ?? null,
      } as never)
      .select("*")
      .single();
    if (error) this.handleError(error, "create");
    const budget = this.map(data as unknown as BudgetRow);

    const items = (params.items ?? []).filter((i) => i.planned_amount > 0);
    if (items.length > 0) {
      await this.replaceItems(budget.id, params.workspaceId, items);
    }
    return budget;
  }

  /** Substitui todos os itens do orçamento (soft delete + insert). */
  async replaceItems(
    budgetId: UUID,
    workspaceId: UUID,
    items: BudgetItemDraft[],
  ): Promise<void> {
    const { error: delError } = await this.client
      .from("monthly_budget_items")
      .delete()
      .eq("budget_id", budgetId);
    if (delError) this.handleError(delError, "replaceItems:delete");

    const rows = items
      .filter((i) => (i.category_id || i.subcategory_id) && i.planned_amount > 0)
      .map((i) => ({
        budget_id: budgetId,
        workspace_id: workspaceId,
        category_id: i.category_id,
        subcategory_id: i.subcategory_id,
        planned_amount: i.planned_amount,
        goal_kind: i.goal_kind ?? null,
      }));
    if (rows.length === 0) return;

    const { error } = await this.client
      .from("monthly_budget_items")
      .insert(rows as never);
    if (error) this.handleError(error, "replaceItems:insert");
  }

  /** Duplica um orçamento para outro período. */
  async duplicate(params: {
    source: MonthlyBudget;
    items: MonthlyBudgetItem[];
    year: number;
    month: number;
    name?: string;
  }): Promise<MonthlyBudget> {
    return this.create({
      workspaceId: params.source.workspace_id,
      year: params.year,
      month: params.month,
      mode: params.source.mode,
      name: params.name ?? params.source.name,
      notes: params.source.notes,
      items: this.draftsFromItems(params.items, params.source.mode),
    });
  }

  private async setStatus(id: UUID, status: MonthlyBudget["status"]) {
    const { data, error } = await this.client
      .from("monthly_budgets")
      .update({ status } as never)
      .eq("id", id)
      .select("*")
      .single();
    if (error) this.handleError(error, "setStatus");
    return this.map(data as unknown as BudgetRow);
  }

  /** Ativa o orçamento — apenas um ativo por período. */
  async activate(budget: MonthlyBudget): Promise<MonthlyBudget> {
    const { error } = await this.client
      .from("monthly_budgets")
      .update({ status: "CLOSED" } as never)
      .eq("workspace_id", budget.workspace_id)
      .eq("year", budget.year)
      .eq("month", budget.month)
      .eq("status", "ACTIVE")
      .neq("id", budget.id);
    if (error) this.handleError(error, "activate");
    return this.setStatus(budget.id, "ACTIVE");
  }

  /** Encerra o orçamento. */
  async closeBudget(id: UUID): Promise<MonthlyBudget> {
    return this.setStatus(id, "CLOSED");
  }

  async update(
    id: UUID,
    input: Partial<Pick<MonthlyBudget, "name" | "notes" | "mode" | "status">>,
  ): Promise<MonthlyBudget> {
    const { data, error } = await this.client
      .from("monthly_budgets")
      .update(input as never)
      .eq("id", id)
      .select("*")
      .single();
    if (error) this.handleError(error, "update");
    return this.map(data as unknown as BudgetRow);
  }

  /** Exclusão lógica — nunca remove fisicamente. */
  async remove(id: UUID): Promise<void> {
    const { error } = await this.client
      .from("monthly_budgets")
      .update({ deleted_at: new Date().toISOString() } as never)
      .eq("id", id);
    if (error) this.handleError(error, "remove");
  }
}

export const MonthlyBudgetService = new MonthlyBudgetServiceImpl();
export { MonthlyBudgetServiceImpl };
