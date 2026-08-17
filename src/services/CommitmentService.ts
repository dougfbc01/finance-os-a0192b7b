// CommitmentService — Sprint 4.8 (Bloco 4: fundação).
// Regras PURAS de parcelamento. Nesta etapa o serviço não persiste nada e não
// cria movimentações: apenas projeta o cronograma previsto de parcelas.
//
// Regras de arredondamento:
//  - cada parcela recebe o valor total dividido pelo nº de parcelas, com 2 casas;
//  - a diferença de centavos vai integralmente para a ÚLTIMA parcela, de modo
//    que a soma das parcelas seja sempre exatamente o valor total.
import { BaseService } from "./BaseService";
import type {
  Commitment,
  CommitmentInstallment,
  CreateCommitmentInput,
  PlannedInstallment,
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
}

export const CommitmentService = new CommitmentServiceImpl();
export { CommitmentServiceImpl };
