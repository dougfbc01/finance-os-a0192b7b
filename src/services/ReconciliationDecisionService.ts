// ReconciliationDecisionService — Sprint 4.13B
// Fundação de decisões humanas persistentes sobre pares de movimentações.
// Regra: a decisão manual tem prioridade sobre qualquer heurística. Um par
// marcado como REJECT nunca volta a ser sugerido pelo motor de conciliação.
import { BaseService } from "./BaseService";
import type { UUID } from "@/models";

export type ReconciliationDecisionKind = "MATCH" | "REJECT";

export interface ReconciliationDecision {
  id: UUID;
  workspace_id: UUID;
  movement_a_id: UUID;
  movement_b_id: UUID;
  decision: ReconciliationDecisionKind;
  source: string;
  notes: string | null;
  created_at: string;
}

class ReconciliationDecisionServiceImpl extends BaseService {
  /** Chave canônica do par (independe da ordem das movimentações). */
  static pairKey(a: UUID, b: UUID): string {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  /** Conjunto de pares rejeitados manualmente (pronto para o motor consumir). */
  static rejectedKeys(decisions: Pick<ReconciliationDecision, "movement_a_id" | "movement_b_id" | "decision">[]): Set<string> {
    const set = new Set<string>();
    for (const d of decisions) {
      if (d.decision !== "REJECT") continue;
      set.add(ReconciliationDecisionServiceImpl.pairKey(d.movement_a_id, d.movement_b_id));
    }
    return set;
  }

  static isRejected(keys: Set<string> | undefined, a: UUID, b: UUID): boolean {
    if (!keys || keys.size === 0) return false;
    return keys.has(ReconciliationDecisionServiceImpl.pairKey(a, b));
  }

  async list(workspaceId: UUID): Promise<ReconciliationDecision[]> {
    const { data, error } = await this.client
      .from("reconciliation_decisions")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    if (error) this.handleError(error, "list");
    return (data ?? []) as unknown as ReconciliationDecision[];
  }

  /** Registra (ou reafirma) a decisão manual "não são a mesma movimentação". */
  async reject(params: {
    workspaceId: UUID;
    movementAId: UUID;
    movementBId: UUID;
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
      decision: "REJECT",
      source: "MANUAL",
      notes: params.notes ?? null,
    } as never);
    // Par já decidido antes: a decisão continua válida, não é erro.
    if (error && !`${error.message}`.includes("duplicate key")) {
      this.handleError(error, "reject");
    }
  }

  /** Desfaz a decisão manual de um par (volta a ser analisado pelo motor). */
  async clear(workspaceId: UUID, a: UUID, b: UUID): Promise<void> {
    const { error } = await this.client
      .from("reconciliation_decisions")
      .delete()
      .eq("workspace_id", workspaceId)
      .in("movement_a_id", [a, b])
      .in("movement_b_id", [a, b]);
    if (error) this.handleError(error, "clear");
  }
}

export const ReconciliationDecisionService = new ReconciliationDecisionServiceImpl();
export { ReconciliationDecisionServiceImpl };
