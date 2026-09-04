// Sprint 4.15A — Ações humanas sobre o diagnóstico de conciliação de fatura.
// Nenhuma destas ações é executada automaticamente: todas exigem confirmação
// explícita do usuário e ficam registradas em auditoria.
import type { UUID } from "./index";

export type InvoiceReconciliationActionType =
  | "LINK_EXISTING_MOVEMENT"
  | "SELECT_MATCH_CANDIDATE"
  | "CORRECT_AMOUNT"
  | "CORRECT_DATE"
  | "CORRECT_COMPETENCE"
  | "MARK_NOT_SAME_MOVEMENT"
  | "IGNORE_DIVERGENCE";

export const INVOICE_ACTION_LABELS: Record<InvoiceReconciliationActionType, string> = {
  LINK_EXISTING_MOVEMENT: "Vincular lançamento",
  SELECT_MATCH_CANDIDATE: "Escolher correspondência",
  CORRECT_AMOUNT: "Corrigir valor",
  CORRECT_DATE: "Corrigir data",
  CORRECT_COMPETENCE: "Corrigir competência",
  MARK_NOT_SAME_MOVEMENT: "Não são a mesma movimentação",
  IGNORE_DIVERGENCE: "Ignorar divergência",
};

/** Ações que alteram dados financeiros e, por isso, podem ser desfeitas. */
export const UNDOABLE_ACTIONS: InvoiceReconciliationActionType[] = [
  "CORRECT_AMOUNT",
  "CORRECT_DATE",
  "CORRECT_COMPETENCE",
];

/** Ações que representam uma decisão humana persistente sobre a divergência. */
export const DECISION_ACTIONS: InvoiceReconciliationActionType[] = [
  "MARK_NOT_SAME_MOVEMENT",
  "IGNORE_DIVERGENCE",
];

export interface InvoiceReconciliationActionRecord {
  id: UUID;
  workspace_id: UUID;
  invoice_id: UUID;
  item_key: string;
  movement_id: UUID | null;
  related_movement_id: UUID | null;
  action: InvoiceReconciliationActionType;
  before_state: Record<string, unknown>;
  after_state: Record<string, unknown>;
  reason: string | null;
  source: string;
  idempotency_key: string;
  performed_by: UUID | null;
  undone_at: string | null;
  undone_by: UUID | null;
  created_at: string;
  updated_at: string;
}

export interface ExecuteInvoiceActionInput {
  workspaceId: UUID;
  invoiceId: UUID;
  itemKey: string;
  action: InvoiceReconciliationActionType;
  /** Movimento alvo da ação (obrigatório, exceto em IGNORE de linha órfã). */
  movementId?: UUID | null;
  relatedMovementId?: UUID | null;
  /** Assinatura de estado capturada quando o diagnóstico foi aberto. */
  expectedSignature?: string | null;
  newAmount?: number;
  newDate?: string;
  newCompetence?: string;
  reason?: string | null;
}
