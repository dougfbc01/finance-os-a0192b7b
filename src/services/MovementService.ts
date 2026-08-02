// MovementService — Serviço central de movimentações financeiras.
// Concentra a criação, atualização, exclusão lógica, listagem e o cálculo
// de saldos e indicadores derivados. Nenhuma regra financeira deve viver
// fora desta camada.

import { BaseService } from "./BaseService";
import { CardService, CardServiceImpl } from "./CardService";
import {
  MovementType,
  MovementStatus,
  MOVEMENT_TYPE_SIGN,
  INCOME_TYPES,
  EXPENSE_TYPES,
} from "@/constants/enums";
import type {
  Movement,
  CreateMovementInput,
  UpdateMovementInput,
  MovementFilters,
  UUID,
} from "@/models";

type Row = Record<string, unknown>;

class MovementServiceImpl extends BaseService {
  private readonly table = "movements" as const;

  private mapRow(r: Row): Movement {
    return {
      ...(r as unknown as Movement),
      amount: Number((r as { amount: unknown }).amount),
      tags: ((r as { tags?: unknown }).tags as string[] | null) ?? [],
      attachments:
        ((r as { attachments?: unknown }).attachments as Movement["attachments"] | null) ?? [],
    };
  }

  // ---------------------------------------------------------------------------
  // Consultas
  // ---------------------------------------------------------------------------

  async list(workspaceId: UUID, filters: MovementFilters = {}): Promise<Movement[]> {
    let q = this.client
      .from(this.table)
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null);

    if (filters.from) q = q.gte("transaction_date", filters.from);
    if (filters.to) q = q.lte("transaction_date", filters.to);
    if (filters.accountId && filters.accountId !== "all") {
      q = q.or(`account_id.eq.${filters.accountId},transfer_account_id.eq.${filters.accountId}`);
    }
    if (filters.cardId && filters.cardId !== "all") {
      q = q.eq("card_id", filters.cardId);
    }
    if (filters.categoryId && filters.categoryId !== "all") {
      q = q.eq("category_id", filters.categoryId);
    }
    if (filters.type && filters.type !== "all") q = q.eq("type", filters.type);
    if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
    if (filters.search) q = q.ilike("description", `%${filters.search}%`);

    // Grupos lógicos (Todos/Conta/Cartão/Transferências/Receitas/Despesas/Investimentos).
    switch (filters.group) {
      case "account":
        q = q.is("card_id", null).neq("type", MovementType.TRANSFER);
        break;
      case "card":
        q = q.not("card_id", "is", null);
        break;
      case "transfer":
        q = q.eq("type", MovementType.TRANSFER);
        break;
      case "income":
        q = q.in("type", INCOME_TYPES);
        break;
      case "expense":
        q = q.in("type", EXPENSE_TYPES);
        break;
      case "investment":
        q = q.in("type", [MovementType.INVESTMENT, MovementType.DIVIDEND, MovementType.INTEREST]);
        break;
      default:
        break;
    }

    const { data, error } = await q
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) this.handleError(error, "list");
    return (data ?? []).map((r) => this.mapRow(r as Row));
  }

  async getById(id: UUID): Promise<Movement | null> {
    const { data, error } = await this.client
      .from(this.table)
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) this.handleError(error, "getById");
    return data ? this.mapRow(data as Row) : null;
  }

  // ---------------------------------------------------------------------------
  // Mutações
  // ---------------------------------------------------------------------------

  async create(input: CreateMovementInput): Promise<Movement> {
    this.validateInput(input);

    const invoiceId = await this.resolveInvoiceId(
      input.card_id ?? null,
      input.transaction_date,
      input.type,
    );

    // Autopreenchimento de competência/vencimento (Sprint 3.1 - Parte 2)
    const { competence, dueDate, cardStatus } = await this.resolveDates(input, invoiceId);

    const isCardPurchase =
      !!input.card_id &&
      input.type !== MovementType.TRANSFER &&
      input.type !== MovementType.CARD_PAYMENT;

    const payload: Row = {
      workspace_id: input.workspace_id,
      account_id: input.account_id ?? null,
      transfer_account_id:
        input.type === MovementType.TRANSFER ? (input.transfer_account_id ?? null) : null,
      category_id: input.type === MovementType.TRANSFER ? null : (input.category_id ?? null),
      subcategory_id: input.type === MovementType.TRANSFER ? null : (input.subcategory_id ?? null),
      card_id: input.card_id ?? null,
      invoice_id: invoiceId,
      asset_id: input.asset_id ?? null,
      type: input.type,
      status: input.status ?? (isCardPurchase ? MovementStatus.PENDING : cardStatus),
      description: (input.description ?? "").trim(),
      notes: input.notes ?? null,
      amount: Math.abs(Number(input.amount)),
      transaction_date: input.transaction_date,
      competence_date: input.competence_date ?? competence,
      due_date: input.due_date ?? dueDate,
      tags: input.tags ?? [],
      attachments: input.attachments ?? [],
      transfer_group_id:
        input.type === MovementType.TRANSFER ? (globalThis.crypto?.randomUUID?.() ?? null) : null,
    };

    const { data, error } = await this.client
      .from(this.table)
      .insert(payload as never)
      .select("*")
      .single();
    if (error) this.handleError(error, "create");
    return this.mapRow(data as Row);
  }

  /**
   * Deriva competence_date, due_date e status inicial conforme a origem
   * (conta bancária, compra em cartão, pagamento de fatura).
   */
  private async resolveDates(
    input: CreateMovementInput,
    invoiceId: UUID | null,
  ): Promise<{ competence: string; dueDate: string; cardStatus: MovementStatus }> {
    const txn = input.transaction_date;
    // Compra em cartão → competence = data, vencimento = due_date da fatura
    if (
      input.card_id &&
      input.type !== MovementType.TRANSFER &&
      input.type !== MovementType.CARD_PAYMENT
    ) {
      let due = txn;
      if (invoiceId) {
        const { data } = await this.client
          .from("card_invoices")
          .select("due_date")
          .eq("id", invoiceId)
          .maybeSingle();
        if (data && (data as { due_date?: string }).due_date) {
          due = (data as { due_date: string }).due_date;
        }
      }
      return { competence: txn, dueDate: due, cardStatus: MovementStatus.PENDING };
    }
    // Pagamento de fatura, conta ou transferência → competence = vencimento = data
    return { competence: txn, dueDate: txn, cardStatus: MovementStatus.CLEARED };
  }

  async update(id: UUID, input: UpdateMovementInput): Promise<Movement> {
    const existing = await this.getById(id);
    if (!existing) this.handleError(new Error("Movimentação não encontrada."), "update");

    const nextType = input.type ?? existing!.type;
    const merged: CreateMovementInput = {
      workspace_id: existing!.workspace_id,
      type: nextType,
      account_id: input.account_id ?? existing!.account_id,
      transfer_account_id: input.transfer_account_id ?? existing!.transfer_account_id,
      amount: input.amount ?? existing!.amount,
      transaction_date: input.transaction_date ?? existing!.transaction_date,
      card_id: input.card_id ?? existing!.card_id,
    };
    this.validateInput(merged);

    const payload: Row = { ...input };
    if (input.amount !== undefined) payload.amount = Math.abs(Number(input.amount));
    if (input.description !== undefined) payload.description = input.description.trim();
    if (nextType === MovementType.TRANSFER) {
      payload.category_id = null;
      payload.subcategory_id = null;
      payload.card_id = null;
      payload.invoice_id = null;
    } else {
      payload.transfer_account_id = null;
    }

    // Se o vínculo com cartão/data mudou, reatribui a fatura correspondente.
    const nextCardId = input.card_id !== undefined ? input.card_id : existing!.card_id;
    const nextDate = input.transaction_date ?? existing!.transaction_date;
    const cardChanged = input.card_id !== undefined && input.card_id !== existing!.card_id;
    const dateChanged =
      input.transaction_date !== undefined && input.transaction_date !== existing!.transaction_date;
    if (nextType !== MovementType.TRANSFER && (cardChanged || dateChanged)) {
      payload.invoice_id = await this.resolveInvoiceId(nextCardId, nextDate, nextType);
    }

    // Sprint 4.0.1 — recalcula competência/vencimento apenas quando não vieram
    // explicitamente do formulário (edição manual sempre prevalece).
    const needsDates =
      input.competence_date === undefined ||
      input.due_date === undefined ||
      input.competence_date === null ||
      input.due_date === null;
    if (needsDates) {
      const invoiceIdForDates =
        (payload.invoice_id as UUID | null | undefined) ?? existing!.invoice_id;
      const { competence, dueDate } = await this.resolveDates(
        { ...merged, transaction_date: nextDate },
        (invoiceIdForDates as UUID | null) ?? null,
      );
      if (input.competence_date === undefined || input.competence_date === null)
        payload.competence_date = competence;
      if (input.due_date === undefined || input.due_date === null) payload.due_date = dueDate;
    }

    const { data, error } = await this.client
      .from(this.table)
      .update(payload as never)
      .eq("id", id)
      .select("*")
      .single();
    if (error) this.handleError(error, "update");
    return this.mapRow(data as Row);
  }

  /**
   * Garante que exista uma fatura para o par (cartão, data de compra) e retorna
   * seu id. Nunca chamado para transferências ou pagamentos de fatura.
   */
  private async resolveInvoiceId(
    cardId: UUID | null | undefined,
    transactionDate: string,
    type: MovementType,
  ): Promise<UUID | null> {
    if (!cardId) return null;
    if (type === MovementType.TRANSFER || type === MovementType.CARD_PAYMENT) return null;
    const card = await CardService.getById(cardId);
    if (!card) return null;
    const period = CardServiceImpl.computeInvoicePeriod(card, transactionDate);

    const existing = await this.client
      .from("card_invoices")
      .select("id, closing_date, due_date")
      .eq("card_id", card.id)
      .eq("competence", period.competence)
      .is("deleted_at", null)
      .maybeSingle();
    if (existing.error) this.handleError(existing.error, "resolveInvoice.find");
    if (existing.data) {
      const row = existing.data as { id: UUID; closing_date: string; due_date: string };
      // Sprint 3.4: mantém as datas da fatura coerentes com closing_day/due_day do cartão.
      if (row.closing_date !== period.closing_date || row.due_date !== period.due_date) {
        await this.client
          .from("card_invoices")
          .update({ closing_date: period.closing_date, due_date: period.due_date } as never)
          .eq("id", row.id);
      }
      return row.id;
    }

    const { data, error } = await this.client
      .from("card_invoices")
      .insert({
        workspace_id: card.workspace_id,
        card_id: card.id,
        competence: period.competence,
        closing_date: period.closing_date,
        due_date: period.due_date,
        amount: 0,
        status: "OPEN",
      } as never)
      .select("id")
      .single();
    if (error) this.handleError(error, "resolveInvoice.create");
    return (data as { id: UUID }).id;
  }

  async softDelete(id: UUID): Promise<void> {
    const { error } = await this.client
      .from(this.table)
      .update({ deleted_at: new Date().toISOString() } as never)
      .eq("id", id);
    if (error) this.handleError(error, "softDelete");
  }

  // ---------------------------------------------------------------------------
  // Operações em massa
  // ---------------------------------------------------------------------------

  async bulkSoftDelete(ids: UUID[]): Promise<void> {
    if (!ids.length) return;
    const { error } = await this.client
      .from(this.table)
      .update({ deleted_at: new Date().toISOString() } as never)
      .in("id", ids);
    if (error) this.handleError(error, "bulkSoftDelete");
  }

  async bulkUpdate(
    ids: UUID[],
    patch: Partial<{
      category_id: UUID | null;
      subcategory_id: UUID | null;
      status: MovementStatus;
    }>,
  ): Promise<void> {
    if (!ids.length) return;
    const clean: Row = {};
    if (patch.category_id !== undefined) clean.category_id = patch.category_id;
    if (patch.subcategory_id !== undefined) clean.subcategory_id = patch.subcategory_id;
    if (patch.status !== undefined) clean.status = patch.status;
    if (!Object.keys(clean).length) return;
    const { error } = await this.client
      .from(this.table)
      .update(clean as never)
      .in("id", ids);
    if (error) this.handleError(error, "bulkUpdate");
  }

  // ---------------------------------------------------------------------------
  // Derivados
  // ---------------------------------------------------------------------------

  /**
   * Impacto de uma movimentação sobre o saldo de uma conta específica.
   * REGRA CONTÁBIL (Mega Sprint 3):
   *  - Movimentos vinculados a um cartão (compras/estornos com card_id) NUNCA
   *    afetam o saldo da conta bancária. Eles compõem o passivo da fatura.
   *  - Somente CARD_PAYMENT (quitação de fatura) altera a conta.
   *  - TRANSFER debita da origem e credita no destino.
   */
  static impactOnAccount(m: Movement, accountId: UUID): number {
    if (m.type === MovementType.TRANSFER) {
      if (m.account_id === accountId) return -m.amount;
      if (m.transfer_account_id === accountId) return m.amount;
      return 0;
    }
    // Compras no cartão: passivo, não caixa.
    if (m.card_id && m.type !== MovementType.CARD_PAYMENT) return 0;
    if (m.account_id !== accountId) return 0;
    return MOVEMENT_TYPE_SIGN[m.type] * m.amount;
  }

  /** Regra 002: transferências e pagamento de cartão nunca são receita nem despesa. */
  static isIncome(m: Movement): boolean {
    return INCOME_TYPES.includes(m.type);
  }
  static isExpense(m: Movement): boolean {
    return EXPENSE_TYPES.includes(m.type);
  }

  // ---------------------------------------------------------------------------
  // Validações internas
  // ---------------------------------------------------------------------------

  private validateInput(input: CreateMovementInput) {
    if (!input.workspace_id) this.handleError(new Error("workspace_id obrigatório."), "validate");
    if (!input.type) this.handleError(new Error("Tipo é obrigatório."), "validate");
    if (input.amount === undefined || input.amount === null || Number.isNaN(Number(input.amount))) {
      this.handleError(new Error("Valor inválido."), "validate");
    }
    if (Number(input.amount) <= 0) {
      this.handleError(new Error("Valor deve ser maior que zero."), "validate");
    }
    if (!input.transaction_date) this.handleError(new Error("Data é obrigatória."), "validate");

    if (input.type === MovementType.TRANSFER) {
      if (!input.account_id || !input.transfer_account_id) {
        this.handleError(new Error("Transferência exige conta de origem e destino."), "validate");
      }
      if (input.account_id === input.transfer_account_id) {
        this.handleError(new Error("Origem e destino devem ser contas diferentes."), "validate");
      }
    } else if (!input.account_id && !input.card_id) {
      // Compras vinculadas a cartão dispensam conta bancária.
      this.handleError(new Error("Selecione uma conta ou um cartão."), "validate");
    }
  }
}

export const MovementService = new MovementServiceImpl();
export { MovementServiceImpl };
