// Commitment — Sprint 4.8 (Bloco 4: fundação de Compromissos e Parcelamentos).
// Um compromisso é uma obrigação futura conhecida (assinatura, parcelamento,
// empréstimo, conta fixa). Suas parcelas são PREVISÕES: nenhuma movimentação
// real é gerada nesta fundação.
import type { UUID, ISODateString } from "./index";

export type CommitmentType =
  | "SUBSCRIPTION"
  | "INSTALLMENT"
  | "LOAN"
  | "FINANCING"
  | "FIXED_BILL"
  | "OTHER";

export type CommitmentStatus = "ACTIVE" | "SETTLED" | "CANCELLED" | "PAUSED";

export type CommitmentInstallmentStatus = "FORECAST" | "POSTED" | "PAID" | "CANCELLED";

export const COMMITMENT_TYPE_LABELS: Record<CommitmentType, string> = {
  SUBSCRIPTION: "Assinatura",
  INSTALLMENT: "Parcelamento",
  LOAN: "Empréstimo",
  FINANCING: "Financiamento",
  FIXED_BILL: "Conta fixa",
  OTHER: "Outro",
};

export const COMMITMENT_STATUS_LABELS: Record<CommitmentStatus, string> = {
  ACTIVE: "Ativo",
  SETTLED: "Quitado",
  CANCELLED: "Cancelado",
  PAUSED: "Pausado",
};

export const COMMITMENT_INSTALLMENT_STATUS_LABELS: Record<
  CommitmentInstallmentStatus,
  string
> = {
  FORECAST: "Prevista",
  POSTED: "Lançada",
  PAID: "Paga",
  CANCELLED: "Cancelada",
};

export interface Commitment {
  id: UUID;
  workspace_id: UUID;
  name: string;
  description: string | null;
  commitment_type: CommitmentType;
  status: CommitmentStatus;
  total_amount: number;
  installment_amount: number;
  installments_count: number;
  /** Dia do vencimento (1–31) quando o compromisso é recorrente. */
  due_day: number | null;
  start_date: string;
  account_id: UUID | null;
  card_id: UUID | null;
  category_id: UUID | null;
  subcategory_id: UUID | null;
  notes: string | null;
  created_at: ISODateString;
  updated_at: ISODateString;
  deleted_at: ISODateString | null;
}

export interface CommitmentInstallment {
  id: UUID;
  workspace_id: UUID;
  commitment_id: UUID;
  installment_number: number;
  due_date: string;
  competence_date: string;
  amount: number;
  status: CommitmentInstallmentStatus;
  /** Preenchido apenas quando a parcela vira uma movimentação real. */
  movement_id: UUID | null;
  notes: string | null;
  created_at: ISODateString;
  updated_at: ISODateString;
  deleted_at: ISODateString | null;
}

/** Parcela ainda não persistida — resultado do gerador de cronograma. */
export interface PlannedInstallment {
  installment_number: number;
  due_date: string;
  competence_date: string;
  amount: number;
}

export interface CreateCommitmentInput {
  workspace_id: UUID;
  name: string;
  description?: string | null;
  commitment_type?: CommitmentType;
  total_amount: number;
  installments_count: number;
  due_day?: number | null;
  start_date: string;
  account_id?: UUID | null;
  card_id?: UUID | null;
  category_id?: UUID | null;
  subcategory_id?: UUID | null;
  notes?: string | null;
}
