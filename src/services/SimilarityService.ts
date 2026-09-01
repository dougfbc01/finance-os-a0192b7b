// SimilarityService — Sprint 4.1.1
// Compara movimentações usando cartão/conta + fingerprint + valor + janela de
// datas. A data NUNCA é critério absoluto: é apenas um dos fatores do score.
// Toda a decisão de duplicidade do sistema nasce aqui.
import { BaseService } from "./BaseService";
import { TransactionFingerprintService as FP } from "./TransactionFingerprintService";
import { ReconciliationDecisionServiceImpl as RD } from "./ReconciliationDecisionService";
import type { Movement, UUID } from "@/models";

/** Janela padrão de comparação (dias). */
export const SIMILARITY_WINDOW_DAYS = 3;
/** Acima deste score a duplicidade é resolvida automaticamente (não insere). */
export const AUTO_RESOLVE_THRESHOLD = 95;
/** A partir deste score o par entra em "Revisar Duplicidades". */
export const REVIEW_THRESHOLD = 80;

export type SimilarityReason =
  | "HASH"
  | "FINGERPRINT_AMOUNT_DATE"
  | "FINGERPRINT_AMOUNT"
  | "DESCRIPTION"
  | "NONE";

export interface SimilarityScore {
  confidence_match: number;
  reason: SimilarityReason;
  label: string;
  daysApart: number;
}

/** Forma mínima comparável (serve tanto para Movement quanto para linha de preview). */
export interface ComparableTransaction {
  id?: UUID;
  account_id?: UUID | null;
  card_id?: UUID | null;
  description: string;
  amount: number;
  transaction_date: string;
  duplicate_hash?: string | null;
  type?: string;
}

export interface DuplicatePair {
  original: Movement;
  duplicate: Movement;
  score: SimilarityScore;
}

const REASON_LABEL: Record<SimilarityReason, string> = {
  HASH: "Hash idêntico",
  FINGERPRINT_AMOUNT_DATE: "Fingerprint + valor + data próxima",
  FINGERPRINT_AMOUNT: "Fingerprint + valor",
  DESCRIPTION: "Descrição semelhante",
  NONE: "Sem semelhança relevante",
};

function daysBetween(a: string, b: string): number {
  const da = Date.parse(`${a}T00:00:00Z`);
  const db = Date.parse(`${b}T00:00:00Z`);
  if (Number.isNaN(da) || Number.isNaN(db)) return Number.POSITIVE_INFINITY;
  return Math.abs(Math.round((da - db) / 86_400_000));
}

function sameOrigin(a: ComparableTransaction, b: ComparableTransaction): boolean {
  const cardA = a.card_id ?? null;
  const cardB = b.card_id ?? null;
  if (cardA || cardB) return cardA === cardB;
  return (a.account_id ?? null) === (b.account_id ?? null);
}

class SimilarityServiceImpl extends BaseService {
  /** Score de similaridade entre duas transações. Puro, sem I/O. */
  static score(
    a: ComparableTransaction,
    b: ComparableTransaction,
    windowDays: number = SIMILARITY_WINDOW_DAYS,
  ): SimilarityScore {
    const none: SimilarityScore = {
      confidence_match: 0,
      reason: "NONE",
      label: REASON_LABEL.NONE,
      daysApart: daysBetween(a.transaction_date, b.transaction_date),
    };

    if (a.duplicate_hash && b.duplicate_hash && a.duplicate_hash === b.duplicate_hash) {
      return { confidence_match: 100, reason: "HASH", label: REASON_LABEL.HASH, daysApart: none.daysApart };
    }

    if (!sameOrigin(a, b)) return none;
    if (a.type && b.type && a.type !== b.type) return none;

    const sameAmount = Math.abs(Math.abs(a.amount) - Math.abs(b.amount)) < 0.005;
    const fpA = FP.build(a.description);
    const fpB = FP.build(b.description);
    const sameFingerprint = !!fpA && fpA === fpB;
    const days = none.daysApart;

    if (sameFingerprint && sameAmount && days <= windowDays) {
      return {
        confidence_match: 98,
        reason: "FINGERPRINT_AMOUNT_DATE",
        label: REASON_LABEL.FINGERPRINT_AMOUNT_DATE,
        daysApart: days,
      };
    }
    if (sameFingerprint && sameAmount) {
      return {
        confidence_match: 90,
        reason: "FINGERPRINT_AMOUNT",
        label: REASON_LABEL.FINGERPRINT_AMOUNT,
        daysApart: days,
      };
    }
    const textual = FP.textSimilarity(a.description, b.description);
    if (textual >= 0.7 && sameAmount && days <= windowDays) {
      return {
        confidence_match: 70,
        reason: "DESCRIPTION",
        label: REASON_LABEL.DESCRIPTION,
        daysApart: days,
      };
    }
    return none;
  }

  /** Melhor correspondência de uma transação recebida contra uma base existente. */
  static bestMatch(
    incoming: ComparableTransaction,
    existing: Movement[],
    windowDays: number = SIMILARITY_WINDOW_DAYS,
  ): { movement: Movement; score: SimilarityScore } | null {
    let best: { movement: Movement; score: SimilarityScore } | null = null;
    for (const mv of existing) {
      const score = SimilarityServiceImpl.score(incoming, mv as ComparableTransaction, windowDays);
      if (score.confidence_match === 0) continue;
      if (!best || score.confidence_match > best.score.confidence_match) {
        best = { movement: mv, score };
      }
    }
    return best;
  }

  /**
   * Pares potencialmente duplicados dentro da base (para "Revisar Duplicidades").
   * Retorna apenas scores na faixa de revisão (>= REVIEW_THRESHOLD).
   * Nunca consolida nada — apenas sinaliza.
   */
  static findPairs(
    movements: Movement[],
    windowDays: number = SIMILARITY_WINDOW_DAYS,
    /** Pares já decididos manualmente como "não são a mesma movimentação". */
    rejectedPairKeys?: Set<string>,
  ): DuplicatePair[] {
    const list = [...movements]
      .filter((m) => !m.deleted_at)
      .sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));
    const pairs: DuplicatePair[] = [];
    const consumed = new Set<UUID>();

    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (consumed.has(a.id)) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (consumed.has(b.id)) continue;
        if (daysBetween(a.transaction_date, b.transaction_date) > windowDays * 4) break;
        // Decisão humana tem prioridade sobre qualquer heurística.
        if (RD.isRejected(rejectedPairKeys, a.id, b.id)) continue;
        const score = SimilarityServiceImpl.score(
          a as ComparableTransaction,
          b as ComparableTransaction,
          windowDays,
        );
        if (score.confidence_match < REVIEW_THRESHOLD) continue;
        // O mais antigo é considerado o original (preserva o histórico).
        pairs.push({ original: a, duplicate: b, score });
        consumed.add(b.id);
      }
    }
    return pairs.sort((x, y) => y.score.confidence_match - x.score.confidence_match);
  }

  /** Carrega os pares de revisão do workspace. */
  async listReviewPairs(workspaceId: UUID): Promise<DuplicatePair[]> {
    const { data, error } = await this.client
      .from("movements")
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("transaction_date", { ascending: true });
    if (error) this.handleError(error, "listReviewPairs");
    const list = ((data ?? []) as unknown as Movement[]).map((m) => ({
      ...m,
      amount: Number(m.amount),
    }));
    const decisions = await this.client
      .from("reconciliation_decisions")
      .select("movement_a_id, movement_b_id, decision, kind")
      .eq("workspace_id", workspaceId);
    if (decisions.error) this.handleError(decisions.error, "listReviewPairs.decisions");
    const rejected = RD.rejectedKeys(
      (decisions.data ?? []) as unknown as Array<{
        movement_a_id: string;
        movement_b_id: string;
        decision: "MATCH" | "REJECT";
        kind?: "MOVEMENT_DUPLICATE" | "TRANSFER_MATCH";
      }>,
      "MOVEMENT_DUPLICATE",
    );
    return SimilarityServiceImpl.findPairs(list, SIMILARITY_WINDOW_DAYS, rejected);
  }

  /**
   * Consolida um par identificado, SEM destruir informação:
   * - preserva categoria, subcategoria, notas, anexos, ativos e conciliações;
   * - atualiza apenas datas consolidadas/processamento e campos ainda vazios;
   * - registra auditoria completa;
   * - a movimentação duplicada é apenas marcada como excluída logicamente,
   *   sempre por ação explícita do usuário.
   */
  async consolidate(params: {
    workspaceId: UUID;
    original: Movement;
    duplicate: Movement;
    confidence: number;
    reason: string;
    performedBy?: UUID | null;
    source?: "USER" | "SYSTEM";
  }): Promise<{ changedFields: string[] }> {
    const { original, duplicate } = params;
    const patch: Record<string, unknown> = {};
    const changed: string[] = [];

    // Data consolidada: mantém a mais antiga (data real da compra).
    if (duplicate.transaction_date < original.transaction_date) {
      patch.transaction_date = duplicate.transaction_date;
      changed.push("transaction_date");
    }
    // Datas complementares apenas quando ausentes no original.
    if (!original.competence_date && duplicate.competence_date) {
      patch.competence_date = duplicate.competence_date;
      changed.push("competence_date");
    }
    if (!original.due_date && duplicate.due_date) {
      patch.due_date = duplicate.due_date;
      changed.push("due_date");
    }
    // O hash de duplicidade do original nunca é sobrescrito.


    if (Object.keys(patch).length) {
      const { error } = await this.client
        .from("movements")
        .update(patch as never)
        .eq("id", original.id);
      if (error) this.handleError(error, "consolidate.updateOriginal");
    }

    const { error: delError } = await this.client
      .from("movements")
      .update({ deleted_at: new Date().toISOString() } as never)
      .eq("id", duplicate.id);
    if (delError) this.handleError(delError, "consolidate.softDeleteDuplicate");

    const { error: auditError } = await this.client.from("dedup_audits").insert({
      workspace_id: params.workspaceId,
      original_movement_id: original.id,
      incoming_movement_id: duplicate.id,
      original_snapshot: original as unknown as Record<string, unknown>,
      incoming_snapshot: duplicate as unknown as Record<string, unknown>,
      confidence_match: params.confidence,
      reason: params.reason,
      changed_fields: changed,
      performed_by: params.performedBy ?? null,
      source: params.source ?? "USER",
    } as never);
    if (auditError) this.handleError(auditError, "consolidate.audit");

    return { changedFields: changed };
  }

  /** Auditoria de deduplicação do workspace (mais recentes primeiro). */
  async listAudits(workspaceId: UUID, limit = 50) {
    const { data, error } = await this.client
      .from("dedup_audits")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) this.handleError(error, "listAudits");
    return (data ?? []) as unknown as Array<{
      id: UUID;
      confidence_match: number;
      reason: string;
      changed_fields: string[];
      created_at: string;
      source: string;
    }>;
  }

  /** Registra auditoria de uma consolidação ocorrida na importação (linha não inserida). */
  async recordImportConsolidation(params: {
    workspaceId: UUID;
    original: Movement;
    incoming: ComparableTransaction;
    confidence: number;
    reason: string;
    changedFields: string[];
    performedBy?: UUID | null;
  }): Promise<void> {
    const { error } = await this.client.from("dedup_audits").insert({
      workspace_id: params.workspaceId,
      original_movement_id: params.original.id,
      incoming_movement_id: null,
      original_snapshot: params.original as unknown as Record<string, unknown>,
      incoming_snapshot: params.incoming as unknown as Record<string, unknown>,
      confidence_match: params.confidence,
      reason: params.reason,
      changed_fields: params.changedFields,
      performed_by: params.performedBy ?? null,
      source: "IMPORT",
    } as never);
    if (error) this.handleError(error, "recordImportConsolidation");
  }
}

export const SimilarityService = new SimilarityServiceImpl();
export { SimilarityServiceImpl };
