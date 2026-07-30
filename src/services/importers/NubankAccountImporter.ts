// Importador do CSV oficial da Conta Nubank.
// Cabeçalhos: Data, Valor, Identificador, Descrição.
import { MovementType, MovementStatus } from "@/constants/enums";
import type { Importer, ImportContext, PreviewResult, PreviewRow } from "./types";
import { buildDuplicateHash, normalizeDescription, parseAmount, parseCSV, parseDate } from "./utils";

const FATURA_RE = /pagamento.*fatura|fatura.*pagamento|pagamento de fatura/i;
const TRANSFER_RE = /transfer[eêê]ncia|ted|doc|pix (enviado|recebido)/i;

export class NubankAccountImporter implements Importer {
  readonly source = "NUBANK_ACCOUNT" as const;

  parse(fileText: string): Record<string, unknown>[] {
    return parseCSV(fileText);
  }

  validate(rows: Record<string, unknown>[]) {
    let invalid = 0;
    const valid = rows.filter((r) => {
      const date = parseDate(String(r["Data"] ?? r["data"] ?? ""));
      const amount = parseAmount(String(r["Valor"] ?? r["valor"] ?? ""));
      if (!date || !Number.isFinite(amount)) { invalid++; return false; }
      return true;
    });
    return { valid, invalid };
  }

  async preview(fileText: string, ctx: ImportContext, fileName: string, fileHash: string): Promise<PreviewResult> {
    const rows = this.parse(fileText);
    const preview: PreviewRow[] = [];
    const seenInFile = new Set<string>();
    const totals = { total: rows.length, valid: 0, invalid: 0, duplicated: 0, transfers: 0, incomes: 0, expenses: 0, cardPayments: 0 };

    rows.forEach((r, idx) => {
      const date = parseDate(String(r["Data"] ?? r["data"] ?? ""));
      const rawAmount = parseAmount(String(r["Valor"] ?? r["valor"] ?? ""));
      const description = String(r["Descrição"] ?? r["Descricao"] ?? r["descricao"] ?? "").trim();
      const externalId = String(r["Identificador"] ?? r["identificador"] ?? "").trim() || null;

      const errors: string[] = [];
      if (!date) errors.push("Data inválida");
      if (!Number.isFinite(rawAmount)) errors.push("Valor inválido");

      const isCardPayment = FATURA_RE.test(description);
      const isTransfer = TRANSFER_RE.test(description);
      let type: MovementType;
      if (isCardPayment) type = MovementType.CARD_PAYMENT;
      else if (rawAmount >= 0) type = MovementType.INCOME;
      else type = MovementType.EXPENSE;

      const amount = Math.abs(rawAmount || 0);
      const hash = buildDuplicateHash({
        workspaceId: ctx.workspaceId,
        accountId: ctx.accountId,
        date: date ?? "",
        amount,
        description,
        externalId,
      });
      const dupInFile = seenInFile.has(hash);
      seenInFile.add(hash);
      const isDuplicate = dupInFile || ctx.existingHashes.has(hash);

      const invalid = errors.length > 0;
      if (invalid) totals.invalid++;
      else if (isDuplicate) totals.duplicated++;
      else {
        totals.valid++;
        if (isCardPayment) totals.cardPayments++;
        else if (isTransfer) totals.transfers++;
        else if (type === MovementType.INCOME) totals.incomes++;
        else if (type === MovementType.EXPENSE) totals.expenses++;
      }

      preview.push({
        index: idx,
        raw: r,
        transaction_date: date ?? "",
        description: description || "(sem descrição)",
        amount,
        type,
        status: MovementStatus.CLEARED,
        account_id: ctx.accountId,
        card_id: null,
        transfer_account_id: null,
        // Sprint 3.4: importação nunca preenche categoria; só regras automáticas classificam.
        category_id: null,
        subcategory_id: null,
        duplicate_hash: hash,
        isDuplicate,
        isTransfer,
        isCardPayment,
        isInvalid: invalid,
        errors,
      });
    });

    return {
      source: this.source,
      fileName,
      fileHash,
      rows: preview,
      totals,
    };
  }
}

// silence unused warning for normalizeDescription in tree-shake
void normalizeDescription;
