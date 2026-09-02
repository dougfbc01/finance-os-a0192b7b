// CardInvoiceReconciliationService — Sprint 4.14
// Diagnóstico (e SOMENTE diagnóstico) da fatura de cartão: compara a fatura
// oficial informada com os movimentos já existentes no Finance OS.
//
// REGRA ABSOLUTA: este serviço NUNCA cria, altera ou exclui movimentos,
// parcelas, pagamentos, saldos ou patrimônio. Toda saída é derivada.
//
// Reutiliza: CardService (período da fatura), CardInvoiceService (fatura e
// movimentos vinculados), TransactionFingerprintService (similaridade textual)
// e os parsers de importação (leitura do arquivo oficial).
import { BaseService } from "./BaseService";
import { CardService, CardServiceImpl } from "./CardService";
import { CardInvoiceService } from "./CardInvoiceService";
import { TransactionFingerprintService as FP } from "./TransactionFingerprintService";
import { parseAmount, parseCSV, parseDate } from "./importers/utils";
import {
  INVOICE_AMBIGUITY_MARGIN,
  INVOICE_AMOUNT_TOLERANCE,
  INVOICE_DATE_MAX_DAYS,
  INVOICE_DATE_TOLERANCE_DAYS,
  INVOICE_FEE_KEYWORDS,
  INVOICE_MATCH_MIN_SCORE,
  INVOICE_MATCH_STRONG_SCORE,
  INVOICE_MATCH_WEIGHTS as W,
  INVOICE_REFUND_KEYWORDS,
  INVOICE_TEXT_SIMILARITY,
} from "@/constants/cardReconciliation";
import type { CardInvoice, Movement, UUID } from "@/models";
import type {
  InvoiceMatchCandidate,
  InvoiceReconciliationBadge,
  InvoiceReconciliationItem,
  InvoiceReconciliationResult,
  InvoiceReconciliationStatus,
  MatchingSignal,
  OfficialInvoiceLine,
} from "@/models/CardInvoiceReconciliation";

function normalizeText(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const da = Date.parse(`${a}T00:00:00Z`);
  const db = Date.parse(`${b}T00:00:00Z`);
  if (Number.isNaN(da) || Number.isNaN(db)) return null;
  return Math.abs(Math.round((da - db) / 86_400_000));
}

/** Extrai "3/10" ou "parcela 3 de 10" de uma descrição. */
export function parseInstallment(description: string): {
  installment: number | null;
  total: number | null;
} {
  const s = normalizeText(description);
  const m = /\b(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\b/.exec(s);
  if (!m) return { installment: null, total: null };
  const installment = Number(m[1]);
  const total = Number(m[2]);
  if (!installment || !total || installment > total) return { installment: null, total: null };
  return { installment, total };
}

function hasKeyword(description: string, keywords: string[]): boolean {
  const s = normalizeText(description);
  return keywords.some((k) => s.includes(normalizeText(k)));
}

export function isFeeLike(description: string): boolean {
  return hasKeyword(description, INVOICE_FEE_KEYWORDS);
}

export function isRefundLike(description: string, amount: number): boolean {
  return amount < 0 || hasKeyword(description, INVOICE_REFUND_KEYWORDS);
}

/** Direção contábil comparável entre fatura e movimento. */
function movementDirection(m: Movement): "DEBIT" | "CREDIT" {
  return m.type === "REFUND" || m.type === "ADJUSTMENT" ? "CREDIT" : "DEBIT";
}

interface Scored {
  movement: Movement;
  score: number;
  reasons: string[];
  signals: MatchingSignal[];
  dateDiff: number | null;
  amountDiff: number;
}

class CardInvoiceReconciliationServiceImpl extends BaseService {
  // ---------------------------------------------------------------------
  // Parsing da fatura oficial (arquivo CSV do emissor) — puro, sem I/O.
  // ---------------------------------------------------------------------
  static parseOfficialLines(fileText: string): OfficialInvoiceLine[] {
    const rows = parseCSV(fileText);
    const lines: OfficialInvoiceLine[] = [];
    rows.forEach((r, idx) => {
      const date = parseDate(
        String(r["date"] ?? r["Data"] ?? r["data"] ?? r["transaction_date"] ?? ""),
      );
      const amount = parseAmount(
        String(r["amount"] ?? r["Valor"] ?? r["valor"] ?? r["value"] ?? ""),
      );
      const description = String(
        r["title"] ?? r["Descrição"] ?? r["descricao"] ?? r["description"] ?? "",
      ).trim();
      if (!date || !Number.isFinite(amount)) return;
      const inst = parseInstallment(description);
      lines.push({
        index: idx,
        date,
        description: description || "(sem descrição)",
        amount,
        external_ref:
          (r["identificador"] as string) ?? (r["external_ref"] as string) ?? null,
        installment: inst.installment,
        installments_total: inst.total,
      });
    });
    return lines;
  }

  // ---------------------------------------------------------------------
  // Score explicável entre uma linha oficial e um movimento.
  // ---------------------------------------------------------------------
  static scoreCandidate(
    line: OfficialInvoiceLine,
    movement: Movement,
    invoiceId: UUID | null,
  ): Scored {
    const reasons: string[] = [];
    const signals: MatchingSignal[] = [];
    let score = 0;

    const officialAbs = Math.abs(line.amount);
    const systemAbs = Math.abs(Number(movement.amount));
    const amountDiff = Number((officialAbs - systemAbs).toFixed(2));
    const dateDiff = daysBetween(line.date, movement.transaction_date);

    if (line.external_ref && movement.external_ref && line.external_ref === movement.external_ref) {
      reasons.push("Identificador externo idêntico");
      signals.push({ kind: "POSITIVE", label: "Identificador externo idêntico" });
      return { movement, score: W.EXTERNAL_REF, reasons, signals, dateDiff, amountDiff };
    }

    if (invoiceId && movement.invoice_id === invoiceId) {
      score += W.SAME_INVOICE;
      reasons.push("Mesma fatura");
      signals.push({ kind: "POSITIVE", label: "Mesma fatura" });
    }

    if (Math.abs(amountDiff) <= INVOICE_AMOUNT_TOLERANCE) {
      score += W.AMOUNT_EXACT;
      reasons.push("Mesmo valor");
      signals.push({ kind: "POSITIVE", label: "Mesmo valor" });
    } else if (Math.abs(amountDiff) <= Math.max(1, officialAbs * 0.05)) {
      score += W.AMOUNT_NEAR;
      reasons.push("Valor próximo");
      signals.push({ kind: "WARNING", label: "Valor próximo, porém diferente" });
    }

    const inst = parseInstallment(movement.description);
    if (
      line.installment &&
      inst.installment &&
      line.installment === inst.installment &&
      line.installments_total === inst.total
    ) {
      score += W.INSTALLMENT_EXACT;
      reasons.push(`Mesma parcela ${line.installment}/${line.installments_total}`);
      signals.push({
        kind: "POSITIVE",
        label: `Mesma parcela ${line.installment}/${line.installments_total}`,
      });
    }

    const sameFingerprint =
      !!FP.build(line.description) && FP.build(line.description) === FP.build(movement.description);
    const textual = FP.textSimilarity(line.description, movement.description);
    if (sameFingerprint || textual >= 0.8) {
      score += W.DESCRIPTION_STRONG;
      reasons.push("Descrição equivalente");
      signals.push({ kind: "POSITIVE", label: "Descrição equivalente" });
    } else if (textual >= INVOICE_TEXT_SIMILARITY) {
      score += W.DESCRIPTION_PARTIAL;
      reasons.push("Descrição semelhante");
      signals.push({ kind: "WARNING", label: "Descrição apenas semelhante" });
    }

    if (dateDiff === 0) {
      score += W.DATE_EXACT;
      reasons.push("Mesma data");
      signals.push({ kind: "POSITIVE", label: "Mesma data" });
    } else if (dateDiff !== null && dateDiff <= INVOICE_DATE_TOLERANCE_DAYS) {
      score += W.DATE_NEAR;
      reasons.push(`Data com diferença de ${dateDiff} dia(s)`);
      signals.push({ kind: "POSITIVE", label: `Diferença de ${dateDiff} dia(s)` });
    } else if (dateDiff !== null && dateDiff <= INVOICE_DATE_MAX_DAYS) {
      score += W.DATE_FAR;
      reasons.push(`Data com diferença de ${dateDiff} dias`);
      signals.push({ kind: "WARNING", label: `Diferença de ${dateDiff} dias` });
    } else if (dateDiff !== null) {
      score += W.DATE_PENALTY;
      signals.push({ kind: "NEGATIVE", label: `Diferença de ${dateDiff} dias` });
    }

    const officialDirection = line.amount < 0 ? "CREDIT" : "DEBIT";
    if (officialDirection !== movementDirection(movement)) {
      score += W.DIRECTION_MISMATCH;
      signals.push({ kind: "NEGATIVE", label: "Sentido divergente (compra x estorno)" });
    }

    return {
      movement,
      score: Math.max(0, Math.min(100, score)),
      reasons,
      signals,
      dateDiff,
      amountDiff,
    };
  }

  // ---------------------------------------------------------------------
  // Motor puro de conciliação — determinístico e idempotente.
  // ---------------------------------------------------------------------
  static reconcile(params: {
    invoiceId: UUID;
    cardId?: UUID | null;
    officialLines: OfficialInvoiceLine[];
    movements: Movement[];
    officialTotal?: number | null;
    executedAt?: string;
  }): InvoiceReconciliationResult {
    const lines = [...params.officialLines].sort(
      (a, b) => a.date.localeCompare(b.date) || a.index - b.index,
    );
    // Pagamento de fatura nunca compõe a fatura (regra existente da Sprint 3.6).
    const movements = [...params.movements]
      .filter((m) => m.type !== "CARD_PAYMENT")
      .sort((a, b) => a.transaction_date.localeCompare(b.transaction_date) || a.id.localeCompare(b.id));

    const used = new Set<UUID>();
    const items: InvoiceReconciliationItem[] = [];

    for (const line of lines) {
      const scored = movements
        .filter((m) => !used.has(m.id))
        .map((m) => this.scoreCandidate(line, m, params.invoiceId))
        .filter((s) => s.score >= INVOICE_MATCH_MIN_SCORE)
        .sort((a, b) => b.score - a.score || a.movement.id.localeCompare(b.movement.id));

      const candidates: InvoiceMatchCandidate[] = scored.slice(0, 5).map((s) => ({
        movement_id: s.movement.id,
        description: s.movement.description,
        amount: Number(s.movement.amount),
        transaction_date: s.movement.transaction_date,
        confidence: s.score,
        reasons: s.reasons,
      }));

      const base = {
        official: line,
        official_amount: line.amount,
        official_date: line.date,
        installment: line.installment ?? null,
        installments_total: line.installments_total ?? null,
        candidates,
      };

      if (scored.length === 0) {
        const status: InvoiceReconciliationStatus = isFeeLike(line.description)
          ? "INTEREST_OR_FEE"
          : isRefundLike(line.description, line.amount)
            ? "REFUND_OR_REVERSAL"
            : "MISSING_IN_SYSTEM";
        items.push({
          key: `official:${line.index}`,
          status,
          movement: null,
          system_amount: null,
          amount_difference: null,
          system_date: null,
          date_diff_days: null,
          confidence: 0,
          matching_reasons: [],
          matching_signals: [{ kind: "WARNING", label: "Nenhum movimento correspondente" }],
          diagnosis:
            status === "INTEREST_OR_FEE"
              ? "Encargo identificado na fatura, sem lançamento correspondente."
              : status === "REFUND_OR_REVERSAL"
                ? "Estorno/crédito identificado na fatura, sem lançamento correspondente."
                : "Lançamento da fatura não encontrado no Finance OS.",
          ...base,
        });
        continue;
      }

      const best = scored[0];
      const runnerUp = scored[1];
      const ambiguous =
        !!runnerUp && best.score - runnerUp.score <= INVOICE_AMBIGUITY_MARGIN;
      const duplicateLike =
        ambiguous &&
        Math.abs(Math.abs(Number(runnerUp.movement.amount)) - Math.abs(line.amount)) <=
          INVOICE_AMOUNT_TOLERANCE &&
        Math.abs(best.amountDiff) <= INVOICE_AMOUNT_TOLERANCE;

      if (ambiguous) {
        items.push({
          key: `official:${line.index}`,
          status: duplicateLike ? "POSSIBLE_DUPLICATE" : "AMBIGUOUS_MATCH",
          movement: null,
          system_amount: null,
          amount_difference: null,
          system_date: null,
          date_diff_days: null,
          confidence: best.score,
          matching_reasons: best.reasons,
          matching_signals: [
            ...best.signals,
            {
              kind: "WARNING",
              label: `${scored.length} movimentos candidatos encontrados`,
            },
          ],
          diagnosis: duplicateLike
            ? "Mais de um movimento com o mesmo valor pode representar este lançamento."
            : "Mais de um movimento é candidato — nenhuma escolha automática foi feita.",
          ...base,
        });
        continue;
      }

      used.add(best.movement.id);
      const amountDivergent = Math.abs(best.amountDiff) > INVOICE_AMOUNT_TOLERANCE;
      const dateDivergent =
        best.dateDiff !== null && best.dateDiff > INVOICE_DATE_TOLERANCE_DAYS;

      let status: InvoiceReconciliationStatus;
      if (isFeeLike(line.description)) status = "INTEREST_OR_FEE";
      else if (isRefundLike(line.description, line.amount)) status = "REFUND_OR_REVERSAL";
      else if (amountDivergent) status = "AMOUNT_MISMATCH";
      else if (dateDivergent) status = "DATE_MISMATCH";
      else if (best.score < INVOICE_MATCH_STRONG_SCORE) status = "PARTIAL_MATCH";
      else status = "MATCHED";

      items.push({
        key: `official:${line.index}`,
        status,
        movement: best.movement,
        system_amount: Number(best.movement.amount),
        amount_difference: best.amountDiff,
        system_date: best.movement.transaction_date,
        date_diff_days: best.dateDiff,
        confidence: best.score,
        matching_reasons: best.reasons,
        matching_signals: best.signals,
        diagnosis:
          status === "AMOUNT_MISMATCH"
            ? "Mesmo lançamento com valor diferente entre fatura e sistema."
            : status === "DATE_MISMATCH"
              ? "Mesmo lançamento com datas diferentes."
              : status === "INTEREST_OR_FEE"
                ? "Encargo da fatura com lançamento correspondente."
                : status === "REFUND_OR_REVERSAL"
                  ? "Estorno/reembolso com lançamento correspondente."
                  : status === "PARTIAL_MATCH"
                    ? "Correspondência provável, com sinais parciais."
                    : "Correspondência forte entre fatura e sistema.",
        ...base,
      });
    }

    // Caminho inverso: movimentos do cartão sem correspondência na fatura.
    for (const m of movements) {
      if (used.has(m.id)) continue;
      const status: InvoiceReconciliationStatus = isFeeLike(m.description)
        ? "INTEREST_OR_FEE"
        : m.type === "REFUND" || isRefundLike(m.description, 0)
          ? "REFUND_OR_REVERSAL"
          : "MISSING_IN_INVOICE";
      items.push({
        key: `movement:${m.id}`,
        status,
        official: null,
        movement: m,
        official_amount: null,
        system_amount: Number(m.amount),
        amount_difference: null,
        official_date: null,
        system_date: m.transaction_date,
        date_diff_days: null,
        installment: parseInstallment(m.description).installment,
        installments_total: parseInstallment(m.description).total,
        confidence: 0,
        matching_reasons: [],
        matching_signals: [{ kind: "WARNING", label: "Sem linha correspondente na fatura" }],
        candidates: [],
        diagnosis:
          status === "MISSING_IN_INVOICE"
            ? "Movimento existe no Finance OS mas não consta na fatura analisada."
            : status === "INTEREST_OR_FEE"
              ? "Encargo lançado no sistema sem linha correspondente na fatura."
              : "Estorno lançado no sistema sem linha correspondente na fatura.",
      });
    }

    const count = (s: InvoiceReconciliationStatus) =>
      items.filter((i) => i.status === s).length;

    const officialTotal =
      params.officialTotal ??
      (lines.length ? lines.reduce((acc, l) => acc + l.amount, 0) : 0);

    const matchedTotal = items
      .filter((i) => i.movement && i.official)
      .reduce((acc, i) => acc + (i.official!.amount < 0 ? -1 : 1) * Math.abs(i.system_amount ?? 0), 0);

    const missingInSystem = count("MISSING_IN_SYSTEM");
    const missingInInvoice = count("MISSING_IN_INVOICE");
    const amountMismatch = count("AMOUNT_MISMATCH");
    const dateMismatch = count("DATE_MISMATCH");
    const possibleDuplicate = count("POSSIBLE_DUPLICATE");
    const ambiguous = count("AMBIGUOUS_MATCH");
    const difference = Number((officialTotal - matchedTotal).toFixed(2));

    return {
      invoice_id: params.invoiceId,
      card_id: params.cardId ?? null,
      executed_at: params.executedAt ?? new Date().toISOString(),
      official_invoice_total: Number(officialTotal.toFixed(2)),
      matched_total: Number(matchedTotal.toFixed(2)),
      difference,
      matched_count: count("MATCHED") + count("PARTIAL_MATCH"),
      missing_in_system_count: missingInSystem,
      missing_in_invoice_count: missingInInvoice,
      amount_mismatch_count: amountMismatch,
      date_mismatch_count: dateMismatch,
      possible_duplicate_count: possibleDuplicate,
      refund_count: count("REFUND_OR_REVERSAL"),
      fee_count: count("INTEREST_OR_FEE"),
      ambiguous_count: ambiguous,
      is_reconciled:
        Math.abs(difference) <= INVOICE_AMOUNT_TOLERANCE &&
        missingInSystem + missingInInvoice + amountMismatch + dateMismatch +
          possibleDuplicate + ambiguous ===
          0,
      items,
    };
  }

  static badge(result: InvoiceReconciliationResult | null): InvoiceReconciliationBadge {
    if (!result) return "NOT_RECONCILED";
    return result.is_reconciled ? "RECONCILED" : "DIVERGENT";
  }

  // ---------------------------------------------------------------------
  // Orquestração com I/O (somente leitura).
  // ---------------------------------------------------------------------
  /** Movimentos candidatos: vinculados à fatura + compras do período do cartão. */
  async loadMovements(invoice: CardInvoice): Promise<Movement[]> {
    const linked = await CardInvoiceService.listMovements(invoice.id);
    const card = await CardService.getById(invoice.card_id);
    const byId = new Map<UUID, Movement>(linked.map((m) => [m.id, m]));
    if (card) {
      const period = CardServiceImpl.computeInvoicePeriod(card, invoice.closing_date);
      const start = period.period_start ?? invoice.closing_date;
      const { data, error } = await this.client
        .from("movements")
        .select("*")
        .eq("card_id", card.id)
        .is("deleted_at", null)
        .gte("transaction_date", start)
        .lte("transaction_date", invoice.closing_date);
      if (error) this.handleError(error, "loadMovements");
      for (const row of (data ?? []) as unknown as Movement[]) {
        if (!byId.has(row.id)) byId.set(row.id, { ...row, amount: Number(row.amount) });
      }
    }
    return [...byId.values()];
  }

  /** Executa o diagnóstico. Nenhum dado é gravado. */
  async run(params: {
    invoiceId: UUID;
    officialLines?: OfficialInvoiceLine[];
    officialTotal?: number | null;
  }): Promise<InvoiceReconciliationResult> {
    const invoice = await CardInvoiceService.getById(params.invoiceId);
    if (!invoice) this.handleError(new Error("Fatura não encontrada."), "run");
    const movements = await this.loadMovements(invoice as CardInvoice);
    return CardInvoiceReconciliationServiceImpl.reconcile({
      invoiceId: (invoice as CardInvoice).id,
      cardId: (invoice as CardInvoice).card_id,
      officialLines: params.officialLines ?? [],
      movements,
      officialTotal:
        params.officialTotal ??
        (params.officialLines?.length ? null : Number((invoice as CardInvoice).amount)),
    });
  }
}

export const CardInvoiceReconciliationService = new CardInvoiceReconciliationServiceImpl();
export { CardInvoiceReconciliationServiceImpl };
