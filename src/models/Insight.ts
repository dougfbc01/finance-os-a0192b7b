import type { UUID, ISODateString } from "./index";

/** Nível de severidade de um insight financeiro. */
export type InsightLevel = "INFO" | "WARNING" | "CRITICAL";

/** Tipo/tema do insight — usado para roteamento e futuras automações. */
export type InsightType =
  | "SPENDING_TREND"
  | "INCOME_TREND"
  | "NET_WORTH"
  | "UNCLASSIFIED"
  | "DUPLICATES"
  | "RULES"
  | "CARD_SHARE"
  | "PROJECTION";

/** Origem do insight (módulo que o gerou). */
export type InsightOrigin =
  | "DASHBOARD"
  | "MOVEMENTS"
  | "PATRIMONY"
  | "CARDS"
  | "RULES"
  | "DEDUP";

export interface FinancialInsight {
  id: string;
  type: InsightType;
  /** Categoria de negócio (ex.: id da categoria) quando aplicável. */
  category: UUID | string | null;
  level: InsightLevel;
  /** Prioridade numérica (maior = mais relevante) usada na ordenação. */
  priority: number;
  date: ISODateString;
  /** Valor associado (montante, percentual ou contagem). */
  value: number;
  origin: InsightOrigin;
  title: string;
  description: string;
}
