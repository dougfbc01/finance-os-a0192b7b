import type { UUID } from "./index";

export const B3_REQUIRED_COLUMNS = [
  "Entrada/Saída",
  "Data",
  "Movimentação",
  "Produto",
  "Instituição",
  "Quantidade",
  "Preço unitário",
  "Valor da Operação",
] as const;

export type B3Group =
  | "B3_INCOME"
  | "B3_INVESTMENT_OPERATION"
  | "B3_POSITION_EVENT"
  | "B3_CORPORATE_EVENT"
  | "B3_TRANSFER"
  | "B3_UNCLASSIFIED";

export type B3Event =
  | "DIVIDEND"
  | "JCP"
  | "YIELD"
  | "CAPITAL_RETURN"
  | "BUY"
  | "BUY_SELL"
  | "REDEMPTION"
  | "MATURITY"
  | "BONUS"
  | "SPLIT"
  | "REVERSE_SPLIT"
  | "INCORPORATION"
  | "UPDATE"
  | "SUBSCRIPTION_RIGHT"
  | "SUBSCRIPTION_RIGHT_NOT_EXERCISED"
  | "RIGHTS_ASSIGNMENT"
  | "RIGHTS_ASSIGNMENT_REQUESTED"
  | "FRACTION"
  | "FRACTION_AUCTION"
  | "TRANSFER"
  | "TRANSFER_SETTLEMENT"
  | "UNKNOWN";

export type B3Impact = "YES" | "NO" | "UNKNOWN";
export type B3Nature =
  | "INCOME"
  | "INVESTMENT"
  | "POSITION_EVENT"
  | "CORPORATE_EVENT"
  | "TRANSFER"
  | "UNKNOWN";
export type B3IdentificationStatus = "FOUND" | "NOT_FOUND" | "UNIDENTIFIED" | "AMBIGUOUS";
export type B3RowStatus = "VALID" | "REVIEW" | "INVALID" | "UNCLASSIFIED";

export interface B3ProductReference {
  rawProduct: string;
  ticker: string | null;
  productName: string | null;
  institution: string | null;
  identificationStatus: B3IdentificationStatus;
  assetId: UUID | null;
  assetName: string | null;
}

export interface B3RawRow {
  "Entrada/Saída": unknown;
  Data: unknown;
  Movimentação: unknown;
  Produto: unknown;
  Instituição: unknown;
  Quantidade: unknown;
  "Preço unitário": unknown;
  "Valor da Operação": unknown;
}

export interface B3PreviewRow {
  index: number;
  raw: B3RawRow;
  direction: string | null;
  date: string | null;
  movementType: string;
  product: B3ProductReference;
  quantity: number | null;
  unitPrice: number | null;
  operationValue: number | null;
  group: B3Group;
  event: B3Event;
  cashImpact: B3Impact;
  positionImpact: B3Impact;
  nature: B3Nature;
  status: B3RowStatus;
  observation: string;
  possibleDuplicate: boolean;
  fingerprint: string;
  errors: string[];
  warnings: string[];
}

export interface B3PreviewResult {
  fileName: string;
  sheetName: "Movimentação";
  rows: B3PreviewRow[];
  totals: {
    total: number;
    valid: number;
    warnings: number;
    unclassified: number;
    assetsFound: number;
    assetsNotFound: number;
  };
  eventCounts: Array<{ type: string; count: number }>;
}

export interface B3AssetReference {
  id: UUID;
  ticker: string | null;
  name: string;
}