// CardService — CRUD e regras dos cartões de crédito.
// Toda regra financeira (limite, cálculo de fatura, período de competência)
// vive aqui — nunca nos componentes.
import { BaseService } from "./BaseService";
import type { Card, CreateCardInput, UpdateCardInput, UUID, Movement } from "@/models";
import type { InvoicePeriod } from "@/models/CardInvoice";

type Row = Record<string, unknown>;

function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

class CardServiceImpl extends BaseService {
  private readonly table = "cards" as const;

  async list(workspaceId: UUID): Promise<Card[]> {
    const { data, error } = await this.client
      .from(this.table)
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) this.handleError(error, "list");
    return ((data ?? []) as unknown as Card[]).map((c) => ({
      ...c,
      credit_limit: Number(c.credit_limit),
    }));
  }

  async getById(id: UUID): Promise<Card | null> {
    const { data, error } = await this.client
      .from(this.table)
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) this.handleError(error, "getById");
    if (!data) return null;
    return { ...(data as unknown as Card), credit_limit: Number((data as Row).credit_limit) };
  }

  private validate(input: Partial<CreateCardInput>) {
    if (input.name !== undefined && !input.name.trim())
      this.handleError(new Error("Nome do cartão é obrigatório."), "validate");
    if (input.closing_day !== undefined && (input.closing_day < 1 || input.closing_day > 31))
      this.handleError(new Error("Dia de fechamento inválido."), "validate");
    if (input.due_day !== undefined && (input.due_day < 1 || input.due_day > 31))
      this.handleError(new Error("Dia de vencimento inválido."), "validate");
    if (input.credit_limit !== undefined && input.credit_limit < 0)
      this.handleError(new Error("Limite deve ser positivo."), "validate");
  }

  async create(input: CreateCardInput): Promise<Card> {
    this.validate(input);
    const payload: Row = {
      workspace_id: input.workspace_id,
      account_id: input.account_id,
      parent_card_id: input.parent_card_id ?? null,
      name: input.name.trim(),
      brand: input.brand?.trim() || null,
      holder_name: input.holder_name?.trim() || null,
      last_digits: input.last_digits?.trim() || null,
      credit_limit: input.credit_limit,
      closing_day: input.closing_day,
      due_day: input.due_day,
      color: input.color ?? "#6366F1",
      notes: input.notes ?? null,
      display_order: input.display_order ?? 0,
      is_active: true,
    };
    const { data, error } = await this.client
      .from(this.table)
      .insert(payload as never)
      .select("*")
      .single();
    if (error) this.handleError(error, "create");
    return data as unknown as Card;
  }

  async update(id: UUID, input: UpdateCardInput): Promise<Card> {
    this.validate(input);
    const payload: Row = { ...input };
    if (typeof payload.name === "string") payload.name = payload.name.trim();
    const { data, error } = await this.client
      .from(this.table)
      .update(payload as never)
      .eq("id", id)
      .select("*")
      .single();
    if (error) this.handleError(error, "update");
    return data as unknown as Card;
  }

  async setActive(id: UUID, isActive: boolean): Promise<void> {
    const { error } = await this.client
      .from(this.table)
      .update({ is_active: isActive } as never)
      .eq("id", id);
    if (error) this.handleError(error, "setActive");
  }

  async softDelete(id: UUID): Promise<void> {
    const { error } = await this.client
      .from(this.table)
      .update({ deleted_at: new Date().toISOString() } as never)
      .eq("id", id);
    if (error) this.handleError(error, "softDelete");
  }

  // -------------------------------------------------------------------------
  // Regras de cálculo de fatura
  // -------------------------------------------------------------------------

  /**
   * Sprint 3.4 — Competência da fatura.
   *
   * A fatura de competência M contém as compras do intervalo:
   *   (closing_day do mês M-2, exclusivo]  ->  [closing_day do mês M-1, inclusivo]
   * e vence no due_day do mês M.
   *
   * Exemplo (fecha 28 / vence 06):
   *   29/06..28/07 -> fatura de Agosto  (fecha 28/07, vence 06/08)
   *   29/07..28/08 -> fatura de Setembro (fecha 28/08, vence 06/09)
   *
   * Nunca usar apenas o mês da transaction_date: o fechamento é sempre
   * calculado a partir de closing_day e o vencimento a partir de due_day.
   */
  static computeInvoicePeriod(
    card: Pick<Card, "closing_day" | "due_day">,
    purchaseDate: string,
  ): InvoicePeriod {
    const [y, m, d] = purchaseDate.split("-").map(Number);
    let cy = y;
    let cm = m - 1; // mês 0-based do fechamento

    // Compra APÓS o fechamento do mês corrente entra na fatura que fecha no mês seguinte.
    const closingThisMonth = Math.min(card.closing_day, daysInMonth(cy, cm));
    if (d > closingThisMonth) cm += 1;
    while (cm > 11) {
      cm -= 12;
      cy += 1;
    }

    const closingDayEff = Math.min(card.closing_day, daysInMonth(cy, cm));
    const closingDate = new Date(cy, cm, closingDayEff);

    // Início do período: dia seguinte ao fechamento anterior.
    let py = cy;
    let pm = cm - 1;
    while (pm < 0) {
      pm += 12;
      py -= 1;
    }
    const prevClosing = new Date(py, pm, Math.min(card.closing_day, daysInMonth(py, pm)));
    const periodStart = new Date(
      prevClosing.getFullYear(),
      prevClosing.getMonth(),
      prevClosing.getDate() + 1,
    );

    // Vencimento: primeiro due_day igual/posterior ao fechamento.
    let dy = cy;
    let dm = cm;
    if (card.due_day <= closingDayEff) dm += 1;
    while (dm > 11) {
      dm -= 12;
      dy += 1;
    }
    const dueDayEff = Math.min(card.due_day, daysInMonth(dy, dm));
    const dueDate = new Date(dy, dm, dueDayEff);

    // Competência = mês do vencimento.
    const competence = new Date(dueDate.getFullYear(), dueDate.getMonth(), 1);
    return {
      competence: toISO(competence),
      closing_date: toISO(closingDate),
      due_date: toISO(dueDate),
      period_start: toISO(periodStart),
      period_end: toISO(closingDate),
    };
  }

  /**
   * Sprint 3.4 — Status derivado da fatura (projeção pura, nunca persistido
   * como verdade única):
   *   PAID    -> possui pagamento vinculado
   *   OVERDUE -> hoje > due_date e não paga
   *   CLOSED  -> hoje > closing_date e hoje <= due_date
   *   OPEN    -> hoje <= closing_date
   */
  static computeInvoiceStatus(
    invoice: {
      closing_date: string;
      due_date: string;
      paid_at?: string | null;
      paid_movement_id?: string | null;
      status?: string;
    },
    today: string = toISO(new Date()),
  ): "OPEN" | "CLOSED" | "OVERDUE" | "PAID" {
    if (invoice.status === "PAID" || invoice.paid_at || invoice.paid_movement_id) return "PAID";
    if (today > invoice.due_date) return "OVERDUE";
    if (today > invoice.closing_date) return "CLOSED";
    return "OPEN";
  }

  /** Total das compras (EXPENSE/REFUND) da fatura, com REFUND subtraindo. */
  static computeInvoiceAmount(movements: Movement[]): number {
    let total = 0;
    for (const m of movements) {
      if (m.deleted_at) continue;
      if (m.type === "REFUND") total -= Number(m.amount);
      else total += Number(m.amount);
    }
    return Math.max(0, Number(total.toFixed(2)));
  }

  /** Gasto total (aberto + fechado, exceto PAID) para uso do limite. */
  static computeUsedLimit(invoices: { amount: number; status: string }[]): number {
    return invoices.filter((i) => i.status !== "PAID").reduce((s, i) => s + Number(i.amount), 0);
  }
}

export const CardService = new CardServiceImpl();
export { CardServiceImpl };
