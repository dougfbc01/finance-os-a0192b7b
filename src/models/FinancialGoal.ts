// Modelo de Metas Financeiras (Sprint 4.4).
// REGRA: o banco guarda apenas os dados da meta e os aportes reais.
// Valor atual, restante, percentual, ritmo e previsão são SEMPRE calculados
// pelo FinancialGoalService — nunca persistidos.
import type { UUID, ISODateString } from "./index";

export type FinancialGoalType =
  | "EMERGENCY_RESERVE"
  | "PURCHASE"
  | "TRAVEL"
  | "INVESTMENT"
  | "PATRIMONY"
  | "CUSTOM";

export type FinancialGoalStatus = "ACTIVE" | "COMPLETED" | "PAUSED" | "CANCELLED";

export const GOAL_TYPE_LABELS: Record<FinancialGoalType, string> = {
  EMERGENCY_RESERVE: "Reserva de Emergência",
  PURCHASE: "Compra",
  TRAVEL: "Viagem",
  INVESTMENT: "Investimento",
  PATRIMONY: "Patrimônio",
  CUSTOM: "Personalizada",
};

export const GOAL_TYPE_ICONS: Record<FinancialGoalType, string> = {
  EMERGENCY_RESERVE: "🛟",
  PURCHASE: "🛒",
  TRAVEL: "✈️",
  INVESTMENT: "📈",
  PATRIMONY: "🏦",
  CUSTOM: "🎯",
};

export const GOAL_STATUS_LABELS: Record<FinancialGoalStatus, string> = {
  ACTIVE: "Ativa",
  COMPLETED: "Concluída",
  PAUSED: "Pausada",
  CANCELLED: "Cancelada",
};

export interface FinancialGoal {
  id: UUID;
  workspace_id: UUID;
  name: string;
  description: string | null;
  goal_type: FinancialGoalType;
  target_amount: number;
  initial_amount: number;
  target_date: ISODateString | null;
  status: FinancialGoalStatus;
  notes: string | null;
  created_at: ISODateString;
  updated_at: ISODateString;
  deleted_at: ISODateString | null;
}

export interface GoalContribution {
  id: UUID;
  workspace_id: UUID;
  goal_id: UUID;
  amount: number;
  contribution_date: ISODateString;
  notes: string | null;
  created_at: ISODateString;
  updated_at: ISODateString;
  deleted_at: ISODateString | null;
}

export interface CreateGoalInput {
  workspace_id: UUID;
  name: string;
  description?: string | null;
  goal_type: FinancialGoalType;
  target_amount: number;
  initial_amount?: number;
  target_date?: ISODateString | null;
  notes?: string | null;
  status?: FinancialGoalStatus;
}

export type UpdateGoalInput = Partial<Omit<CreateGoalInput, "workspace_id">>;

export interface CreateContributionInput {
  workspace_id: UUID;
  goal_id: UUID;
  amount: number;
  contribution_date: ISODateString;
  notes?: string | null;
}

/** Semáforo da meta — mesma linguagem visual do Planejamento. */
export type GoalStatusLevel = "ON_TRACK" | "ATTENTION" | "LATE" | "DONE" | "INACTIVE";

export const GOAL_STATUS_LEVEL_LABELS: Record<GoalStatusLevel, string> = {
  ON_TRACK: "Em dia",
  ATTENTION: "Atenção",
  LATE: "Atrasada",
  DONE: "Concluída",
  INACTIVE: "Inativa",
};

export const GOAL_STATUS_LEVEL_ICONS: Record<GoalStatusLevel, string> = {
  ON_TRACK: "🟢",
  ATTENTION: "🟡",
  LATE: "🔴",
  DONE: "🔵",
  INACTIVE: "⚪",
};

/** Ponto do histórico mensal acumulado (nunca artificial). */
export interface GoalHistoryPoint {
  /** YYYY-MM */
  month: string;
  label: string;
  contributed: number;
  accumulated: number;
}

/** Vínculo entre uma meta e uma conta real (Sprint 4.4.1). */
export interface GoalAccountLink {
  id: UUID;
  workspace_id: UUID;
  goal_id: UUID;
  account_id: UUID;
  created_at: ISODateString;
  updated_at: ISODateString;
}

/** Composição do valor atual da meta a partir das contas vinculadas. */
export interface GoalAccountBreakdown {
  accountId: UUID;
  name: string;
  balance: number;
}

/** Origem do valor atual da meta — nunca persistida. */
export type GoalValueSource = "ACCOUNTS" | "CONTRIBUTIONS" | "PATRIMONY";

/** Conflito de vínculo: conta já usada por outra meta ativa. */
export interface GoalAccountConflict {
  accountId: UUID;
  accountName: string;
  goalId: UUID;
  goalName: string;
}

export interface GoalProgress {
  goalId: UUID;
  name: string;
  type: FinancialGoalType;
  status: FinancialGoalStatus;
  target: number;
  current: number;
  remaining: number;
  /** Percentual atingido (0–100+, null quando não há alvo). */
  percent: number | null;
  level: GoalStatusLevel;
  history: GoalHistoryPoint[];
  /** Ritmo médio mensal de evolução (null quando não há dados suficientes). */
  monthlyPace: number | null;
  /** Meses estimados para conclusão (null sem dados suficientes). */
  monthsToComplete: number | null;
  /** Data estimada de conclusão (ISO, null sem dados suficientes). */
  estimatedCompletionDate: ISODateString | null;
  /** Aporte mensal necessário para bater a data alvo (null sem data alvo). */
  requiredMonthly: number | null;
  monthsToTarget: number | null;
  targetDate: ISODateString | null;
  /** Motivo textual quando não há previsão. */
  forecastMessage: string | null;
  /** Dias sem nenhum aporte (null quando nunca houve aporte). */
  daysSinceLastContribution: number | null;
}

export interface GoalsOverview {
  active: number;
  completed: number;
  paused: number;
  late: number;
  totalTarget: number;
  totalCurrent: number;
  percent: number | null;
  /** Meta mais próxima da conclusão (menor valor restante entre as ativas). */
  closest: GoalProgress | null;
  /** Meta com maior percentual atingido entre as ativas. */
  best: GoalProgress | null;
}

/** Relação entre uma meta ativa e o orçamento do mês. */
export interface GoalBudgetRelation {
  goalId: UUID;
  name: string;
  requiredMonthly: number | null;
  /** Sobra planejada no orçamento (receita planejada − despesa planejada). */
  plannedAvailable: number;
  difference: number | null;
  feasible: boolean | null;
}

/** Evolução da meta dentro de um período de fechamento. */
export interface GoalClosingLine {
  goalId: UUID;
  name: string;
  type: FinancialGoalType;
  target: number;
  accumulated: number;
  contributedInPeriod: number;
  percent: number | null;
}
