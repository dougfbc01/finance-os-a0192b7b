// MovementService — Serviço central de movimentações financeiras.
// Concentra a criação, atualização, exclusão lógica, listagem e o cálculo
// de saldos e indicadores derivados. Nenhuma regra financeira deve viver
// fora desta camada.

import { BaseService } from "./BaseService";
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
      attachments: ((r as { attachments?: unknown }).attachments as Movement["attachments"] | null) ?? [],
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
    if (filters.categoryId && filters.categoryId !== "all") {
      q = q.eq("category_id", filters.categoryId);
    }
    if (filters.type && filters.type !== "all") q = q.eq("type", filters.type);
    if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
    if (filters.search) q = q.ilike("description", `%${filters.search}%`);

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

    const payload: Row = {
      workspace_id: input.workspace_id,
      account_id: input.account_id ?? null,
      transfer_account_id:
        input.type === MovementType.TRANSFER ? input.transfer_account_id ?? null : null,
      category_id: input.type === MovementType.TRANSFER ? null : input.category_id ?? null,
      subcategory_id: input.type === MovementType.TRANSFER ? null : input.subcategory_id ?? null,
      card_id: input.card_id ?? null,
      asset_id: input.asset_id ?? null,
      type: input.type,
      status: input.status ?? MovementStatus.CLEARED,
      description: (input.description ?? "").trim(),
      notes: input.notes ?? null,
      amount: Math.abs(Number(input.amount)),
      transaction_date: input.transaction_date,
      competence_date: input.competence_date ?? null,
      due_date: input.due_date ?? null,
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
    };
    this.validateInput(merged);

    const payload: Row = { ...input };
    if (input.amount !== undefined) payload.amount = Math.abs(Number(input.amount));
    if (input.description !== undefined) payload.description = input.description.trim();
    if (nextType === MovementType.TRANSFER) {
      payload.category_id = null;
      payload.subcategory_id = null;
    } else {
      payload.transfer_account_id = null;
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

  async softDelete(id: UUID): Promise<void> {
    const { error } = await this.client
      .from(this.table)
      .update({ deleted_at: new Date().toISOString() } as never)
      .eq("id", id);
    if (error) this.handleError(error, "softDelete");
  }

  // ---------------------------------------------------------------------------
  // Derivados
  // ---------------------------------------------------------------------------

  /**
   * Impacto de uma movimentação sobre o saldo de uma conta específica.
   * TRANSFER debita da origem (account_id) e credita no destino
   * (transfer_account_id). Demais tipos usam MOVEMENT_TYPE_SIGN.
   */
  static impactOnAccount(m: Movement, accountId: UUID): number {
    if (m.type === MovementType.TRANSFER) {
      if (m.account_id === accountId) return -m.amount;
      if (m.transfer_account_id === accountId) return m.amount;
      return 0;
    }
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
    } else if (!input.account_id) {
      this.handleError(new Error("Selecione uma conta."), "validate");
    }
  }
}

export const MovementService = new MovementServiceImpl();
export { MovementServiceImpl };
