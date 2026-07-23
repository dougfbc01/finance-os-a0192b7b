import type { UUID, ISODateString } from "./index";

export type ImportSource = "NUBANK_ACCOUNT" | "NUBANK_CREDIT_CARD" | "OFX" | "MANUAL";
export type ImportStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "PARTIAL";

export interface ImportLogEntry {
  level: "info" | "warn" | "error";
  message: string;
  at: ISODateString;
  row?: number;
}

export interface ImportRecord {
  id: UUID;
  workspace_id: UUID;
  account_id: UUID | null;
  source: ImportSource;
  file_name: string;
  file_hash: string;
  imported_by: UUID | null;
  imported_at: ISODateString;
  total_rows: number;
  imported_rows: number;
  ignored_rows: number;
  duplicated_rows: number;
  status: ImportStatus;
  log: ImportLogEntry[];
  created_at: ISODateString;
  updated_at: ISODateString;
}

export interface CreateImportInput {
  workspace_id: UUID;
  account_id: UUID | null;
  source: ImportSource;
  file_name: string;
  file_hash: string;
  imported_by?: UUID | null;
}
