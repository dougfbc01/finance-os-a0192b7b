// ReconciliationService — Conciliação automática de transferências entre contas.
// Regra: mesma valor absoluto, uma entrada e uma saída, contas diferentes,
// diferença máxima de 2 dias. Nunca altera patrimônio.
import { BaseService } from "./BaseService";
import { INCOME_TYPES, EXPENSE_TYPES, MovementType, MovementStatus } from "@/constants/enums";
import type { Movement, UUID } from "@/models";

export interface TransferCandidate {
  outflow: Movement;
  inflow: Movement;
  confidence: "high" | "medium" | "low";
  dayDiff: number;
}

const MAX_DAY_DIFF = 2;

function daysBetween(a: string, b: string): number {
  const d1 = new Date(`${a}T00:00:00`).getTime();
  const d2 = new Date(`${b}T00:00:00`).getTime();
  return Math.abs(Math.round((d1 - d2) / 86400000));
}

class ReconciliationServiceImpl extends BaseService {
  /**
   * Detecta pares de movimentações candidatas a transferência.
   * Considera apenas movimentações não conciliadas (sem transfer_group_id)
   * e que ainda não sejam do tipo TRANSFER.
   */
  static findCandidates(movements: Movement[]): TransferCandidate[] {
    const candidates: TransferCandidate[] = [];
    const usable = movements.filter(
      (m) =>
        !m.deleted_at &&
        !m.transfer_group_id &&
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
          Math.abs(inc.amount - out.amount) < 0.005 &&
          daysBetween(inc.transaction_date, out.transaction_date) <= MAX_DAY_DIFF,
      );
      if (matches.length === 0) continue;
      // Mais próximo em data ganha; empate → único candidato tem confiança alta.
      const best = matches
        .map((m) => ({ m, diff: daysBetween(m.transaction_date, out.transaction_date) }))
        .sort((a, b) => a.diff - b.diff)[0];
      const confidence: TransferCandidate["confidence"] =
        matches.length === 1 && best.diff <= 1
          ? "high"
          : matches.length === 1
            ? "medium"
            : "low";
      candidates.push({ outflow: out, inflow: best.m, confidence, dayDiff: best.diff });
      usedIn.add(best.m.id);
      usedOut.add(out.id);
    }
    return candidates;
  }

  /**
   * Aplica a conciliação: mescla o par em uma TRANSFER lógica.
   * Mantém a movimentação de saída como âncora (account_id = origem),
   * define transfer_account_id, marca status RECONCILED e apaga o par redundante.
   */
  async apply(candidate: TransferCandidate): Promise<void> {
    const groupId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`;
    const now = new Date().toISOString();

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

    const { error: e2 } = await this.client
      .from("movements")
      .update({ deleted_at: now } as never)
      .eq("id", candidate.inflow.id);
    if (e2) this.handleError(e2, "apply.inflow");
  }

  async applyMany(candidates: TransferCandidate[]): Promise<number> {
    let count = 0;
    for (const c of candidates) {
      try {
        await this.apply(c);
        count++;
      } catch {
        // Continua os demais.
      }
    }
    return count;
  }

  /** Conciliação automática das candidatas com alta confiança apenas. */
  async autoReconcile(movements: Movement[]): Promise<number> {
    const candidates = ReconciliationServiceImpl.findCandidates(movements).filter(
      (c) => c.confidence === "high",
    );
    return this.applyMany(candidates);
  }
}

export const ReconciliationService = new ReconciliationServiceImpl();
export { ReconciliationServiceImpl };
