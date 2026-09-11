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
import { CardInvoiceService } from "./CardInvoiceService";

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
import {
  INVOICE_AMOUNT_TOLERANCE,
  INVOICE_DATE_TOLERANCE_DAYS,
} from "@/constants/cardReconciliation";
import { MovementType } from "@/constants/enums";
import type { CreateMissingMovementPayload } from "@/models/CardInvoiceReconciliationAction";

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

/** Sprint 4.15B — o lançamento faltante já existe (criado em outra tela/importação). */
export class AlreadyRegisteredError extends Error {
  constructor() {
    super("Este lançamento já foi registrado ou conciliado.");
    this.name = "AlreadyRegisteredError";
  }
}

/**
 * Sprint 4.15C — a nova data faria o lançamento pertencer a OUTRA fatura.
 * Nunca movemos silenciosamente: o usuário precisa confirmar explicitamente.
 */
export class InvoiceChangeRequiresConfirmationError extends Error {
  readonly targetInvoiceId: UUID | null;
  constructor(targetInvoiceId: UUID | null) {
    super(
      "A nova data faz este lançamento pertencer a outra fatura. Confirme se deseja movê-lo.",
    );
    this.name = "InvoiceChangeRequiresConfirmationError";
    this.targetInvoiceId = targetInvoiceId;
  }
}

/** Sprint 4.15C — a alteração não chegou à tabela `movements`. */
export class PersistenceVerificationError extends Error {
  constructor() {
    super("A alteração não foi confirmada no lançamento. Nada foi registrado.");
    this.name = "PersistenceVerificationError";
  }
}

export class InvalidInvoiceMoveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidInvoiceMoveError";
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
        // Sprint 4.15B — criar o lançamento faltante é uma ação manual explícita.
        return item.candidates.length > 0
          ? ["LINK_EXISTING_MOVEMENT", "CREATE_MISSING_MOVEMENT", "IGNORE_DIVERGENCE"]
          : ["CREATE_MISSING_MOVEMENT", "IGNORE_DIVERGENCE"];
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
      input.targetInvoiceId ? `i=${input.targetInvoiceId}` : "",
      input.createPayload
        ? `n=${Number(input.createPayload.amount).toFixed(2)}@${input.createPayload.transactionDate}`
        : "",
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

    if (input.action === "MOVE_TO_ANOTHER_INVOICE") {
      return this.moveToAnotherInvoice(input, movement);
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
      // 3) Recalcula SEMPRE a fatura selecionada (id explícito da rota).
      if (!CardInvoiceReconciliationActionServiceImpl.isDecision(input.action)) {
        await CardInvoiceService.recompute(input.invoiceId);
      }

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

  private async moveToAnotherInvoice(
    input: ExecuteInvoiceActionInput,
    movement: Movement | null,
  ): Promise<InvoiceReconciliationActionRecord> {
    const targetInvoiceId = input.targetInvoiceId;
    if (!movement || !targetInvoiceId) {
      throw new InvalidInvoiceMoveError("Selecione um lançamento e uma fatura destino.");
    }
    if (!input.reason?.trim()) {
      throw new InvalidInvoiceMoveError("Informe o motivo da alteração.");
    }
    if (targetInvoiceId === input.invoiceId) {
      throw new InvalidInvoiceMoveError("A fatura destino deve ser diferente da fatura atual.");
    }
    if (movement.invoice_id === targetInvoiceId) {
      throw new InvalidInvoiceMoveError("Este lançamento já está na fatura selecionada.");
    }
    if (movement.invoice_id !== input.invoiceId) throw new ConcurrentChangeError();

    const [origin, target] = await Promise.all([
      CardInvoiceService.getById(input.invoiceId),
      CardInvoiceService.getById(targetInvoiceId),
    ]);
    if (!origin || !target) throw new InvalidInvoiceMoveError("Fatura não encontrada.");
    if (
      origin.workspace_id !== input.workspaceId ||
      target.workspace_id !== input.workspaceId ||
      movement.workspace_id !== input.workspaceId
    ) {
      throw new InvalidInvoiceMoveError("A operação pertence a outro workspace.");
    }
    if (!movement.card_id || origin.card_id !== movement.card_id || target.card_id !== origin.card_id) {
      throw new InvalidInvoiceMoveError("A fatura destino deve pertencer ao mesmo cartão.");
    }

    const moved = await MovementService.moveToInvoice(
      movement.id,
      input.invoiceId,
      targetInvoiceId,
    );
    if (!moved) throw new ConcurrentChangeError();
    const fresh = await this.verify(
      movement.id,
      (row) => row.invoice_id === targetInvoiceId,
    );

    const before = {
      invoice_id: input.invoiceId,
      target_invoice_id: targetInvoiceId,
      amount: Number(movement.amount),
      transaction_date: movement.transaction_date,
      competence_date: movement.competence_date,
      description: movement.description,
      card_id: movement.card_id,
      signature: CardInvoiceReconciliationActionServiceImpl.signature(movement),
    };
    const after = {
      invoice_id: fresh.invoice_id,
      origin_invoice_id: input.invoiceId,
      target_invoice_id: targetInvoiceId,
      amount: Number(fresh.amount),
      signature: CardInvoiceReconciliationActionServiceImpl.signature(fresh),
    };
    const userId = await this.currentUserId();
    const { data: inserted, error } = await this.client
      .from("invoice_reconciliation_actions")
      .insert({
        workspace_id: input.workspaceId,
        invoice_id: input.invoiceId,
        item_key: input.itemKey,
        movement_id: movement.id,
        related_movement_id: null,
        action: input.action,
        before_state: before,
        after_state: after,
        reason: input.reason.trim(),
        source: "MANUAL",
        idempotency_key: CardInvoiceReconciliationActionServiceImpl.idempotencyKey(input),
        performed_by: userId,
      } as never)
      .select()
      .single();
    if (error) this.handleError(error, "moveToAnotherInvoice.audit");

    await CardInvoiceService.recompute(input.invoiceId);
    await CardInvoiceService.recompute(targetInvoiceId);
    const [freshOrigin, freshTarget] = await Promise.all([
      CardInvoiceService.getById(input.invoiceId),
      CardInvoiceService.getById(targetInvoiceId),
    ]);
    if (!freshOrigin || !freshTarget) throw new PersistenceVerificationError();
    return inserted as unknown as InvoiceReconciliationActionRecord;
  }

  /** Regra pura: um lançamento existente já representa o item da fatura? */
  static matchesPayload(
    m: Pick<Movement, "card_id" | "amount" | "transaction_date" | "deleted_at">,
    payload: CreateMissingMovementPayload,
  ): boolean {
    if (m.deleted_at) return false;
    if (m.card_id !== payload.cardId) return false;
    if (Math.abs(Math.abs(Number(m.amount)) - Math.abs(Number(payload.amount))) > INVOICE_AMOUNT_TOLERANCE)
      return false;
    const diff =
      Math.abs(
        new Date(`${m.transaction_date}T00:00:00Z`).getTime() -
          new Date(`${payload.transactionDate}T00:00:00Z`).getTime(),
      ) /
      86_400_000;
    return diff <= INVOICE_DATE_TOLERANCE_DAYS;
  }

  private static shiftDate(date: string, days: number): string {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  /** Revalida, no momento do salvamento, se o lançamento já existe. */
  private async findExistingMovement(
    workspaceId: UUID,
    payload: CreateMissingMovementPayload,
  ): Promise<Movement | null> {
    const Impl = CardInvoiceReconciliationActionServiceImpl;
    const movements = await MovementService.list(workspaceId, {
      cardId: payload.cardId,
      from: Impl.shiftDate(payload.transactionDate, -INVOICE_DATE_TOLERANCE_DAYS),
      to: Impl.shiftDate(payload.transactionDate, INVOICE_DATE_TOLERANCE_DAYS),
    });
    return movements.find((m) => Impl.matchesPayload(m, payload)) ?? null;
  }

  /**
   * Sprint 4.15C — relê o lançamento no banco e só considera a ação bem
   * sucedida quando a alteração está realmente persistida em `movements`.
   */
  private async verify(
    movementId: UUID,
    predicate: (m: Movement) => boolean,
  ): Promise<Movement> {
    const fresh = await MovementService.getById(movementId);
    if (!fresh || !predicate(fresh)) throw new PersistenceVerificationError();
    return fresh;
  }


  private async applyEffect(
    input: ExecuteInvoiceActionInput,
    movement: Movement | null,
  ): Promise<Record<string, unknown>> {
    const Impl = CardInvoiceReconciliationActionServiceImpl;

    switch (input.action) {
      case "CREATE_MISSING_MOVEMENT": {
        const payload = input.createPayload;
        if (!payload) this.handleError(new Error("Dados do lançamento ausentes."), "applyEffect");
        // Revalidação de duplicidade no momento do salvamento (a tela pode ter
        // sido aberta antes de uma importação criar o mesmo lançamento).
        const existing = await this.findExistingMovement(input.workspaceId, payload!);
        if (existing) throw new AlreadyRegisteredError();

        const created = await MovementService.create({
          workspace_id: input.workspaceId,
          card_id: payload!.cardId,
          type: MovementType.EXPENSE,
          description: payload!.description,
          amount: Math.abs(Number(payload!.amount)),
          transaction_date: payload!.transactionDate,
          competence_date: payload!.competenceDate ?? null,
          category_id: payload!.categoryId ?? null,
          subcategory_id: payload!.subcategoryId ?? null,
          notes: payload!.notes ?? null,
        });

        // Sprint 4.15C — o vínculo é SEMPRE a fatura em conciliação, nunca a
        // fatura descoberta pela data.
        if (created.invoice_id !== input.invoiceId) {
          await MovementService.update(created.id, { invoice_id: input.invoiceId });
        }
        const linked = await this.verify(created.id, (m) => m.invoice_id === input.invoiceId);

        return {
          movement_id: linked.id,
          invoice_id: linked.invoice_id,
          amount: Number(linked.amount),
          transaction_date: linked.transaction_date,
          signature: Impl.signature(linked),
        };
      }
      case "LINK_EXISTING_MOVEMENT":
      case "SELECT_MATCH_CANDIDATE": {
        if (!movement) this.handleError(new Error("Selecione um lançamento."), "applyEffect");
        // Vincular NUNCA cria movimento: apenas ajusta a relação existente.
        if (movement!.invoice_id !== input.invoiceId) {
          await MovementService.update(movement!.id, { invoice_id: input.invoiceId });
        }
        const next = await this.verify(movement!.id, (m) => m.invoice_id === input.invoiceId);
        return { invoice_id: next.invoice_id, signature: Impl.signature(next) };
      }
      case "CORRECT_AMOUNT": {
        if (!movement || input.newAmount === undefined) {
          this.handleError(new Error("Valor inválido."), "applyEffect");
        }
        const amount = Math.abs(Number(input.newAmount));
        const applied = Math.abs(Number(movement!.amount) - amount) <= 0.0001;
        if (!applied) {
          await MovementService.update(movement!.id, {
            amount,
            // preserva a fatura em conciliação
            invoice_id: movement!.invoice_id ?? input.invoiceId,
          });
        }
        const next = await this.verify(
          movement!.id,
          (m) => Math.abs(Number(m.amount) - amount) <= 0.0001,
        );
        return {
          amount: Number(next.amount),
          invoice_id: next.invoice_id,
          signature: Impl.signature(next),
        };
      }
      case "CORRECT_DATE": {
        if (!movement || !input.newDate) {
          this.handleError(new Error("Data inválida."), "applyEffect");
        }
        const newDate = input.newDate!;
        // A nova data pertenceria a outra fatura? Nunca movemos em silêncio.
        let targetInvoiceId: UUID | null = input.invoiceId;
        if (movement!.card_id && newDate !== movement!.transaction_date) {
          const found = await CardInvoiceService.findInvoiceIdForDate(
            movement!.card_id,
            newDate,
          );
          if (found && found !== input.invoiceId) {
            if (!input.allowInvoiceChange) {
              throw new InvoiceChangeRequiresConfirmationError(found);
            }
            targetInvoiceId = found;
          }
        }
        if (movement!.transaction_date !== newDate || movement!.invoice_id !== targetInvoiceId) {
          // Competência não muda junto: é uma decisão separada.
          await MovementService.update(movement!.id, {
            transaction_date: newDate,
            invoice_id: targetInvoiceId,
          });
        }
        const next = await this.verify(
          movement!.id,
          (m) => m.transaction_date === newDate && m.invoice_id === targetInvoiceId,
        );
        return {
          transaction_date: next.transaction_date,
          invoice_id: next.invoice_id,
          moved_invoice: targetInvoiceId !== input.invoiceId,
          signature: Impl.signature(next),
        };
      }
      case "CORRECT_COMPETENCE": {
        if (!movement || !input.newCompetence) {
          this.handleError(new Error("Competência inválida."), "applyEffect");
        }
        const competence = input.newCompetence!;
        if (movement!.competence_date !== competence) {
          await MovementService.update(movement!.id, {
            competence_date: competence,
            invoice_id: movement!.invoice_id ?? input.invoiceId,
          });
        }
        const next = await this.verify(
          movement!.id,
          (m) => m.competence_date === competence,
        );
        return {
          competence_date: next.competence_date,
          invoice_id: next.invoice_id,
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
