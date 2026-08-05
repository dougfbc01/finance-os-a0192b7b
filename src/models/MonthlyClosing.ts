// Modelo do Fechamento Mensal (Sprint 4.2).
// O snapshot é IMUTÁVEL: representa os indicadores congelados no momento do
// fechamento. Nunca é recalculado durante consultas.
import type { UUID, ISODateString } from "./index";
import type { FinancialInsight, InsightSummary } from "./Insight";

export type MonthlyClosingStatus = "OPEN" | "CLOSED" | "LOCKED";

export type MonthlyClosingEventType = "CLOSED" | "REOPENED" | "RECLOSED";

/** Totais consolidados do período (consumidos pelo Planejamento Mensal). */
export interface ClosingTotals {
  income: number;
  expense: number;
  result: number;
  cash: number;
  assets: number;
  liabilities: number;
  netWorth: number;
}

/** Indicadores de qualidade dos dados no momento do fechamento. */
export interface ClosingQuality {
  movements: number;
  imports: number;
  uncategorized: number;
  duplicates: number;
  ruleConflicts: number;
  ruleDuplicates: number;
}

export interface ClosingHealthItem {
  key: string;
  label: string;
  count: number;
  ok: boolean;
}

export interface ClosingHealth {
  issues: number;
  checkedAt: ISODateString | null;
  items: ClosingHealthItem[];
}

/** Linha genérica de agrupamento congelada no snapshot. */
export interface ClosingBreakdownRow {
  id: UUID | null;
  label: string;
  amount: number;
  percent: number;
}

export interface ClosingBreakdown {
  income: ClosingBreakdownRow[];
  expense: ClosingBreakdownRow[];
}

export interface ClosingCardRow {
  id: UUID;
  label: string;
  /** Compras lançadas no período. */
  amount: number;
  count: number;
}

export interface ClosingAccountRow {
  id: UUID;
  label: string;
  /** Saldo da conta ao final do período. */
  balance: number;
}

export interface ClosingInvestments {
  total: number;
  profit: number;
  count: number;
  /** Aportes registrados no período. */
  contributions: number;
}

export interface ClosingTransfers {
  count: number;
  amount: number;
}

/** Snapshot completo e auditável de um mês. */
export interface ClosingSnapshot {
  version: 1;
  generated_at: ISODateString;
  period: { year: number; month: number; start: string; end: string };
  totals: ClosingTotals;
  quality: ClosingQuality;
  health: ClosingHealth;
  insights: FinancialInsight[];
  insights_summary: InsightSummary;
  byCategory: ClosingBreakdown;
  bySubcategory: ClosingBreakdown;
  byAccount: ClosingAccountRow[];
  byCard: ClosingCardRow[];
  cards: ClosingCardRow[];
  investments: ClosingInvestments;
  transfers: ClosingTransfers;
}

export interface MonthlyClosing {
  id: UUID;
  workspace_id: UUID;
  year: number;
  month: number;
  status: MonthlyClosingStatus;
  closed_at: ISODateString | null;
  closed_by: UUID | null;
  reopened_at: ISODateString | null;
  reopened_by: UUID | null;
  reopen_reason: string | null;
  notes: string | null;
  snapshot_json: ClosingSnapshot;
  created_at: ISODateString;
  updated_at: ISODateString;
  deleted_at: ISODateString | null;
}

export interface ClosingEvent {
  id: UUID;
  closing_id: UUID;
  workspace_id: UUID;
  event: MonthlyClosingEventType;
  reason: string | null;
  performed_by: UUID | null;
  created_at: ISODateString;
}

/** Aviso pré-fechamento — nunca bloqueia o fechamento. */
export interface ClosingWarning {
  key: string;
  label: string;
  count: number;
}

export interface ClosingComparisonRow {
  key: string;
  label: string;
  current: number;
  previous: number;
  delta: number;
  /** null quando o valor anterior é zero (variação indefinida). */
  percent: number | null;
}

export interface ClosingComparison {
  from: { year: number; month: number };
  to: { year: number; month: number };
  rows: ClosingComparisonRow[];
}

export const MONTH_LABELS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

export const CLOSING_STATUS_LABELS: Record<MonthlyClosingStatus, string> = {
  OPEN: "Reaberto",
  CLOSED: "Fechado",
  LOCKED: "Travado",
};
