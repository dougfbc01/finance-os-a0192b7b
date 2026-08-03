// Tipos e contratos do subsistema de importação bancária.
// Cada Importer implementa Importer<TRow> e retorna preview antes de gravar.

import type { MovementType, MovementStatus } from "@/constants/enums";
import type { Account, UUID } from "@/models";
import type { ImportSource } from "@/models/Import";

export interface ImportContext {
  workspaceId: UUID;
  accountId: UUID | null; // conta destino da importação (obrigatório para conta bancária)
  cardId?: UUID | null; // para importações de fatura de cartão
  accounts: Account[];
  defaults: {
    categoryId: UUID | null;
    subcategoryId: UUID | null;
    cardCategoryId?: UUID | null;
    cardSubcategoryId?: UUID | null;
  };
  /** Hashes já existentes no workspace, para detecção de duplicidade. */
  existingHashes: Set<string>;
}

export interface PreviewRow {
  index: number;
  raw: Record<string, unknown>;
  transaction_date: string; // yyyy-mm-dd
  description: string;
  amount: number; // sempre positivo
  type: MovementType;
  status: MovementStatus;
  account_id: UUID | null;
  card_id: UUID | null;
  transfer_account_id: UUID | null;
  category_id: UUID | null;
  subcategory_id: UUID | null;
  duplicate_hash: string;
  isDuplicate: boolean;
  /** Sprint 4.1.1 — score de similaridade contra a base (0..100). */
  confidence_match?: number;
  /** Motivo legível da similaridade detectada. */
  duplicateReason?: string;
  /** Id da movimentação existente equivalente. */
  matchedMovementId?: UUID | null;
  /** Score na faixa de revisão (80..95): precisa de decisão do usuário. */
  needsReview?: boolean;
  isTransfer: boolean;
  isCardPayment: boolean;
  isInvalid: boolean;
  errors: string[];

}

export interface PreviewResult {
  source: ImportSource;
  fileName: string;
  fileHash: string;
  rows: PreviewRow[];
  totals: {
    total: number;
    valid: number;
    invalid: number;
    duplicated: number;
    transfers: number;
    incomes: number;
    expenses: number;
    cardPayments: number;
  };
}

export interface Importer {
  readonly source: ImportSource;
  parse(fileText: string): Record<string, unknown>[];
  validate(rows: Record<string, unknown>[]): { valid: Record<string, unknown>[]; invalid: number };
  preview(
    fileText: string,
    ctx: ImportContext,
    fileName: string,
    fileHash: string,
  ): Promise<PreviewResult>;
}
