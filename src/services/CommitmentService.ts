// CommitmentService — Sprint 4.8 (Bloco 4: fundação).
// Regras PURAS de parcelamento. Nesta etapa o serviço não persiste nada e não
// cria movimentações: apenas projeta o cronograma previsto de parcelas.
//
// Regras de arredondamento:
//  - cada parcela recebe o valor total dividido pelo nº de parcelas, com 2 casas;
//  - a diferença de centavos vai integralmente para a ÚLTIMA parcela, de modo
//    que a soma das parcelas seja sempre exatamente o valor total.
import { BaseService } from "./BaseService";
import type { UUID } from "@/models";
import type {
  Commitment,
  CommitmentForecast,
  CommitmentForecastLine,
  CommitmentInstallment,
  CommitmentView,
  CreateCommitmentInput,
  InstallmentDisplayStatus,
  InstallmentView,
  PlannedInstallment,
  UpdateCommitmentInput,
} from "@/models/Commitment";


const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function toISO(y: number, m: number, d: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

/** Data no mês `offset` a partir de `start`, preservando o dia quando possível. */
function addMonthsClamped(start: string, offset: number, day?: number | null): string {
  const [y, m, d] = start.split("-").map(Number);
  const targetDay = day && day > 0 ? day : d;
  const base = new Date(Date.UTC(y, m - 1 + offset, 1));
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return toISO(year, month, Math.min(targetDay, lastDay));
}

export interface ScheduleInput {
  total_amount: number;
  installments_count: number;
  start_date: string;
  due_day?: number | null;
}

class CommitmentServiceImpl extends BaseService {
  /** Valor de cada parcela, com o resíduo de centavos na última. */
  static splitAmount(total: number, count: number): number[] {
    const n = Math.max(1, Math.floor(count));
    const cents = Math.round(Math.abs(Number(total) || 0) * 100);
    const base = Math.floor(cents / n);
    const values = Array.from({ length: n }, () => base / 100);
    values[n - 1] = (base + (cents - base * n)) / 100;
    return values;
  }

  /** Cronograma previsto de parcelas (nenhuma movimentação é criada). */
  static schedule(input: ScheduleInput): PlannedInstallment[] {
    if (!ISO_DATE.test(input.start_date)) {
      throw new Error("Data inicial inválida para o compromisso.");
    }
    if (!Number.isFinite(input.installments_count) || input.installments_count < 1) {
      throw new Error("O número de parcelas deve ser pelo menos 1.");
    }
    const amounts = CommitmentServiceImpl.splitAmount(
      input.total_amount,
      input.installments_count,
    );
    return amounts.map((amount, i) => {
      const due = addMonthsClamped(input.start_date, i, input.due_day);
      return {
        installment_number: i + 1,
        due_date: due,
        // Competência acompanha o vencimento nesta fundação.
        competence_date: due,
        amount,
      };
    });
  }

  /** Total já quitado e saldo devedor de um compromisso. */
  static progress(installments: CommitmentInstallment[]): {
    total: number;
    paid: number;
    remaining: number;
    paidCount: number;
    openCount: number;
  } {
    const active = installments.filter((i) => !i.deleted_at && i.status !== "CANCELLED");
    const total = active.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const paidRows = active.filter((i) => i.status === "PAID");
    const paid = paidRows.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    return {
      total: Number(total.toFixed(2)),
      paid: Number(paid.toFixed(2)),
      remaining: Number((total - paid).toFixed(2)),
      paidCount: paidRows.length,
      openCount: active.length - paidRows.length,
    };
  }

  /** Validação de entrada compartilhada pela futura UI. */
  static validate(input: Partial<CreateCommitmentInput>): void {
    if (input.name !== undefined && !input.name.trim())
      throw new Error("Nome do compromisso é obrigatório.");
    if (input.total_amount !== undefined && input.total_amount <= 0)
      throw new Error("Valor total deve ser maior que zero.");
    if (input.installments_count !== undefined && input.installments_count < 1)
      throw new Error("O número de parcelas deve ser pelo menos 1.");
    if (input.due_day != null && (input.due_day < 1 || input.due_day > 31))
      throw new Error("Dia de vencimento deve estar entre 1 e 31.");
  }

  /** Valor mensal previsto do compromisso (base para o Planejamento). */
  static monthlyAmount(commitment: Pick<Commitment, "installment_amount">): number {
    return Number(commitment.installment_amount) || 0;
  }

  // ---------------------------------------------------------------------
  // Visões derivadas (nunca persistidas)
  // ---------------------------------------------------------------------

  /** ATRASADA é derivado: prevista/lançada com vencimento anterior a hoje. */
  static displayStatus(
    installment: Pick<CommitmentInstallment, "status" | "due_date">,
    today: string,
  ): InstallmentDisplayStatus {
    if (installment.status === "PAID") return "PAID";
    if (installment.status === "CANCELLED") return "CANCELLED";
    if (installment.due_date < today) return "OVERDUE";
    return installment.status === "POSTED" ? "POSTED" : "FORECAST";
  }

  /** Consolida um compromisso e suas parcelas para a tela e o dashboard. */
  static view(
    commitment: Commitment,
    installments: CommitmentInstallment[],
    today: string = new Date().toISOString().slice(0, 10),
  ): CommitmentView {
    const rows = installments
      .filter((i) => i.commitment_id === commitment.id && !i.deleted_at)
      .sort((a, b) => a.installment_number - b.installment_number)
      .map<InstallmentView>((i) => ({
        ...i,
        display_status: CommitmentServiceImpl.displayStatus(i, today),
        label: `${i.installment_number}/${commitment.installments_count}`,
      }));

    const progress = CommitmentServiceImpl.progress(rows);
    const overdue = rows.filter((i) => i.display_status === "OVERDUE");
    const next =
      rows.find((i) => i.display_status === "OVERDUE") ??
      rows.find((i) => i.display_status === "FORECAST" || i.display_status === "POSTED") ??
      null;

    return {
      commitment,
      installments: rows,
      paidCount: progress.paidCount,
      openCount: progress.openCount,
      paidAmount: progress.paid,
      remainingAmount: progress.remaining,
      overdueCount: overdue.length,
      overdueAmount: Number(overdue.reduce((s, i) => s + i.amount, 0).toFixed(2)),
      next,
    };
  }

  /**
   * Obrigações previstas de uma competência (YYYY-MM), para o Planejamento.
   * Regra anti-duplicidade: uma parcela cuja categoria já possui item de
   * orçamento na competência é marcada como `alreadyBudgeted` e NÃO entra em
   * `uncoveredTotal`. Parcelas já pagas ou canceladas nunca são projetadas —
   * o valor real já está nas movimentações.
   */
  static forecastForCompetence(params: {
    competence: string;
    commitments: Commitment[];
    installments: CommitmentInstallment[];
    /** Categorias que já possuem item planejado na competência. */
    budgetedCategoryIds?: (UUID | null)[];
  }): CommitmentForecast {
    const budgeted = new Set((params.budgetedCategoryIds ?? []).filter(Boolean) as UUID[]);
    const byId = new Map(params.commitments.map((c) => [c.id, c]));

    const lines = params.installments
      .filter((i) => !i.deleted_at)
      .filter((i) => i.status === "FORECAST" || i.status === "POSTED")
      .filter((i) => (i.competence_date ?? i.due_date).slice(0, 7) === params.competence)
      .filter((i) => {
        const c = byId.get(i.commitment_id);
        return !!c && !c.deleted_at && c.status !== "CANCELLED";
      })
      .map<CommitmentForecastLine>((i) => {
        const c = byId.get(i.commitment_id)!;
        return {
          commitment_id: c.id,
          installment_id: i.id,
          name: c.name,
          category_id: c.category_id,
          subcategory_id: c.subcategory_id,
          due_date: i.due_date,
          amount: Number(i.amount) || 0,
          alreadyBudgeted: !!c.category_id && budgeted.has(c.category_id),
        };
      })
      .sort((a, b) => a.due_date.localeCompare(b.due_date));

    const sum = (rows: CommitmentForecastLine[]) =>
      Number(rows.reduce((s, r) => s + r.amount, 0).toFixed(2));

    return {
      competence: params.competence,
      lines,
      uncoveredTotal: sum(lines.filter((l) => !l.alreadyBudgeted)),
      forecastTotal: sum(lines),
    };
  }

  // ---------------------------------------------------------------------
  // Persistência — o compromisso e suas parcelas são PREVISÕES.
  // Nenhum método aqui cria movimentação financeira.
  // ---------------------------------------------------------------------

  private readonly table = "commitments";
  private readonly installmentsTable = "commitment_installments";

  async list(workspaceId: UUID): Promise<Commitment[]> {
    const { data, error } = await this.client
      .from(this.table)
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) this.handleError(error, "list");
    return (data ?? []) as Commitment[];
  }

  async listInstallments(workspaceId: UUID): Promise<CommitmentInstallment[]> {
    const { data, error } = await this.client
      .from(this.installmentsTable)
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("installment_number", { ascending: true });
    if (error) this.handleError(error, "listInstallments");
    return (data ?? []) as CommitmentInstallment[];
  }

  /** Cria o compromisso e grava o cronograma previsto (sem movimentações). */
  async create(input: CreateCommitmentInput): Promise<Commitment> {
    CommitmentServiceImpl.validate(input);
    const planned = CommitmentServiceImpl.schedule({
      total_amount: input.total_amount,
      installments_count: input.installments_count,
      start_date: input.start_date,
      due_day: input.due_day ?? null,
    });

    const { data, error } = await this.client
      .from(this.table)
      .insert({
        workspace_id: input.workspace_id,
        name: input.name.trim(),
        description: input.description ?? null,
        commitment_type: input.commitment_type ?? "INSTALLMENT",
        status: "ACTIVE",
        total_amount: input.total_amount,
        installment_amount: planned[0]?.amount ?? 0,
        installments_count: input.installments_count,
        due_day: input.due_day ?? null,
        start_date: input.start_date,
        account_id: input.account_id ?? null,
        card_id: input.card_id ?? null,
        category_id: input.category_id ?? null,
        subcategory_id: input.subcategory_id ?? null,
        notes: input.notes ?? null,
      })
      .select()
      .single();
    if (error) this.handleError(error, "create");

    const commitment = data as Commitment;
    await this.replaceSchedule(commitment, planned);
    return commitment;
  }

  /** Regrava o cronograma preservando as parcelas já pagas ou conciliadas. */
  private async replaceSchedule(
    commitment: Commitment,
    planned: PlannedInstallment[],
  ): Promise<void> {
    const existing = await this.installmentsOf(commitment.id);
    const locked = new Set(
      existing
        .filter((i) => i.status === "PAID" || i.movement_id)
        .map((i) => i.installment_number),
    );

    const removable = existing
      .filter((i) => !locked.has(i.installment_number))
      .map((i) => i.id);
    if (removable.length) {
      const { error } = await this.client
        .from(this.installmentsTable)
        .delete()
        .in("id", removable);
      if (error) this.handleError(error, "replaceSchedule");
    }

    const rows = planned
      .filter((p) => !locked.has(p.installment_number))
      .map((p) => ({
        workspace_id: commitment.workspace_id,
        commitment_id: commitment.id,
        installment_number: p.installment_number,
        due_date: p.due_date,
        competence_date: p.competence_date,
        amount: p.amount,
        status: "FORECAST",
      }));
    if (!rows.length) return;

    const { error } = await this.client.from(this.installmentsTable).insert(rows);
    if (error) this.handleError(error, "replaceSchedule");
  }

  private async installmentsOf(commitmentId: UUID): Promise<CommitmentInstallment[]> {
    const { data, error } = await this.client
      .from(this.installmentsTable)
      .select("*")
      .eq("commitment_id", commitmentId)
      .is("deleted_at", null);
    if (error) this.handleError(error, "installmentsOf");
    return (data ?? []) as CommitmentInstallment[];
  }

  /** Edita o compromisso; o cronograma é regerado quando muda base de cálculo. */
  async update(id: UUID, input: UpdateCommitmentInput): Promise<Commitment> {
    CommitmentServiceImpl.validate(input);
    const patch: Record<string, unknown> = { ...input };
    if (input.name !== undefined) patch['name'] = input.name.trim();

    const rescheduleKeys = ["total_amount", "installments_count", "start_date", "due_day"];
    const mustReschedule = rescheduleKeys.some((k) => k in input);

    const { data, error } = await this.client
      .from(this.table)
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) this.handleError(error, "update");
    const commitment = data as Commitment;

    if (mustReschedule) {
      const planned = CommitmentServiceImpl.schedule({
        total_amount: commitment.total_amount,
        installments_count: commitment.installments_count,
        start_date: commitment.start_date,
        due_day: commitment.due_day,
      });
      await this.replaceSchedule(commitment, planned);
      await this.client
        .from(this.table)
        .update({ installment_amount: planned[0]?.amount ?? 0 })
        .eq("id", id);
    }
    return commitment;
  }

  /** Cancela o compromisso e todas as parcelas ainda em aberto. */
  async cancel(id: UUID): Promise<void> {
    const { error } = await this.client
      .from(this.table)
      .update({ status: "CANCELLED" })
      .eq("id", id);
    if (error) this.handleError(error, "cancel");

    const { error: instError } = await this.client
      .from(this.installmentsTable)
      .update({ status: "CANCELLED" })
      .eq("commitment_id", id)
      .in("status", ["FORECAST", "POSTED"]);
    if (instError) this.handleError(instError, "cancel");
  }

  async remove(id: UUID): Promise<void> {
    const { error } = await this.client
      .from(this.table)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) this.handleError(error, "remove");
  }

  /**
   * Baixa MANUAL de uma parcela. Não cria movimentação: a fonte financeira
   * continua sendo o lançamento real (importado ou manual), que na futura
   * conciliação será vinculado via `movement_id`.
   */
  async markInstallmentPaid(installmentId: UUID, movementId?: UUID | null): Promise<void> {
    const patch: Record<string, unknown> = { status: "PAID" };
    if (movementId) patch['movement_id'] = movementId;
    const { error } = await this.client
      .from(this.installmentsTable)
      .update(patch)
      .eq("id", installmentId);
    if (error) this.handleError(error, "markInstallmentPaid");
  }

  /** Desfaz a baixa manual, devolvendo a parcela para prevista. */
  async unmarkInstallmentPaid(installmentId: UUID): Promise<void> {
    const { error } = await this.client
      .from(this.installmentsTable)
      .update({ status: "FORECAST", movement_id: null })
      .eq("id", installmentId);
    if (error) this.handleError(error, "unmarkInstallmentPaid");
  }
}


export const CommitmentService = new CommitmentServiceImpl();
export { CommitmentServiceImpl };
