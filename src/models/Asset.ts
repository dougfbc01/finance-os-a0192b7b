import type { AssetType, AssetValuationSource } from "@/constants/enums";
import type { UUID, ISODateString } from "./index";

export interface Asset {
  id: UUID;
  workspace_id: UUID;
  name: string;
  asset_type: AssetType;
  institution: string | null;
  /** Código de negociação (ex.: PETR4, HGLG11). Opcional por tipo de ativo. */
  ticker: string | null;
  currency: string;
  quantity: number;
  unit_price: number;
  current_value: number;
  acquisition_value: number;
  acquisition_date: string | null;
  is_active: boolean;
  notes: string | null;
  /** Sprint 4.5.2 — de onde vem o valor patrimonial deste ativo. */
  valuation_source: AssetValuationSource;
  /** Conta espelhada quando valuation_source = ACCOUNT (caixinhas). */
  account_id: UUID | null;
  /** Base usada quando valuation_source = MOVEMENTS. */
  opening_value: number;
  created_at: ISODateString;
  updated_at: ISODateString;
  deleted_at: ISODateString | null;
}

export interface CreateAssetInput {
  workspace_id: UUID;
  name: string;
  asset_type: AssetType;
  institution?: string | null;
  ticker?: string | null;
  currency?: string;
  quantity?: number;
  unit_price?: number;
  current_value: number;
  acquisition_value?: number;
  acquisition_date?: string | null;
  notes?: string | null;
  valuation_source?: AssetValuationSource;
  account_id?: UUID | null;
  opening_value?: number;
}

export interface UpdateAssetInput {
  name?: string;
  asset_type?: AssetType;
  institution?: string | null;
  ticker?: string | null;
  currency?: string;
  quantity?: number;
  unit_price?: number;
  current_value?: number;
  acquisition_value?: number;
  acquisition_date?: string | null;
  notes?: string | null;
  is_active?: boolean;
  valuation_source?: AssetValuationSource;
  account_id?: UUID | null;
  opening_value?: number;
}

