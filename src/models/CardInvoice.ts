import type { UUID, ISODateString } from "./index";

export type CardInvoiceStatus = "OPEN" | "CLOSED" | "PAID" | "OVERDUE";

export interface CardInvoice {
  id: UUID;
  workspace_id: UUID;
  card_id: UUID;
  competence: string; // yyyy-mm-01
  closing_date: string;
  due_date: string;
  amount: number;
  status: CardInvoiceStatus;
  paid_at: string | null;
  paid_movement_id: UUID | null;
  notes: string | null;
  created_at: ISODateString;
  updated_at: ISODateString;
  deleted_at: ISODateString | null;
}

export interface InvoicePeriod {
  competence: string; // yyyy-mm-01
  closing_date: string;
  due_date: string;
  /** Primeiro dia de compras da fatura (dia seguinte ao fechamento anterior). */
  period_start?: string;
  /** Último dia de compras da fatura (= closing_date). */
  period_end?: string;
}
