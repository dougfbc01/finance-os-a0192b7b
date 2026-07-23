// Importador do CSV de fatura do Cartão Nubank.
// Cabeçalhos: date, title, amount. Valor positivo = compra; negativo = estorno.
import { MovementType, MovementStatus } from "@/constants/enums";
import type { Importer, ImportContext, PreviewResult, PreviewRow } from "./types";
import { buildDuplicateHash, parseAmount, parseCSV, parseDate } from "./utils";

export class NubankCreditCardImporter implements Importer {
  readonly source = "NUBANK_CREDIT_CARD" as const;

  parse(fileText: string): Record<string, unknown>[] {
    return parseCSV(fileText);
  }

  validate(rows: Record<string, unknown>[]) {
    let invalid = 0;
    const valid = rows.filter((r) => {
      const date = parseDate(String(r["date"] ?? r["Data"] ?? ""));
      const amount = parseAmount(String(r["amount"] ?? r["Valor"] ?? ""));
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
      const date = parseDate(String(r["date"] ?? r["Data"] ?? ""));
      const raw = parseAmount(String(r["amount"] ?? r["Valor"] ?? ""));
      const description = String(r["title"] ?? r["Descrição"] ?? r["descricao"] ?? "").trim();

      const errors: string[] = [];
      if (!date) errors.push("Data inválida");
      if (!Number.isFinite(raw)) errors.push("Valor inválido");

      // Fatura: valor positivo é despesa; negativo é estorno.
      const type = raw >= 0 ? MovementType.EXPENSE : MovementType.REFUND;
      const amount = Math.abs(raw || 0);
      const hash = buildDuplicateHash({
        workspaceId: ctx.workspaceId,
        accountId: ctx.accountId,
        date: date ?? "",
        amount,
        description: `card:${description}`,
      });
      const dup = seenInFile.has(hash);
      seenInFile.add(hash);
      const isDuplicate = dup || ctx.existingHashes.has(hash);

      const invalid = errors.length > 0;
      if (invalid) totals.invalid++;
      else if (isDuplicate) totals.duplicated++;
      else {
        totals.valid++;
        if (type === MovementType.EXPENSE) totals.expenses++;
        else totals.incomes++;
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
        transfer_account_id: null,
        category_id: ctx.defaults.cardCategoryId ?? ctx.defaults.categoryId,
        subcategory_id: ctx.defaults.cardSubcategoryId ?? ctx.defaults.subcategoryId,
        duplicate_hash: hash,
        isDuplicate,
        isTransfer: false,
        isCardPayment: false,
        isInvalid: invalid,
        errors,
      });
    });

    return { source: this.source, fileName, fileHash, rows: preview, totals };
  }
}
