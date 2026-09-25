import { InvestmentOperation, MovementStatus, MovementType } from "@/constants/enums";
import type { B3CommitItemStatus, B3PreviewRow, B3RawRow } from "@/models/B3Import";

export interface B3MovementPayload {
  workspace_id: string;
  account_id: null;
  transfer_account_id: null;
  card_id: null;
  invoice_id: null;
  asset_id: string;
  import_id: string;
  type: MovementType;
  status: MovementStatus;
  description: string;
  notes: string;
  amount: number;
  transaction_date: string;
  competence_date: string;
  due_date: string;
  tags: string[];
  attachments: never[];
  duplicate_hash: string;
  is_historical: true;
  quantity: number | null;
  unit_price: number | null;
  external_ref: string;
}

const incomeEvents = new Set(["DIVIDEND", "JCP", "YIELD", "CAPITAL_RETURN"]);
const deltaQuantityEvents = new Set(["BONUS", "SPLIT", "FRACTION", "TRANSFER_SETTLEMENT"]);
const absoluteQuantityEvents = new Set(["UPDATE", "REVERSE_SPLIT", "INCORPORATION"]);
const neutralEvents = new Set([
  "SUBSCRIPTION_RIGHT", "SUBSCRIPTION_RIGHT_NOT_EXERCISED",
  "RIGHTS_ASSIGNMENT", "RIGHTS_ASSIGNMENT_REQUESTED", "TRANSFER",
]);

const directionTag = (direction: string | null) =>
  direction?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() === "DEBITO"
    ? "qty:DECREASE"
    : "qty:INCREASE";

export class B3ImportCommitService {
  static eligibility(row: B3PreviewRow): { status: B3CommitItemStatus; message: string } {
    if (row.status === "INVALID" || row.status === "UNCLASSIFIED") return { status: "ERROR", message: "Linha inválida ou não classificada." };
    if (row.product.identificationStatus !== "FOUND" || !row.product.assetId) return { status: "PENDING_REVIEW", message: "Ativo não cadastrado ou identificação ambígua." };
    if (!row.date) return { status: "ERROR", message: "Data inválida." };
    if (row.event === "BUY_SELL") return { status: "PENDING_REVIEW", message: "COMPRA / VENDA exige revisão manual." };
    if ((row.event === "BUY" || row.event === "REDEMPTION" || row.event === "MATURITY" || deltaQuantityEvents.has(row.event) || absoluteQuantityEvents.has(row.event) || row.event === "FRACTION_AUCTION") && (!row.quantity || row.quantity <= 0)) {
      return { status: "PENDING_REVIEW", message: "Quantidade necessária para atualizar a posição." };
    }
    if ((row.event === "BUY" || row.event === "REDEMPTION" || row.event === "MATURITY" || incomeEvents.has(row.event)) && (!row.operationValue || row.operationValue <= 0)) {
      return { status: "PENDING_REVIEW", message: "Valor da operação necessário para preservar o evento." };
    }
    return { status: "IMPORTED", message: "Pronto para importar como histórico B3." };
  }

  static movement(row: B3PreviewRow, workspaceId: string, importId: string): B3MovementPayload | null {
    if (this.eligibility(row).status !== "IMPORTED" || !row.product.assetId || !row.date) return null;
    let operation = InvestmentOperation.EVENTO;
    let type = MovementType.ADJUSTMENT;
    let amount = row.operationValue ?? 0;
    let quantity = row.quantity;
    const tags = [`source:B3`, `b3:event:${row.event}`, `b3:type:${row.movementType}`];

    if (row.event === "BUY") {
      operation = InvestmentOperation.APORTE;
      type = MovementType.INVESTMENT;
    } else if (row.event === "REDEMPTION" || row.event === "MATURITY") {
      operation = InvestmentOperation.RESGATE;
      type = MovementType.INVESTMENT;
    } else if (incomeEvents.has(row.event)) {
      operation = InvestmentOperation.RENDIMENTO;
      type = row.event === "DIVIDEND" ? MovementType.DIVIDEND : MovementType.INTEREST;
      quantity = null;
    } else if (deltaQuantityEvents.has(row.event)) {
      operation = InvestmentOperation.AJUSTE_QUANTIDADE;
      amount = 0;
      tags.push(directionTag(row.direction));
    } else if (absoluteQuantityEvents.has(row.event)) {
      operation = InvestmentOperation.AJUSTE_QUANTIDADE;
      amount = 0;
      tags.push("qty:SET");
    } else if (row.event === "FRACTION_AUCTION") {
      operation = InvestmentOperation.EVENTO;
      tags.push("qty:REALIZE");
    } else if (neutralEvents.has(row.event)) {
      operation = InvestmentOperation.EVENTO;
      amount = 0;
      quantity = null;
    }

    tags.push(`op:${operation}`);
    return {
      workspace_id: workspaceId,
      account_id: null,
      transfer_account_id: null,
      card_id: null,
      invoice_id: null,
      asset_id: row.product.assetId,
      import_id: importId,
      type,
      status: MovementStatus.CLEARED,
      description: `${row.movementType} · ${row.product.ticker ?? row.product.rawProduct}`,
      notes: JSON.stringify({ source: "B3", raw: row.raw }),
      amount,
      transaction_date: row.date,
      competence_date: row.date,
      due_date: row.date,
      tags,
      attachments: [],
      duplicate_hash: `B3|${row.fingerprint}`,
      is_historical: true,
      quantity,
      unit_price: row.unitPrice,
      external_ref: row.fingerprint,
    };
  }

  static rawRow(row: B3PreviewRow): B3RawRow {
    return row.raw;
  }
}