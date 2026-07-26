import type { AssetType } from "@/constants/enums";
import type { UUID, ISODateString } from "./index";

export interface Asset {
  id: UUID;
  workspace_id: UUID;
  name: string;
  asset_type: AssetType;
  institution: string | null;
  currency: string;
  quantity: number;
  unit_price: number;
  current_value: number;
  acquisition_value: number;
  acquisition_date: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: ISODateString;
  updated_at: ISODateString;
  deleted_at: ISODateString | null;
}

export interface CreateAssetInput {
  workspace_id: UUID;
  name: string;
  asset_type: AssetType;
  institution?: string | null;
  currency?: string;
  quantity?: number;
  unit_price?: number;
  current_value: number;
  acquisition_value?: number;
  acquisition_date?: string | null;
  notes?: string | null;
}

export interface UpdateAssetInput {
  name?: string;
  asset_type?: AssetType;
  institution?: string | null;
  currency?: string;
  quantity?: number;
  unit_price?: number;
  current_value?: number;
  acquisition_value?: number;
  acquisition_date?: string | null;
  notes?: string | null;
  is_active?: boolean;
}
