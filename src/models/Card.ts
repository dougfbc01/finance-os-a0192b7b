import type { UUID, ISODateString } from "./index";

export interface Card {
  id: UUID;
  workspace_id: UUID;
  account_id: UUID | null;
  parent_card_id: UUID | null;
  name: string;
  brand: string | null;
  holder_name: string | null;
  last_digits: string | null;
  credit_limit: number;
  closing_day: number;
  due_day: number;
  color: string;
  notes: string | null;
  display_order: number;
  is_active: boolean;
  created_at: ISODateString;
  updated_at: ISODateString;
  deleted_at: ISODateString | null;
}

export interface CreateCardInput {
  workspace_id: UUID;
  account_id: UUID | null;
  parent_card_id?: UUID | null;
  name: string;
  brand?: string | null;
  holder_name?: string | null;
  last_digits?: string | null;
  credit_limit: number;
  closing_day: number;
  due_day: number;
  color?: string;
  notes?: string | null;
  display_order?: number;
}

export interface UpdateCardInput {
  account_id?: UUID | null;
  parent_card_id?: UUID | null;
  name?: string;
  brand?: string | null;
  holder_name?: string | null;
  last_digits?: string | null;
  credit_limit?: number;
  closing_day?: number;
  due_day?: number;
  color?: string;
  notes?: string | null;
  display_order?: number;
  is_active?: boolean;
}
