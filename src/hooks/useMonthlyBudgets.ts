// Hooks do Planejamento Mensal — apenas orquestração de dados e cache.
// Toda regra financeira vive no MonthlyBudgetService.
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "./useWorkspace";
import { useAllMovements } from "./useMovements";
import { useCategories, useSubcategories } from "./useCategories";
import { MonthlyBudgetService } from "@/services/MonthlyBudgetService";
import { MonthlyClosingService } from "@/services/MonthlyClosingService";
import type { UUID } from "@/models";
import type {
  BudgetComparison,
  BudgetItemDraft,
  BudgetMode,
  BudgetSuggestionSource,
  MonthlyBudget,
  MonthlyBudgetItem,
} from "@/models/MonthlyBudget";

const KEY = "monthly-budgets";
const ITEMS_KEY = "monthly-budget-items";

export function useMonthlyBudgets(workspaceId: UUID | undefined) {
  return useQuery({
    queryKey: [KEY, workspaceId],
    queryFn: () => MonthlyBudgetService.list(workspaceId as UUID),
    enabled: !!workspaceId,
  });
}

export function useBudgetItems(workspaceId: UUID | undefined) {
  return useQuery({
    queryKey: [ITEMS_KEY, workspaceId],
    queryFn: () => MonthlyBudgetService.listItems(workspaceId as UUID),
    enabled: !!workspaceId,
  });
}

function itemsOf(items: MonthlyBudgetItem[], budgetId: UUID | null | undefined) {
  if (!budgetId) return [];
  return items.filter((i) => i.budget_id === budgetId && !i.deleted_at);
}

/** Orçamento vigente do período (ativo > rascunho mais recente). */
export function pickBudget(budgets: MonthlyBudget[], year: number, month: number) {
  const scoped = budgets.filter((b) => b.year === year && b.month === month);
  return (
    scoped.find((b) => b.status === "ACTIVE") ??
    scoped.find((b) => b.status === "DRAFT") ??
    scoped[0] ??
    null
  );
}

export interface MonthlyBudgetState {
  budget: MonthlyBudget | null;
  budgets: MonthlyBudget[];
  items: MonthlyBudgetItem[];
  allItems: MonthlyBudgetItem[];
  comparison: BudgetComparison | null;
  isLoading: boolean;
}

/**
 * Estado completo do Planejamento de um período: orçamento + comparação
 * Planejado x Realizado (sempre recalculada, nunca persistida).
 */
export function useMonthlyBudget(
  year: number,
  month: number,
  modeOverride?: BudgetMode,
): MonthlyBudgetState {
  const { data: ws } = useWorkspace();
  const wsId = ws?.id as string | undefined;

  const budgetsQ = useMonthlyBudgets(wsId);
  const itemsQ = useBudgetItems(wsId);
  const movementsQ = useAllMovements(wsId);
  const categoriesQ = useCategories(wsId);
  const subcategoriesQ = useSubcategories(wsId);

  const budgets = useMemo(() => budgetsQ.data ?? [], [budgetsQ.data]);
  const allItems = useMemo(() => itemsQ.data ?? [], [itemsQ.data]);
  const budget = useMemo(() => pickBudget(budgets, year, month), [budgets, year, month]);
  const items = useMemo(() => itemsOf(allItems, budget?.id), [allItems, budget?.id]);

  const comparison = useMemo(() => {
    const categories = categoriesQ.data ?? [];
    const subcategories = subcategoriesQ.data ?? [];
    const movements = movementsQ.data ?? [];
    if (categories.length === 0 && movements.length === 0 && !budget) return null;
    return MonthlyBudgetService.compare({
      year,
      month,
      mode: modeOverride ?? budget?.mode ?? "SIMPLE",
      budgetId: budget?.id ?? null,
      items,
      movements,
      categories,
      subcategories,
    });
  }, [
    year,
    month,
    modeOverride,
    budget,
    items,
    movementsQ.data,
    categoriesQ.data,
    subcategoriesQ.data,
  ]);

  return {
    budget,
    budgets,
    items,
    allItems,
    comparison,
    isLoading:
      budgetsQ.isLoading || itemsQ.isLoading || movementsQ.isLoading || categoriesQ.isLoading,
  };
}

/** Rascunhos sugeridos automaticamente para um novo orçamento. */
export function useBudgetSuggestion(
  year: number,
  month: number,
  mode: BudgetMode,
  source: BudgetSuggestionSource,
): BudgetItemDraft[] {
  const { data: ws } = useWorkspace();
  const wsId = ws?.id as string | undefined;
  const { data: budgets = [] } = useMonthlyBudgets(wsId);
  const { data: allItems = [] } = useBudgetItems(wsId);
  // Consulta direta ao Service para evitar dependência cíclica entre hooks.
  const { data: closings = [] } = useQuery({
    queryKey: ["monthly-closings", wsId],
    queryFn: () => MonthlyClosingService.list(wsId as UUID),
    enabled: !!wsId,
  });

  return useMemo(() => {
    const prevRef = new Date(year, month - 2, 1);
    const previous = pickBudget(budgets, prevRef.getFullYear(), prevRef.getMonth() + 1);
    const lastActive =
      budgets.find((b) => b.status === "ACTIVE" && !(b.year === year && b.month === month)) ?? null;

    return MonthlyBudgetService.buildSuggestion({
      source,
      mode,
      previousItems: itemsOf(allItems, previous?.id),
      lastActiveItems: itemsOf(allItems, lastActive?.id),
      closings,
    });
  }, [year, month, mode, source, budgets, allItems, closings]);
}

function useInvalidateBudgets() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: [KEY] });
    qc.invalidateQueries({ queryKey: [ITEMS_KEY] });
  };
}

export function useCreateBudget() {
  const invalidate = useInvalidateBudgets();
  return useMutation({
    mutationFn: (vars: {
      workspaceId: UUID;
      year: number;
      month: number;
      mode: BudgetMode;
      name?: string;
      notes?: string | null;
      status?: MonthlyBudget["status"];
      items?: BudgetItemDraft[];
    }) => MonthlyBudgetService.create(vars),
    onSuccess: invalidate,
  });
}

export function useDuplicateBudget() {
  const invalidate = useInvalidateBudgets();
  return useMutation({
    mutationFn: (vars: {
      source: MonthlyBudget;
      items: MonthlyBudgetItem[];
      year: number;
      month: number;
    }) => MonthlyBudgetService.duplicate(vars),
    onSuccess: invalidate,
  });
}

export function useSaveBudgetItems() {
  const invalidate = useInvalidateBudgets();
  return useMutation({
    mutationFn: (vars: { budgetId: UUID; workspaceId: UUID; items: BudgetItemDraft[] }) =>
      MonthlyBudgetService.replaceItems(vars.budgetId, vars.workspaceId, vars.items),
    onSuccess: invalidate,
  });
}

export function useActivateBudget() {
  const invalidate = useInvalidateBudgets();
  return useMutation({
    mutationFn: (budget: MonthlyBudget) => MonthlyBudgetService.activate(budget),
    onSuccess: invalidate,
  });
}

export function useCloseBudget() {
  const invalidate = useInvalidateBudgets();
  return useMutation({
    mutationFn: (id: UUID) => MonthlyBudgetService.closeBudget(id),
    onSuccess: invalidate,
  });
}

export function useUpdateBudget() {
  const invalidate = useInvalidateBudgets();
  return useMutation({
    mutationFn: (vars: {
      id: UUID;
      input: Partial<Pick<MonthlyBudget, "name" | "notes" | "mode" | "status">>;
    }) => MonthlyBudgetService.update(vars.id, vars.input),
    onSuccess: invalidate,
  });
}

export function useDeleteBudget() {
  const invalidate = useInvalidateBudgets();
  return useMutation({
    mutationFn: (id: UUID) => MonthlyBudgetService.remove(id),
    onSuccess: invalidate,
  });
}
