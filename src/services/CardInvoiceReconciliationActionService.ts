// CardInvoiceReconciliationActionService — Sprint 4.15A
// Executa AÇÕES HUMANAS confirmadas sobre o diagnóstico da Sprint 4.14.
//
// Princípios:
//  DIAGNÓSTICO → DECISÃO HUMANA → CONFIRMAÇÃO → AÇÃO → AUDITORIA → RECONCILIAÇÃO
//  - nenhuma alteração automática;
//  - toda alteração financeira passa pelo MovementService (nunca SQL direto na UI);
//  - toda ação é idempotente (chave única por fatura/item/ação/payload);
//  - concorrência é revalidada antes de alterar;
//  - decisões humanas (ignorar / não são a mesma) persistem entre execuções.
import { BaseService } from "./BaseService";
import { MovementService } from "./MovementService";
import { ReconciliationDecisionService } from "./ReconciliationDecisionService";
import type { Movement, UUID } from "@/models";
import type {
  InvoiceReconciliationItem,
  InvoiceReconciliationResult,
  InvoiceReconciliationStatus,
} from "@/models/CardInvoiceReconciliation";
import {
  UNDOABLE_ACTIONS,
  type ExecuteInvoiceActionInput,
  type InvoiceReconciliationActionRecord,
  type InvoiceReconciliationActionType,
} from "@/models/CardInvoiceReconciliationAction";
import { INVOICE_AMOUNT_TOLERANCE } from "@/constants/cardReconciliation";

/** Situações que representam pendência ativa (contam contra a conciliação). */
const PENDING_STATUSES: InvoiceReconciliationStatus[] = [
  "MISSING_IN_SYSTEM",
  "MISSING_IN_INVOICE",
  "AMOUNT_MISMATCH",
  "DATE_MISMATCH",
  "POSSIBLE_DUPLICATE",
  "AMBIGUOUS_MATCH",
];

export class ConcurrentChangeError extends Error {
  constructor() {
    super(
      "Este lançamento foi alterado desde que a conciliação foi aberta. Atualize o diagnóstico antes de continuar.",
    );
    this.name = "ConcurrentChangeError";
  }
}

export class DuplicateActionError extends Error {
  constructor() {
    super("Esta ação já foi executada.");
    this.name = "DuplicateActionError";
  }
}

class CardInvoiceReconciliationActionServiceImpl extends BaseService {
  // -------------------------------------------------------------------
  // Regras puras (sem I/O) — testáveis isoladamente.
  // -------------------------------------------------------------------

  /** Ações compatíveis com cada situação diagnosticada. */
  static availableActions(
    item: Pick<InvoiceReconciliationItem, "status" | "movement" | "candidates">,
  ): InvoiceReconciliationActionType[] {
    switch (item.status) {
      case "AMOUNT_MISMATCH":
        return ["CORRECT_AMOUNT", "CORRECT_COMPETENCE", "MARK_NOT_SAME_MOVEMENT", "IGNORE_DIVERGENCE"];
      case "DATE_MISMATCH":
        return ["CORRECT_DATE", "CORRECT_COMPETENCE", "MARK_NOT_SAME_MOVEMENT", "IGNORE_DIVERGENCE"];
      case "AMBIGUOUS_MATCH":
      case "POSSIBLE_DUPLICATE":
        return item.candidates.length > 0
          ? ["SELECT_MATCH_CANDIDATE", "IGNORE_DIVERGENCE"]
          : ["IGNORE_DIVERGENCE"];
      case "MISSING_IN_SYSTEM":
        return item.candidates.length > 0
          ? ["LINK_EXISTING_MOVEMENT", "IGNORE_DIVERGENCE"]
          : ["IGNORE_DIVERGENCE"];
      case "MISSING_IN_INVOICE":
        return ["MARK_NOT_SAME_MOVEMENT", "IGNORE_DIVERGENCE"];
      case "PARTIAL_MATCH":
        return ["CORRECT_COMPETENCE", "MARK_NOT_SAME_MOVEMENT", "IGNORE_DIVERGENCE"];
      case "MATCHED":
        return [];
      default:
        return ["IGNORE_DIVERGENCE"];
    }
  }

  /** Assinatura de estado usada na detecção de alteração concorrente. */
  static signature(movement: Pick<Movement, "id" | "updated_at"> | null | undefined): string | null {
    if (!movement) return null;
    return `${movement.id}:${movement.updated_at}`;
  }

  /** Chave determinística de idempotência da ação. */
  static idempotencyKey(input: ExecuteInvoiceActionInput): string {
    const payload = [
      input.newAmount !== undefined ? `a=${Number(input.newAmount).toFixed(2)}` : "",
      input.newDate ? `d=${input.newDate}` : "",
      input.newCompetence ? `c=${input.newCompetence}` : "",
      input.relatedMovementId ? `r=${input.relatedMovementId}` : "",
      input.movementId ? `m=${input.movementId}` : "",
    ]
      .filter(Boolean)
      .join("&");
    return `${input.invoiceId}|${input.itemKey}|${input.action}|${payload}`;
  }

  /** Decisões ativas (não desfeitas) que suprimem uma pendência. */
  static suppressedKeys(actions: InvoiceReconciliationActionRecord[]): Set<string> {
    const set = new Set<string>();
    for (const a of actions) {
      if (a.undone_at) continue;
      if (a.action === "IGNORE_DIVERGENCE" || a.action === "MARK_NOT_SAME_MOVEMENT") {
        set.add(a.item_key);
      }
    }
    return set;
  }

  /**
   * Aplica as decisões humanas ao resultado do diagnóstico: itens decididos
   * deixam de ser pendência ativa, mas continuam visíveis no histórico.
   */
  static applyDecisions(
    result: InvoiceReconciliationResult,
    actions: InvoiceReconciliationActionRecord[],
  ): InvoiceReconciliationResult {
    const suppressed = CardInvoiceReconciliationActionServiceImpl.suppressedKeys(actions);
    if (suppressed.size === 0) return result;

    const items = result.items.map((i) =>
      suppressed.has(i.key) ? { ...i, decided: true as const } : i,
    );
    const pending = items.filter(
      (i) => !i.decided && PENDING_STATUSES.includes(i.status),
    );
    const count = (s: InvoiceReconciliationStatus) =>
      pending.filter((i) => i.status === s).length;

    return {
      ...result,
      items,
      missing_in_system_count: count("MISSING_IN_SYSTEM"),
      missing_in_invoice_count: count("MISSING_IN_INVOICE"),
      amount_mismatch_count: count("AMOUNT_MISMATCH"),
      date_mismatch_count: count("DATE_MISMATCH"),
      possible_duplicate_count: count("POSSIBLE_DUPLICATE"),
      ambiguous_count: count("AMBIGUOUS_MATCH"),
      is_reconciled:
        pending.length === 0 && Math.abs(result.difference) <= INVOICE_AMOUNT_TOLERANCE,
    };
  }

  static canUndo(
    action: InvoiceReconciliationActionRecord,
    movement: Pick<Movement, "id" | "updated_at"> | null,
  ): boolean {
    if (action.undone_at) return false;
    if (!UNDOABLE_ACTIONS.includes(action.action)) return false;
    if (!movement) return false;
    const after = action.after_state as { signature?: string };
    return !!after?.signature && after.signature === this.signature(movement);
  }

  // -------------------------------------------------------------------
  // I/O
  // -------------------------------------------------------------------

  async listActions(invoiceId: UUID): Promise<InvoiceReconciliationActionRecord[]> {
    const { data, error } = await this.client
      .from("invoice_reconciliation_actions")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("created_at", { ascending: false });
    if (error) this.handleError(error, "listActions");
    return (data ?? []) as unknown as InvoiceReconciliationActionRecord[];
  }

  private async currentUserId(): Promise<UUID | null> {
    const { data } = await this.client.auth.getUser();
    return (data?.user?.id as UUID) ?? null;
  }

  /** Executa uma ação já confirmada pelo usuário. */
  async execute(input: ExecuteInvoiceActionInput): Promise<InvoiceReconciliationActionRecord> {
    const Impl = CardInvoiceReconciliationActionServiceImpl;

    let movement: Movement | null = null;
    if (input.movementId) {
      movement = await MovementService.getById(input.movementId);
      if (!movement) this.handleError(new Error("Movimentação não encontrada."), "execute");
      // Isolamento explícito, além da RLS.
      if (movement!.workspace_id !== input.workspaceId) {
        this.handleError(
          new Error("Movimentação pertence a outro workspace."),
          "execute",
        );
      }
      if (
        input.expectedSignature &&
        input.expectedSignature !== Impl.signature(movement)
      ) {
        throw new ConcurrentChangeError();
      }
    }

    const before: Record<string, unknown> = movement
      ? {
          amount: Number(movement.amount),
          transaction_date: movement.transaction_date,
          competence_date: movement.competence_date,
          invoice_id: movement.invoice_id,
          signature: Impl.signature(movement),
        }
      : {};

    // 1) Reserva de idempotência: a chave única impede execução duplicada.
    const userId = await this.currentUserId();
    const idempotencyKey = Impl.idempotencyKey(input);
    const { data: inserted, error: insertError } = await this.client
      .from("invoice_reconciliation_actions")
      .insert({
        workspace_id: input.workspaceId,
        invoice_id: input.invoiceId,
        item_key: input.itemKey,
        movement_id: input.movementId ?? null,
        related_movement_id: input.relatedMovementId ?? null,
        action: input.action,
        before_state: before,
        after_state: {},
        reason: input.reason ?? null,
        source: "MANUAL",
        idempotency_key: idempotencyKey,
        performed_by: userId,
      } as never)
      .select()
      .single();
    if (insertError) {
      if (`${insertError.message}`.toLowerCase().includes("duplicate key")) {
        throw new DuplicateActionError();
      }
      this.handleError(insertError, "execute");
    }
    const record = inserted as unknown as InvoiceReconciliationActionRecord;

    // 2) Efeito da ação.
    try {
      const after = await this.applyEffect(input, movement);
      const { data: updated, error } = await this.client
        .from("invoice_reconciliation_actions")
        .update({ after_state: after } as never)
        .eq("id", record.id)
        .select()
        .single();
      if (error) this.handleError(error, "execute");
      return updated as unknown as InvoiceReconciliationActionRecord;
    } catch (err) {
      // Falhou: a reserva é neutralizada para não bloquear nova tentativa.
      await this.client
        .from("invoice_reconciliation_actions")
        .update({ undone_at: new Date().toISOString() } as never)
        .eq("id", record.id);
      throw err;
    }
  }

  private async applyEffect(
    input: ExecuteInvoiceActionInput,
    movement: Movement | null,
  ): Promise<Record<string, unknown>> {
    const Impl = CardInvoiceReconciliationActionServiceImpl;

    switch (input.action) {
      case "LINK_EXISTING_MOVEMENT":
      case "SELECT_MATCH_CANDIDATE": {
        if (!movement) this.handleError(new Error("Selecione um lançamento."), "applyEffect");
        // Vincular NUNCA cria movimento: apenas ajusta a relação existente.
        const next = await MovementService.update(movement!.id, {
          invoice_id: input.invoiceId,
        });
        return { invoice_id: next.invoice_id, signature: Impl.signature(next) };
      }
      case "CORRECT_AMOUNT": {
        if (!movement || input.newAmount === undefined) {
          this.handleError(new Error("Valor inválido."), "applyEffect");
        }
        const next = await MovementService.update(movement!.id, {
          amount: Math.abs(Number(input.newAmount)),
        });
        return { amount: Number(next.amount), signature: Impl.signature(next) };
      }
      case "CORRECT_DATE": {
        if (!movement || !input.newDate) {
          this.handleError(new Error("Data inválida."), "applyEffect");
        }
        // Competência não muda junto: é uma decisão separada.
        const next = await MovementService.update(movement!.id, {
          transaction_date: input.newDate!,
        });
        return {
          transaction_date: next.transaction_date,
          signature: Impl.signature(next),
        };
      }
      case "CORRECT_COMPETENCE": {
        if (!movement || !input.newCompetence) {
          this.handleError(new Error("Competência inválida."), "applyEffect");
        }
        const next = await MovementService.update(movement!.id, {
          competence_date: input.newCompetence!,
        });
        return {
          competence_date: next.competence_date,
          signature: Impl.signature(next),
        };
      }
      case "MARK_NOT_SAME_MOVEMENT": {
        // Nada financeiro muda. Quando há um par de movimentos, a decisão
        // também é registrada na fundação de decisões persistentes.
        if (movement && input.relatedMovementId) {
          await ReconciliationDecisionService.reject({
            workspaceId: input.workspaceId,
            movementAId: movement.id,
            movementBId: input.relatedMovementId,
            notes: input.reason ?? "Conciliação de fatura",
          });
        }
        return { decision: "REJECT" };
      }
      case "IGNORE_DIVERGENCE":
        return { decision: "IGNORED" };
      default:
        return this.handleError(new Error("Ação não suportada."), "applyEffect");
    }
  }

  /** Desfaz uma correção, somente quando o lançamento não mudou depois. */
  async undo(actionId: UUID): Promise<InvoiceReconciliationActionRecord> {
    const Impl = CardInvoiceReconciliationActionServiceImpl;
    const { data, error } = await this.client
      .from("invoice_reconciliation_actions")
      .select("*")
      .eq("id", actionId)
      .maybeSingle();
    if (error) this.handleError(error, "undo");
    const action = data as unknown as InvoiceReconciliationActionRecord | null;
    if (!action) this.handleError(new Error("Ação não encontrada."), "undo");
    if (action!.undone_at) throw new DuplicateActionError();

    if (Impl.isDecision(action!.action)) {
      const { data: cleared, error: clearError } = await this.client
        .from("invoice_reconciliation_actions")
        .update({ undone_at: new Date().toISOString(), undone_by: await this.currentUserId() } as never)
        .eq("id", action!.id)
        .select()
        .single();
      if (clearError) this.handleError(clearError, "undo");
      return cleared as unknown as InvoiceReconciliationActionRecord;
    }

    const movement = action!.movement_id
      ? await MovementService.getById(action!.movement_id)
      : null;
    if (!Impl.canUndo(action!, movement)) {
      throw new Error(
        "Não é possível desfazer automaticamente porque o lançamento foi alterado posteriormente.",
      );
    }

    const before = action!.before_state as {
      amount?: number;
      transaction_date?: string;
      competence_date?: string | null;
    };
    if (action!.action === "CORRECT_AMOUNT" && before.amount !== undefined) {
      await MovementService.update(movement!.id, { amount: Number(before.amount) });
    } else if (action!.action === "CORRECT_DATE" && before.transaction_date) {
      await MovementService.update(movement!.id, {
        transaction_date: before.transaction_date,
      });
    } else if (action!.action === "CORRECT_COMPETENCE") {
      await MovementService.update(movement!.id, {
        competence_date: before.competence_date ?? null,
      });
    }

    const { data: undone, error: undoError } = await this.client
      .from("invoice_reconciliation_actions")
      .update({ undone_at: new Date().toISOString(), undone_by: await this.currentUserId() } as never)
      .eq("id", action!.id)
      .select()
      .single();
    if (undoError) this.handleError(undoError, "undo");
    return undone as unknown as InvoiceReconciliationActionRecord;
  }

  static isDecision(action: InvoiceReconciliationActionType): boolean {
    return action === "IGNORE_DIVERGENCE" || action === "MARK_NOT_SAME_MOVEMENT";
  }
}

export const CardInvoiceReconciliationActionService =
  new CardInvoiceReconciliationActionServiceImpl();
export { CardInvoiceReconciliationActionServiceImpl };
