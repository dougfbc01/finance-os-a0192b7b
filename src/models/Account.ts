import type { AccountType } from "@/constants";
import type { UUID, ISODateString } from "./index";

export interface Account {
  id: UUID;
  workspace_id: UUID;
  name: string;
  institution: string | null;
  account_type: AccountType;
  currency: string;
  initial_balance: number;
  color: string;
  icon: string;
  display_order: number;
  is_active: boolean;
  created_at: ISODateString;
  updated_at: ISODateString;
  deleted_at: ISODateString | null;
}

export interface CreateAccountInput {
  workspace_id: UUID;
  name: string;
  institution?: string | null;
  account_type: AccountType;
  currency: string;
  initial_balance: number;
  color: string;
  icon: string;
  display_order?: number;
}

export interface UpdateAccountInput {
  name?: string;
  institution?: string | null;
  account_type?: AccountType;
  currency?: string;
  initial_balance?: number;
  color?: string;
  icon?: string;
  display_order?: number;
  is_active?: boolean;
}
