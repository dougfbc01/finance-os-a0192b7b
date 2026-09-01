// ReconciliationService — Conciliação de transferências entre contas próprias.
//
// Sprint 4.14 — a conciliação NÃO exclui lançamentos. Ao confirmar, os dois
// lançamentos originais permanecem no histórico e passam a compartilhar um
// transfer_group_id:
//   - perna de saída  → type TRANSFER, account_id = origem, transfer_account_id = destino
//   - perna espelho   → type TRANSFER, account_id = destino, transfer_account_id = null
// O impacto financeiro continua sendo calculado por MovementService.impactOnAccount:
// a perna de saída debita a origem e credita o destino; a perna espelho tem
// impacto zero (evita contagem dupla). Nenhuma terceira movimentação é criada.
//
// Deduplicação técnica (duplicate_hash) e conciliação de transferência são
// problemas diferentes e permanecem separados.
import { BaseService } from "./BaseService";
import { INCOME_TYPES, EXPENSE_TYPES, MovementType, MovementStatus } from "@/constants/enums";
import { logFinanceError } from "@/lib/logger";
import { TransactionFingerprintServiceImpl as FP } from "./TransactionFingerprintService";
import { ReconciliationDecisionService, ReconciliationDecisionServiceImpl as RD } from "./ReconciliationDecisionService";
import {
  TRANSFER_AMOUNT_TOLERANCE,
  TRANSFER_HIGH_DAY_DIFF,
  TRANSFER_KEYWORDS,
  TRANSFER_MAX_DAY_DIFF,
  TRANSFER_TEXT_SIMILARITY,
} from "@/constants/reconciliation";
import type { Movement, UUID } from "@/models";

export interface TransferCandidate {
  outflow: Movement;
  inflow: Movement;
  confidence: "high" | "medium" | "low";
  dayDiff: number;
  /** Sinais que sustentaram a sugestão (auditável na UI). */
  signals: string[];
}

export interface CandidateOptions {
  /** Pares rejeitados manualmente ("não são relacionados"). */
  rejectedPairKeys?: Set<string>;
  /** Pares já confirmados manualmente como a mesma transferência. */
  matchedPairKeys?: Set<string>;
  maxDayDiff?: number;
}

function daysBetween(a: string, b: string): number {
  const d1 = new Date(`${a}T00:00:00`).getTime();
  const d2 = new Date(`${b}T00:00:00`).getTime();
  return Math.abs(Math.round((d1 - d2) / 86400000));
}

function hasTransferKeyword(text: string | null | undefined): boolean {
  const t = (text ?? "").toLowerCase();
  return TRANSFER_KEYWORDS.some((k) => t.includes(k));
}

class ReconciliationServiceImpl extends BaseService {
  /** Perna espelho de uma transferência conciliada (impacto zero no caixa). */
  static isMirrorLeg(m: Movement): boolean {
    return (
      m.type === MovementType.TRANSFER && !!m.transfer_group_id && !m.transfer_account_id
    );
  }

  /**
   * Detecta pares de movimentações candidatas a transferência entre contas.
   * Critérios: mesmo valor absoluto, direções opostas, contas diferentes e
   * datas dentro da janela central (TRANSFER_MAX_DAY_DIFF). Texto é apenas
   * reforço — nunca obrigatório, pois bancos descrevem a operação de formas
   * diferentes ("PIX ENVIADO" x "RECEBIMENTO PIX").
   */
  static findCandidates(
    movements: Movement[],
    options: CandidateOptions = {},
  ): TransferCandidate[] {
    const maxDayDiff = options.maxDayDiff ?? TRANSFER_MAX_DAY_DIFF;
    const candidates: TransferCandidate[] = [];
    const usable = movements.filter(
      (m) =>
        !m.deleted_at &&
        !m.is_historical &&
        !m.transfer_group_id &&
        !m.card_id &&
        m.type !== MovementType.TRANSFER &&
        m.type !== MovementType.CARD_PAYMENT,
    );
    const outflows = usable.filter((m) => EXPENSE_TYPES.includes(m.type));
    const inflows = usable.filter((m) => INCOME_TYPES.includes(m.type));
    const usedIn = new Set<UUID>();
    const usedOut = new Set<UUID>();

    for (const out of outflows) {
      if (usedOut.has(out.id)) continue;
      const matches = inflows.filter(
        (inc) =>
          !usedIn.has(inc.id) &&
          inc.account_id &&
          out.account_id &&
          inc.account_id !== out.account_id &&
          Math.abs(inc.amount - out.amount) < TRANSFER_AMOUNT_TOLERANCE &&
          daysBetween(inc.transaction_date, out.transaction_date) <= maxDayDiff &&
          // Decisão humana tem prioridade absoluta sobre a heurística.
          !RD.isRejected(options.rejectedPairKeys, out.id, inc.id) &&
          !RD.hasPair(options.matchedPairKeys, out.id, inc.id),
      );
      if (matches.length === 0) continue;

      // Melhor par: menor diferença de datas; empate resolvido pelo texto.
      const scored = matches
        .map((m) => ({
          m,
          diff: daysBetween(m.transaction_date, out.transaction_date),
          text: FP.textSimilarity(out.description ?? "", m.description ?? ""),
        }))
        .sort((a, b) => a.diff - b.diff || b.text - a.text);
      const best = scored[0];

      const signals = ["Mesmo valor", "Direções opostas", "Contas diferentes"];
      if (best.diff === 0) signals.push("Mesma data");
      else signals.push(`${best.diff} dia(s) de diferença`);
      const textual = best.text >= TRANSFER_TEXT_SIMILARITY;
      if (textual) signals.push("Descrições semelhantes");
      const keyword =
        hasTransferKeyword(out.description) && hasTransferKeyword(best.m.description);
      if (keyword) signals.push("Indício de PIX/TED/transferência");

      const unique = matches.length === 1;
      let confidence: TransferCandidate["confidence"];
      if (unique && best.diff <= TRANSFER_HIGH_DAY_DIFF && (keyword || textual)) {
        confidence = "high";
      } else if (unique && best.diff <= TRANSFER_HIGH_DAY_DIFF) {
        confidence = "high";
      } else if (unique) {
        confidence = "medium";
      } else {
        confidence = keyword || textual ? "medium" : "low";
      }

      candidates.push({ outflow: out, inflow: best.m, confidence, dayDiff: best.diff, signals });
      usedIn.add(best.m.id);
      usedOut.add(out.id);
    }
    return candidates;
  }

  /** Candidatas do workspace já filtradas pelas decisões manuais persistidas. */
  async listCandidates(workspaceId: UUID): Promise<TransferCandidate[]> {
    const { data, error } = await this.client
      .from("movements")
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null);
    if (error) this.handleError(error, "listCandidates");
    const movements = ((data ?? []) as unknown as Movement[]).map((m) => ({
      ...m,
      amount: Number(m.amount),
    }));
    const decisions = await ReconciliationDecisionService.list(workspaceId, "TRANSFER_MATCH");
    return ReconciliationServiceImpl.findCandidates(movements, {
      rejectedPairKeys: RD.rejectedKeys(decisions, "TRANSFER_MATCH"),
      matchedPairKeys: RD.matchedKeys(decisions, "TRANSFER_MATCH"),
    });
  }

  /**
   * Aplica a conciliação: liga os dois lançamentos como uma única transferência.
   * Nenhum lançamento é excluído; a decisão MATCH fica persistida.
   */
  async apply(candidate: TransferCandidate): Promise<void> {
    const groupId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`;

    const { error: e1 } = await this.client
      .from("movements")
      .update({
        type: MovementType.TRANSFER,
        transfer_account_id: candidate.inflow.account_id,
        transfer_group_id: groupId,
        category_id: null,
        subcategory_id: null,
        status: MovementStatus.RECONCILED,
      } as never)
      .eq("id", candidate.outflow.id);
    if (e1) this.handleError(e1, "apply.outflow");

    // Perna espelho: permanece no histórico da conta de destino, sem impacto
    // próprio no saldo (o crédito já vem da perna de saída).
    const { error: e2 } = await this.client
      .from("movements")
      .update({
        type: MovementType.TRANSFER,
        transfer_account_id: null,
        transfer_group_id: groupId,
        category_id: null,
        subcategory_id: null,
        status: MovementStatus.RECONCILED,
      } as never)
      .eq("id", candidate.inflow.id);
    if (e2) this.handleError(e2, "apply.inflow");

    await ReconciliationDecisionService.confirmTransfer({
      workspaceId: candidate.outflow.workspace_id,
      movementAId: candidate.outflow.id,
      movementBId: candidate.inflow.id,
      notes: `Confiança ${candidate.confidence}`,
    });
  }

  /** "Não são relacionados" — decisão persistente, nunca mais sugerido. */
  async reject(candidate: TransferCandidate): Promise<void> {
    await ReconciliationDecisionService.rejectTransfer({
      workspaceId: candidate.outflow.workspace_id,
      movementAId: candidate.outflow.id,
      movementBId: candidate.inflow.id,
    });
  }

  async applyMany(candidates: TransferCandidate[]): Promise<number> {
    let count = 0;
    for (const c of candidates) {
      try {
        await this.apply(c);
        count++;
      } catch (e) {
        // Nunca silencioso (Sprint 3.6): registra e segue com os demais.
        logFinanceError("reconciliation", "applyMany", e);
      }
    }
    return count;
  }
}

export const ReconciliationService = new ReconciliationServiceImpl();
export { ReconciliationServiceImpl };
