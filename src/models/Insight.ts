import type { UUID, ISODateString } from "./index";

/** Nível de severidade de um insight financeiro. */
export type InsightSeverity = "INFO" | "WARNING" | "CRITICAL";

/** Tipo/tema do insight — usado para agrupamento e futuras automações. */
export type InsightType =
  | "SPENDING_TREND"
  | "INCOME_TREND"
  | "NET_WORTH"
  | "UNCLASSIFIED"
  | "DUPLICATES"
  | "RULES_CONFLICT"
  | "RULES_DUPLICATE"
  | "CARD_SHARE"
  | "CARDS_RECONCILED"
  | "HEALTH_CHECK"
  | "PROJECTION"
  | "BUDGET"
  | "GOAL";

/** Origem do insight (módulo que o gerou). */
export type InsightSource =
  | "DASHBOARD"
  | "MOVEMENTS"
  | "PATRIMONY"
  | "CARDS"
  | "RULES"
  | "DEDUP"
  | "HEALTH"
  | "BUDGET"
  | "GOALS";

/** Entidade de negócio relacionada ao insight. */
export type InsightRelatedEntity =
  | "movement"
  | "category"
  | "card"
  | "invoice"
  | "rule"
  | "workspace"
  | "health_check"
  | "budget"
  | "goal"
  | "none";

/** Ação recomendada — interpretada pela UI (navegação ou ação rápida). */
export type InsightAction =
  | "OPEN_RULES"
  | "OPEN_RULE_INTEGRITY"
  | "CLASSIFY_MOVEMENTS"
  | "REVIEW_DUPLICATES"
  | "OPEN_CARD"
  | "OPEN_DASHBOARD"
  | "RUN_HEALTH_CHECK"
  | "REPROCESS_RULES"
  | "OPEN_BUDGET"
  | "OPEN_GOAL"
  | "NONE";

/** Rotas que um insight pode abrir (deep link). */
export type InsightRoute =
  | "/dashboard"
  | "/movimentacoes"
  | "/regras"
  | "/duplicidades"
  | "/cartoes"
  | "/configuracoes"
  | "/planejamento"
  | "/fechamentos";

/** Filtros aplicados ao abrir a tela de destino. */
export interface InsightFilters {
  status?: string;
  category?: string;
  card?: string;
  account?: string;
  search?: string;
  subcategory?: string;
  from?: string;
  to?: string;
}

/** Linha de detalhe exibida dentro do insight (ex.: 3 maiores lançamentos). */
export interface InsightDetail {
  label: string;
  value?: string;
  amount?: number;
  date?: ISODateString;
}

export interface FinancialInsight {
  id: string;
  type: InsightType;
  severity: InsightSeverity;
  title: string;
  description: string;
  source: InsightSource;
  related_entity: InsightRelatedEntity;
  related_entity_id: UUID | string | null;
  quantity: number;
  value: number;
  recommended_action: InsightAction;
  action_label: string | null;
  action_route: InsightRoute | null;
  action_filters: InsightFilters;
  dismissible: boolean;
  created_at: ISODateString;
  resolved: boolean;
  /** Prioridade numérica interna (maior = mais relevante) usada na ordenação. */
  priority: number;
  /** Detalhes contextuais ("onde aconteceu"). */
  details: InsightDetail[];
  /** Assinatura do estado do problema — o dismiss expira quando ela muda. */
  signature: string;
}

export interface InsightSummary {
  critical: number;
  warning: number;
  info: number;
  total: number;
}

export interface InsightsResult {
  insights: FinancialInsight[];
  summary: InsightSummary;
}
