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
  | "IGNORE_DIVERGENCE"
  /** Sprint 4.15B — criação manual do lançamento que consta na fatura. */
  | "CREATE_MISSING_MOVEMENT"
  /** Sprint 4.15D — movimentação explícita do lançamento entre faturas do mesmo cartão. */
  | "MOVE_TO_ANOTHER_INVOICE";

export const INVOICE_ACTION_LABELS: Record<InvoiceReconciliationActionType, string> = {
  LINK_EXISTING_MOVEMENT: "Vincular lançamento",
  SELECT_MATCH_CANDIDATE: "Escolher correspondência",
  CORRECT_AMOUNT: "Corrigir valor",
  CORRECT_DATE: "Corrigir data",
  CORRECT_COMPETENCE: "Corrigir competência",
  MARK_NOT_SAME_MOVEMENT: "Não são a mesma movimentação",
  IGNORE_DIVERGENCE: "Ignorar divergência",
  CREATE_MISSING_MOVEMENT: "Criar lançamento",
  MOVE_TO_ANOTHER_INVOICE: "Mover para outra fatura",
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
  /**
   * Sprint 4.15C — confirmação específica de que o usuário aceita que a
   * correção mova o lançamento para outra fatura. Sem isso, o vínculo com a
   * fatura em conciliação é sempre preservado.
   */
  allowInvoiceChange?: boolean;
  /**
   * Sprint 4.15D — fatura destino escolhida explicitamente pelo usuário na
   * ação "Mover para outra fatura". Sempre do MESMO cartão da fatura atual.
   */
  targetInvoiceId?: UUID;

  newAmount?: number;
  newDate?: string;
  newCompetence?: string;
  reason?: string | null;
  /** Sprint 4.15B — dados revisados pelo usuário para o lançamento faltante. */
  createPayload?: CreateMissingMovementPayload;
}

/**
 * Sprint 4.15B — dados do lançamento que existe na fatura mas não no sistema.
 * Sempre revisados/editáveis pelo usuário antes da confirmação.
 */
export interface CreateMissingMovementPayload {
  cardId: UUID;
  description: string;
  amount: number;
  transactionDate: string;
  competenceDate?: string | null;
  categoryId?: UUID | null;
  subcategoryId?: UUID | null;
  installment?: number | null;
  installmentsTotal?: number | null;
  notes?: string | null;
}
