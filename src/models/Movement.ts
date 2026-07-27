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
}

export interface UpdateMovementInput {
  account_id?: UUID | null;
  transfer_account_id?: UUID | null;
  category_id?: UUID | null;
  subcategory_id?: UUID | null;
  card_id?: UUID | null;
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
  categoryId?: UUID | "all";
  type?: MovementType | "all";
  status?: MovementStatus | "all";
  group?: MovementGroup;
  search?: string;
}

