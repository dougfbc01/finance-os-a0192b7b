import type { MovementType, MovementStatus } from "@/constants/enums";
import type { UUID, ISODateString } from "./index";

export type MovementAttachment = {
  name: string;
  url: string;
  mime?: string;
  size?: number;
};

export interface Movement {
  id: UUID;
  workspace_id: UUID;
  account_id: UUID | null;
  transfer_account_id: UUID | null;
  category_id: UUID | null;
  subcategory_id: UUID | null;
  card_id: UUID | null;
  invoice_id: UUID | null;
  asset_id: UUID | null;
  import_id: UUID | null;
  transfer_group_id: UUID | null;
  type: MovementType;
  status: MovementStatus;
  description: string;
  notes: string | null;
  amount: number;
  transaction_date: string; // DATE (yyyy-mm-dd)
  competence_date: string | null;
  due_date: string | null;
  tags: string[];
  attachments: MovementAttachment[];
  /** Impressão digital usada pela deduplicação inteligente. */
  duplicate_hash: string | null;
  /**
   * Sprint 4.7 — operação anterior ao início do controle financeiro.
   * Afeta posição/patrimônio do ativo, NUNCA o saldo das contas.
   */
  is_historical: boolean;
  /** Quantidade negociada do ativo (opcional). */
  quantity: number | null;
  /** Preço unitário da operação (opcional). */
  unit_price: number | null;
  /** Referência externa (futura conciliação B3/corretoras). */
  external_ref: string | null;
  created_at: ISODateString;
  updated_at: ISODateString;
  deleted_at: ISODateString | null;
}


export interface CreateMovementInput {
  workspace_id: UUID;
  account_id?: UUID | null;
  transfer_account_id?: UUID | null;
  category_id?: UUID | null;
  subcategory_id?: UUID | null;
  card_id?: UUID | null;
  asset_id?: UUID | null;
  type: MovementType;
  status?: MovementStatus;
  description?: string;
  notes?: string | null;
  amount: number;
  transaction_date: string;
  competence_date?: string | null;
  due_date?: string | null;
  tags?: string[];
  attachments?: MovementAttachment[];
  /** Sprint 4.7 — marca a operação como histórica (não movimenta caixa). */
  is_historical?: boolean;
  quantity?: number | null;
  unit_price?: number | null;
  external_ref?: string | null;
}

export interface UpdateMovementInput {
  account_id?: UUID | null;
  transfer_account_id?: UUID | null;
  category_id?: UUID | null;
  subcategory_id?: UUID | null;
  card_id?: UUID | null;
  asset_id?: UUID | null;
  type?: MovementType;
  status?: MovementStatus;
  description?: string;
  notes?: string | null;
  amount?: number;
  transaction_date?: string;
  competence_date?: string | null;
  due_date?: string | null;
  tags?: string[];
  attachments?: MovementAttachment[];
  is_historical?: boolean;
  quantity?: number | null;
  unit_price?: number | null;
  external_ref?: string | null;
}


/** Grupo lógico aplicado nas listagens (Todos, Conta, Cartão, etc.). */
export type MovementGroup =
  | "all"
  | "account"
  | "card"
  | "transfer"
  | "income"
  | "expense"
  | "investment";

export interface MovementFilters {
  from?: string; // yyyy-mm-dd
  to?: string;
  accountId?: UUID | "all";
  cardId?: UUID | "all";
  /** "none" filtra lançamentos sem categoria. */
  categoryId?: UUID | "all" | "none";
  /** "none" filtra lançamentos sem subcategoria. */
  subcategoryId?: UUID | "all" | "none";
  type?: MovementType | "all";
  status?: MovementStatus | "all";
  group?: MovementGroup;
  search?: string;
  /** Restringe aos lançamentos de uma importação específica (revisão). */
  importId?: UUID;
}

