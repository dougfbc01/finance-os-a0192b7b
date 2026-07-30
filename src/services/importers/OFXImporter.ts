// Importador OFX genérico (compatível com Itaú, Caixa, Santander e demais).
import { MovementType, MovementStatus } from "@/constants/enums";
import type { Importer, ImportContext, PreviewResult, PreviewRow } from "./types";
import { buildDuplicateHash, parseAmount, parseDate } from "./utils";

interface OfxTrn {
  fitid: string | null;
  date: string | null;
  amount: number;
  memo: string;
  trntype: string;
}

const FATURA_RE = /pagamento.*fatura|fatura.*cartao|fatura.*cartão/i;

function parseOfx(text: string): OfxTrn[] {
  const trns: OfxTrn[] = [];
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  for (const block of blocks) {
    const end = block.search(/<\/STMTTRN>/i);
    const chunk = end >= 0 ? block.slice(0, end) : block;
    const get = (tag: string): string => {
      const m = new RegExp(`<${tag}>\\s*([^<\\r\\n]+)`, "i").exec(chunk);
      return m ? m[1].trim() : "";
    };
    trns.push({
      fitid: get("FITID") || null,
      date: parseDate(get("DTPOSTED")),
      amount: parseAmount(get("TRNAMT")),
      memo: get("MEMO") || get("NAME") || "",
      trntype: get("TRNTYPE"),
    });
  }
  return trns;
}

export class OFXImporter implements Importer {
  readonly source = "OFX" as const;

  parse(fileText: string): Record<string, unknown>[] {
    return parseOfx(fileText) as unknown as Record<string, unknown>[];
  }

  validate(rows: Record<string, unknown>[]) {
    let invalid = 0;
    const valid = rows.filter((r) => {
      const t = r as unknown as OfxTrn;
      if (!t.date || !Number.isFinite(t.amount)) { invalid++; return false; }
      return true;
    });
    return { valid, invalid };
  }

  async preview(fileText: string, ctx: ImportContext, fileName: string, fileHash: string): Promise<PreviewResult> {
    const trns = parseOfx(fileText);
    const preview: PreviewRow[] = [];
    const seen = new Set<string>();
    const totals = { total: trns.length, valid: 0, invalid: 0, duplicated: 0, transfers: 0, incomes: 0, expenses: 0, cardPayments: 0 };

    trns.forEach((t, idx) => {
      const errors: string[] = [];
      if (!t.date) errors.push("Data inválida");
      if (!Number.isFinite(t.amount)) errors.push("Valor inválido");

      const isCardPayment = FATURA_RE.test(t.memo);
      let type: MovementType;
      if (isCardPayment) type = MovementType.CARD_PAYMENT;
      else if (t.amount >= 0) type = MovementType.INCOME;
      else type = MovementType.EXPENSE;

      const amount = Math.abs(t.amount || 0);
      const hash = buildDuplicateHash({
        workspaceId: ctx.workspaceId,
        accountId: ctx.accountId,
        date: t.date ?? "",
        amount,
        description: t.memo,
        externalId: t.fitid,
      });
      const dup = seen.has(hash);
      seen.add(hash);
      const isDuplicate = dup || ctx.existingHashes.has(hash);

      const invalid = errors.length > 0;
      if (invalid) totals.invalid++;
      else if (isDuplicate) totals.duplicated++;
      else {
        totals.valid++;
        if (isCardPayment) totals.cardPayments++;
        else if (type === MovementType.INCOME) totals.incomes++;
        else totals.expenses++;
      }

      preview.push({
        index: idx,
        raw: t as unknown as Record<string, unknown>,
        transaction_date: t.date ?? "",
        description: t.memo || "(sem descrição)",
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
        isTransfer: false,
        isCardPayment,
        isInvalid: invalid,
        errors,
      });
    });

    return { source: this.source, fileName, fileHash, rows: preview, totals };
  }
}
