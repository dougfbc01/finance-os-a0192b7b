// CardInvoiceService — CRUD e consolidação de faturas de cartão.
// Regras: ensureInvoice cria a fatura se ainda não existir para a competência.
// recompute atualiza `amount` a partir dos movimentos vinculados.
// markPaid gera UM único CARD_PAYMENT na conta bancária e sinaliza a fatura.
import { BaseService } from "./BaseService";
import { CardServiceImpl } from "./CardService";
import { MovementService } from "./MovementService";
import { MovementStatus, MovementType } from "@/constants/enums";
import type { Card, Movement, UUID } from "@/models";
import type { CardInvoice, CardInvoiceStatus } from "@/models/CardInvoice";

type Row = Record<string, unknown>;

class CardInvoiceServiceImpl extends BaseService {
  private readonly table = "card_invoices" as const;

  /**
   * Sprint 3.4 — o status exibido é sempre derivado das datas (projeção pura).
   * A coluna `status` só é fonte de verdade para PAID.
   */
  private withDerivedStatus(row: CardInvoice): CardInvoice {
    return {
      ...row,
      amount: Number(row.amount),
      status: CardServiceImpl.computeInvoiceStatus(row) as CardInvoiceStatus,
    };
  }

  async listByWorkspace(workspaceId: UUID): Promise<CardInvoice[]> {
    const { data, error } = await this.client
      .from(this.table)
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("competence", { ascending: false });
    if (error) this.handleError(error, "listByWorkspace");
    return ((data ?? []) as unknown as CardInvoice[]).map((i) => this.withDerivedStatus(i));
  }

  async listByCard(cardId: UUID): Promise<CardInvoice[]> {
    const { data, error } = await this.client
      .from(this.table)
      .select("*")
      .eq("card_id", cardId)
      .is("deleted_at", null)
      .order("competence", { ascending: false });
    if (error) this.handleError(error, "listByCard");
    return ((data ?? []) as unknown as CardInvoice[]).map((i) => this.withDerivedStatus(i));
  }

  async getById(id: UUID): Promise<CardInvoice | null> {
    const { data, error } = await this.client
      .from(this.table)
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) this.handleError(error, "getById");
    if (!data) return null;
    return this.withDerivedStatus(data as unknown as CardInvoice);
  }

  /**
   * Garante que exista fatura para a competência da compra.
   * Retorna o id da fatura correspondente.
   */
  async ensureInvoice(card: Card, purchaseDate: string): Promise<UUID> {
    const period = CardServiceImpl.computeInvoicePeriod(card, purchaseDate);
    const existing = await this.client
      .from(this.table)
      .select("id, closing_date, due_date")
      .eq("card_id", card.id)
      .eq("competence", period.competence)
      .is("deleted_at", null)
      .maybeSingle();
    if (existing.error) this.handleError(existing.error, "ensureInvoice.find");
    if (existing.data) {
      const row = existing.data as { id: UUID; closing_date: string; due_date: string };
      // Corrige faturas legadas com datas divergentes da regra atual do cartão.
      if (row.closing_date !== period.closing_date || row.due_date !== period.due_date) {
        await this.client
          .from(this.table)
          .update({ closing_date: period.closing_date, due_date: period.due_date } as never)
          .eq("id", row.id);
      }
      return row.id;
    }

    const { data, error } = await this.client
      .from(this.table)
      .insert({
        workspace_id: card.workspace_id,
        card_id: card.id,
        competence: period.competence,
        closing_date: period.closing_date,
        due_date: period.due_date,
        amount: 0,
        status: "OPEN" as CardInvoiceStatus,
      } as never)
      .select("id")
      .single();
    if (error) this.handleError(error, "ensureInvoice.create");
    return (data as { id: UUID }).id;
  }

  /**
   * Recalcula `amount` e status da fatura. O trigger `movements_recompute_invoice`
   * já mantém o valor sincronizado — este método serve como fallback defensivo
   * e para atualizar o status quando o tempo passa (fatura vira OVERDUE/CLOSED).
   * Usa a RPC com validação de posse do workspace.
   */
  async recompute(invoiceId: UUID): Promise<void> {
    const { error } = await this.client.rpc(
      "recompute_my_card_invoice" as never,
      {
        _invoice_id: invoiceId,
      } as never,
    );
    if (error) this.handleError(error, "recompute");
  }

  /**
   * Marca fatura como paga: cria um único movimento CARD_PAYMENT na conta
   * bancária e vincula à fatura. Nunca duplica compras.
   * O valor pago usa sempre o total computado pelo trigger.
   */
  async markPaid(params: {
    invoiceId: UUID;
    accountId: UUID;
    workspaceId: UUID;
    paidAt: string;
    amount?: number;
  }): Promise<Movement> {
    // Garante que o valor está atualizado antes de sacar da conta.
    await this.recompute(params.invoiceId);
    const invoice = await this.getById(params.invoiceId);
    if (!invoice) throw new Error("Fatura não encontrada.");
    if (invoice.paid_movement_id) throw new Error("Fatura já foi paga.");

    const movement = await MovementService.create({
      workspace_id: params.workspaceId,
      account_id: params.accountId,
      type: MovementType.CARD_PAYMENT,
      status: MovementStatus.CLEARED,
      amount: params.amount ?? invoice.amount,
      transaction_date: params.paidAt,
      description: `Pagamento fatura`,
    });

    const { error } = await this.client
      .from(this.table)
      .update({
        status: "PAID" as CardInvoiceStatus,
        paid_at: params.paidAt,
        paid_movement_id: movement.id,
      } as never)
      .eq("id", params.invoiceId);
    if (error) this.handleError(error, "markPaid.update");
    return movement;
  }

  async listMovements(invoiceId: UUID): Promise<Movement[]> {
    const { data, error } = await this.client
      .from("movements")
      .select("*")
      .eq("invoice_id", invoiceId)
      .is("deleted_at", null)
      .order("transaction_date", { ascending: false });
    if (error) this.handleError(error, "listMovements");
    return ((data ?? []) as unknown as Movement[]).map((m) => ({ ...m, amount: Number(m.amount) }));
  }
}

export const CardInvoiceService = new CardInvoiceServiceImpl();
export { CardInvoiceServiceImpl };
