// Sprint 4.14 — Contratos do diagnóstico de conciliação de fatura de cartão.
// Estes tipos descrevem APENAS um diagnóstico derivado: nada aqui é persistido
// como fonte de verdade financeira.
import type { Movement, UUID } from "./index";

/** Linha da fatura oficial (arquivo/extrato informado pelo usuário). */
export interface OfficialInvoiceLine {
  /** Índice estável dentro do arquivo — garante execução idempotente. */
  index: number;
  date: string; // yyyy-mm-dd
  description: string;
  /** Positivo = compra/encargo. Negativo = estorno/crédito. */
  amount: number;
  external_ref?: string | null;
  installment?: number | null;
  installments_total?: number | null;
}

export type InvoiceReconciliationStatus =
  | "MATCHED"
  | "MISSING_IN_SYSTEM"
  | "MISSING_IN_INVOICE"
  | "AMOUNT_MISMATCH"
  | "DATE_MISMATCH"
  | "POSSIBLE_DUPLICATE"
  | "REFUND_OR_REVERSAL"
  | "INTEREST_OR_FEE"
  | "PARTIAL_MATCH"
  | "AMBIGUOUS_MATCH"
  | "UNCLASSIFIED";

export const INVOICE_RECONCILIATION_STATUS_LABELS: Record<
  InvoiceReconciliationStatus,
  string
> = {
  MATCHED: "Conciliado",
  MISSING_IN_SYSTEM: "Faltando no sistema",
  MISSING_IN_INVOICE: "Não consta na fatura",
  AMOUNT_MISMATCH: "Valor divergente",
  DATE_MISMATCH: "Data divergente",
  POSSIBLE_DUPLICATE: "Possível duplicidade",
  REFUND_OR_REVERSAL: "Estorno/reembolso",
  INTEREST_OR_FEE: "Juros/tarifa/encargo",
  PARTIAL_MATCH: "Correspondência parcial",
  AMBIGUOUS_MATCH: "Correspondência ambígua",
  UNCLASSIFIED: "Não classificado",
};

export type MatchingSignalKind = "POSITIVE" | "WARNING" | "NEGATIVE";

export interface MatchingSignal {
  kind: MatchingSignalKind;
  label: string;
}

export interface InvoiceMatchCandidate {
  movement_id: UUID;
  description: string;
  amount: number;
  transaction_date: string;
  confidence: number;
  reasons: string[];
}

export interface InvoiceReconciliationItem {
  /** Chave estável e determinística do item. */
  key: string;
  status: InvoiceReconciliationStatus;
  official: OfficialInvoiceLine | null;
  movement: Movement | null;
  official_amount: number | null;
  system_amount: number | null;
  amount_difference: number | null;
  official_date: string | null;
  system_date: string | null;
  date_diff_days: number | null;
  installment: number | null;
  installments_total: number | null;
  confidence: number;
  matching_reasons: string[];
  matching_signals: MatchingSignal[];
  candidates: InvoiceMatchCandidate[];
  /** Explicação curta do diagnóstico, sempre preenchida. */
  diagnosis: string;
}

export interface InvoiceReconciliationResult {
  invoice_id: UUID;
  card_id: UUID | null;
  executed_at: string;
  official_invoice_total: number;
  matched_total: number;
  difference: number;
  matched_count: number;
  missing_in_system_count: number;
  missing_in_invoice_count: number;
  amount_mismatch_count: number;
  date_mismatch_count: number;
  possible_duplicate_count: number;
  refund_count: number;
  fee_count: number;
  ambiguous_count: number;
  /** true quando não há nenhuma pendência relevante. */
  is_reconciled: boolean;
  items: InvoiceReconciliationItem[];
}

/** Indicador exibido na listagem de faturas. */
export type InvoiceReconciliationBadge =
  | "NOT_RECONCILED"
  | "RECONCILED"
  | "DIVERGENT";

/**
 * Ações futuras já previstas no domínio (Sprint 4.14 apenas declara — nenhuma
 * delas altera dados nesta sprint).
 */
export type InvoiceReconciliationAction =
  | "LINK"
  | "FIX_AMOUNT"
  | "FIX_DATE"
  | "MARK_AS_REFUND"
  | "IGNORE"
  | "CONFIRM_DUPLICATE"
  | "NOT_THE_SAME";
