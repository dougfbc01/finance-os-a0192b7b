// Modelo do Planejamento Mensal (Sprint 4.3).
// REGRA: o orçamento grava APENAS o valor planejado. O realizado é sempre
// calculado em tempo real pelos Services a partir das movimentações.
import type { UUID, ISODateString } from "./index";

export type BudgetStatus = "DRAFT" | "ACTIVE" | "CLOSED";
export type BudgetMode = "SIMPLE" | "ADVANCED";

/** Reservado para a futura Sprint de Metas Financeiras (não implementada). */
export type BudgetGoalKind = "SAVINGS" | "INVESTMENT" | "NET_WORTH" | "RESERVE";

/** Natureza da linha, derivada do tipo da categoria. */
export type BudgetLineKind = "INCOME" | "EXPENSE";

export interface MonthlyBudget {
  id: UUID;
  workspace_id: UUID;
  year: number;
  month: number;
  status: BudgetStatus;
  mode: BudgetMode;
  name: string;
  notes: string | null;
  created_at: ISODateString;
  updated_at: ISODateString;
  deleted_at: ISODateString | null;
}

export interface MonthlyBudgetItem {
  id: UUID;
  budget_id: UUID;
  workspace_id: UUID;
  category_id: UUID | null;
  subcategory_id: UUID | null;
  planned_amount: number;
  goal_kind: BudgetGoalKind | null;
  notes: string | null;
  created_at: ISODateString;
  updated_at: ISODateString;
  deleted_at: ISODateString | null;
}

/** Item enviado para criação/duplicação/sugestão (sem persistência ainda). */
export interface BudgetItemDraft {
  category_id: UUID | null;
  subcategory_id: UUID | null;
  planned_amount: number;
  goal_kind?: BudgetGoalKind | null;
}

/** Linha calculada de comparação Planejado x Realizado. */
export interface BudgetLine {
  key: string;
  itemId: UUID | null;
  categoryId: UUID | null;
  subcategoryId: UUID | null;
  categoryName: string;
  subcategoryName: string | null;
  kind: BudgetLineKind;
  planned: number;
  actual: number;
  /** Planejado - Realizado (positivo = economia em despesas). */
  difference: number;
  /** Percentual consumido do planejado (null quando não há planejado). */
  percent: number | null;
  /** Saldo restante do planejado (nunca negativo). */
  remaining: number;
  over: boolean;
}

export interface BudgetSideTotals {
  planned: number;
  actual: number;
  difference: number;
  percent: number | null;
  remaining: number;
}

export interface BudgetSummary {
  expense: BudgetSideTotals;
  income: BudgetSideTotals;
  /** Linhas de despesa que ultrapassaram o planejado. */
  overCount: number;
  /** Linhas de despesa entre 80% e 100%. */
  warningCount: number;
  lines: number;
}

export interface BudgetComparison {
  budgetId: UUID | null;
  year: number;
  month: number;
  mode: BudgetMode;
  lines: BudgetLine[];
  summary: BudgetSummary;
}

export type BudgetSortKey = "SPENT" | "DEVIATION" | "PLANNED";

export const BUDGET_SORT_LABELS: Record<BudgetSortKey, string> = {
  SPENT: "Maior gasto",
  DEVIATION: "Maior desvio",
  PLANNED: "Maior orçamento",
};

export const BUDGET_STATUS_LABELS: Record<BudgetStatus, string> = {
  DRAFT: "Rascunho",
  ACTIVE: "Ativo",
  CLOSED: "Encerrado",
};

export const BUDGET_MODE_LABELS: Record<BudgetMode, string> = {
  SIMPLE: "Simples (categoria)",
  ADVANCED: "Avançado (subcategoria)",
};

/** Estratégias de geração automática de um novo orçamento. */
export type BudgetSuggestionSource =
  | "EMPTY"
  | "PREVIOUS_MONTH"
  | "LAST_ACTIVE"
  | "AVERAGE_3"
  | "AVERAGE_6";

export const BUDGET_SUGGESTION_LABELS: Record<BudgetSuggestionSource, string> = {
  EMPTY: "Orçamento vazio",
  PREVIOUS_MONTH: "Copiar mês anterior",
  LAST_ACTIVE: "Copiar último orçamento ativo",
  AVERAGE_3: "Média dos últimos 3 fechamentos",
  AVERAGE_6: "Média dos últimos 6 fechamentos",
};

/** Bloco congelado no snapshot do Fechamento Mensal. */
export interface ClosingBudgetLine {
  categoryId: UUID | null;
  label: string;
  kind: BudgetLineKind;
  planned: number;
  actual: number;
  difference: number;
  percent: number | null;
}

export interface ClosingBudget {
  budgetId: UUID | null;
  mode: BudgetMode | null;
  planned: number;
  actual: number;
  difference: number;
  percent: number | null;
  lines: ClosingBudgetLine[];
}
