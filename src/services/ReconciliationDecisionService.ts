// ReconciliationDecisionService — Sprint 4.13B / evoluído na Sprint 4.14
// Fundação de decisões humanas persistentes sobre pares de movimentações.
// Regra: a decisão manual tem prioridade sobre qualquer heurística. Um par
// marcado como REJECT nunca volta a ser sugerido pelo motor de conciliação e
// um par marcado como MATCH nunca volta a ser sugerido como pendência.
//
// Dois domínios convivem na mesma estrutura, distinguidos por `kind`:
//  - MOVEMENT_DUPLICATE → mesmo lançamento importado duas vezes;
//  - TRANSFER_MATCH     → dois lançamentos legítimos, em contas diferentes,
//                         representando uma única transferência própria.
import { BaseService } from "./BaseService";
import type { UUID } from "@/models";

export type ReconciliationDecisionKind = "MATCH" | "REJECT";
export type ReconciliationDecisionDomain = "MOVEMENT_DUPLICATE" | "TRANSFER_MATCH";

export interface ReconciliationDecision {
  id: UUID;
  workspace_id: UUID;
  movement_a_id: UUID;
  movement_b_id: UUID;
  decision: ReconciliationDecisionKind;
  kind: ReconciliationDecisionDomain;
  source: string;
  notes: string | null;
  created_at: string;
}

type DecisionLike = {
  movement_a_id: UUID;
  movement_b_id: UUID;
  decision: ReconciliationDecisionKind;
  kind?: ReconciliationDecisionDomain;
};

class ReconciliationDecisionServiceImpl extends BaseService {
  /** Chave canônica do par (independe da ordem das movimentações). */
  static pairKey(a: UUID, b: UUID): string {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  private static keysFor(
    decisions: DecisionLike[],
    decision: ReconciliationDecisionKind,
    domain: ReconciliationDecisionDomain,
  ): Set<string> {
    const set = new Set<string>();
    for (const d of decisions) {
      if (d.decision !== decision) continue;
      if ((d.kind ?? "MOVEMENT_DUPLICATE") !== domain) continue;
      set.add(ReconciliationDecisionServiceImpl.pairKey(d.movement_a_id, d.movement_b_id));
    }
    return set;
  }

  /** Pares rejeitados manualmente (por domínio; padrão: duplicidade). */
  static rejectedKeys(
    decisions: DecisionLike[],
    domain: ReconciliationDecisionDomain = "MOVEMENT_DUPLICATE",
  ): Set<string> {
    return ReconciliationDecisionServiceImpl.keysFor(decisions, "REJECT", domain);
  }

  /** Pares confirmados manualmente (por domínio). */
  static matchedKeys(
    decisions: DecisionLike[],
    domain: ReconciliationDecisionDomain = "TRANSFER_MATCH",
  ): Set<string> {
    return ReconciliationDecisionServiceImpl.keysFor(decisions, "MATCH", domain);
  }

  static isRejected(keys: Set<string> | undefined, a: UUID, b: UUID): boolean {
    if (!keys || keys.size === 0) return false;
    return keys.has(ReconciliationDecisionServiceImpl.pairKey(a, b));
  }

  /** Alias semântico: mesma verificação de pertencimento por par. */
  static hasPair(keys: Set<string> | undefined, a: UUID, b: UUID): boolean {
    return ReconciliationDecisionServiceImpl.isRejected(keys, a, b);
  }

  async list(workspaceId: UUID, kind?: ReconciliationDecisionDomain): Promise<ReconciliationDecision[]> {
    let q = this.client
      .from("reconciliation_decisions")
      .select("*")
      .eq("workspace_id", workspaceId);
    if (kind) q = q.eq("kind", kind);
    const { data, error } = await q.order("created_at", { ascending: false });
    if (error) this.handleError(error, "list");
    return (data ?? []) as unknown as ReconciliationDecision[];
  }

  /** Registra (ou reafirma) uma decisão manual sobre um par. */
  async record(params: {
    workspaceId: UUID;
    movementAId: UUID;
    movementBId: UUID;
    decision: ReconciliationDecisionKind;
    kind?: ReconciliationDecisionDomain;
    notes?: string | null;
  }): Promise<void> {
    const [a, b] =
      params.movementAId < params.movementBId
        ? [params.movementAId, params.movementBId]
        : [params.movementBId, params.movementAId];
    const { error } = await this.client.from("reconciliation_decisions").insert({
      workspace_id: params.workspaceId,
      movement_a_id: a,
      movement_b_id: b,
      decision: params.decision,
      kind: params.kind ?? "MOVEMENT_DUPLICATE",
      source: "MANUAL",
      notes: params.notes ?? null,
    } as never);
    // Par já decidido antes: a decisão continua válida, não é erro.
    if (error && !`${error.message}`.includes("duplicate key")) {
      this.handleError(error, "record");
    }
  }

  /** Registra (ou reafirma) a decisão manual "não são a mesma movimentação". */
  async reject(params: {
    workspaceId: UUID;
    movementAId: UUID;
    movementBId: UUID;
    kind?: ReconciliationDecisionDomain;
    notes?: string | null;
  }): Promise<void> {
    return this.record({ ...params, decision: "REJECT" });
  }

  /** "Não são a mesma transferência" — o par nunca mais é sugerido. */
  async rejectTransfer(params: {
    workspaceId: UUID;
    movementAId: UUID;
    movementBId: UUID;
    notes?: string | null;
  }): Promise<void> {
    return this.record({ ...params, decision: "REJECT", kind: "TRANSFER_MATCH" });
  }

  /** "São a mesma transferência" — relação persistente entre os dois lados. */
  async confirmTransfer(params: {
    workspaceId: UUID;
    movementAId: UUID;
    movementBId: UUID;
    notes?: string | null;
  }): Promise<void> {
    return this.record({ ...params, decision: "MATCH", kind: "TRANSFER_MATCH" });
  }

  /** Desfaz a decisão manual de um par (volta a ser analisado pelo motor). */
  async clear(workspaceId: UUID, a: UUID, b: UUID, kind?: ReconciliationDecisionDomain): Promise<void> {
    let q = this.client
      .from("reconciliation_decisions")
      .delete()
      .eq("workspace_id", workspaceId)
      .in("movement_a_id", [a, b])
      .in("movement_b_id", [a, b]);
    if (kind) q = q.eq("kind", kind);
    const { error } = await q;
    if (error) this.handleError(error, "clear");
  }
}

export const ReconciliationDecisionService = new ReconciliationDecisionServiceImpl();
export { ReconciliationDecisionServiceImpl };
