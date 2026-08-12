// RuleIntegrityService — Sprint 4.1.1 / 4.5.1
// Detecta problemas no conjunto de regras de classificação:
// duplicadas, conflitantes, sobrepostas, nunca utilizadas e MUITO AMPLAS.
// Somente leitura/diagnóstico: nunca altera regras automaticamente.
import { TransactionFingerprintService as FP } from "./TransactionFingerprintService";
import { ClassificationRuleServiceImpl } from "./ClassificationRuleService";
import type { RuleContext } from "./ClassificationRuleService";
import type { ClassificationRule, Movement, UUID } from "@/models";

export type RuleIssueType = "DUPLICATE" | "CONFLICT" | "OVERLAP" | "UNUSED" | "BROAD";

export interface RuleIssue {
  id: string;
  type: RuleIssueType;
  level: "INFO" | "WARNING" | "CRITICAL";
  message: string;
  ruleIds: UUID[];
}

/** Detalhe de uma regra excessivamente genérica (Sprint 4.5.1). */
export interface BroadRuleAnalysis {
  ruleId: UUID;
  pattern: string;
  /** Movimentações classificadas por esta regra na amostra analisada. */
  movements: number;
  /** Contrapartes distintas encontradas. */
  counterparties: string[];
  /** Categorias resultantes (ids) — quando o usuário reclassificou manualmente. */
  categories: UUID[];
  /** Exemplos de lançamentos afetados. */
  examples: Array<{ description: string; amount: number; date: string }>;
  recommendation: string;
}

export interface RuleIntegrityReport {
  total: number;
  enabled: number;
  disabled: number;
  withoutCategory: number;
  neverUsed: number;
  issues: RuleIssue[];
  duplicates: RuleIssue[];
  conflicts: RuleIssue[];
  overlaps: RuleIssue[];
  unused: RuleIssue[];
  broad: RuleIssue[];
  broadDetails: BroadRuleAnalysis[];
}

/** Limites usados para classificar uma regra como "muito ampla". */
export const BROAD_RULE_THRESHOLDS = {
  minMovements: 10,
  minCounterparties: 3,
} as const;

class RuleIntegrityServiceImpl {
  /** Assinatura contextual da regra (texto + condições estruturais). */
  private contextKey(rule: ClassificationRule): string {
    const fp = FP.build(rule.text_pattern) || FP.normalize(rule.text_pattern);
    return [
      fp,
      FP.normalize(rule.counterparty_pattern ?? ""),
      rule.movement_type ?? "",
      rule.direction ?? "",
      rule.account_id ?? "",
      rule.card_id ?? "",
    ].join("|");
  }

  analyze(rules: ClassificationRule[], movements: Movement[] = []): RuleIntegrityReport {
    const active = rules.filter((r) => !r.deleted_at);
    const duplicates: RuleIssue[] = [];
    const conflicts: RuleIssue[] = [];
    const overlaps: RuleIssue[] = [];
    const unused: RuleIssue[] = [];

    const byContext = new Map<string, ClassificationRule[]>();
    for (const rule of active) {
      const key = this.contextKey(rule);
      const list = byContext.get(key) ?? [];
      list.push(rule);
      byContext.set(key, list);
    }

    for (const [key, group] of byContext) {
      if (group.length < 2 || !key.replace(/\|/g, "")) continue;
      const label = group[0].counterparty_pattern
        ? `${group[0].text_pattern} + ${group[0].counterparty_pattern}`
        : group[0].text_pattern;
      const categories = new Set(group.map((g) => `${g.category_id}|${g.subcategory_id}`));
      if (categories.size === 1) {
        duplicates.push({
          id: `dup:${key}`,
          type: "DUPLICATE",
          level: "WARNING",
          message: `${group.length} regras idênticas para "${label}".`,
          ruleIds: group.map((g) => g.id),
        });
      } else {
        conflicts.push({
          id: `conf:${key}`,
          type: "CONFLICT",
          level: "CRITICAL",
          message: `${group.length} regras com o mesmo contexto ("${label}") apontam para categorias diferentes.`,
          ruleIds: group.map((g) => g.id),
        });
      }
    }

    // Sobreposição: uma regra genérica engloba outra mais específica.
    for (const a of active) {
      const na = FP.normalize(a.text_pattern);
      if (!na) continue;
      for (const b of active) {
        if (a.id === b.id) continue;
        const nb = FP.normalize(b.text_pattern);
        if (!nb || na === nb) continue;
        if (!nb.includes(na)) continue;
        if (na.length >= nb.length) continue;
        const sameTarget =
          a.category_id === b.category_id && a.subcategory_id === b.subcategory_id;
        if (sameTarget) continue;
        overlaps.push({
          id: `ovl:${a.id}:${b.id}`,
          type: "OVERLAP",
          level: "WARNING",
          message: `A regra genérica "${a.text_pattern}" sobrepõe "${b.text_pattern}" com destino diferente.`,
          ruleIds: [a.id, b.id],
        });
      }
    }

    for (const rule of active) {
      if (rule.match_count > 0 || rule.last_matched_at) continue;
      unused.push({
        id: `unu:${rule.id}`,
        type: "UNUSED",
        level: "INFO",
        message: `A regra "${rule.text_pattern}" nunca foi utilizada.`,
        ruleIds: [rule.id],
      });
    }

    const broadDetails = this.analyzeBreadth(active, movements);
    const broad: RuleIssue[] = broadDetails.map((d) => ({
      id: `broad:${d.ruleId}`,
      type: "BROAD",
      level: "WARNING",
      message: `A regra "${d.pattern}" é muito ampla: ${d.movements} movimentações e ${d.counterparties.length} contrapartes diferentes.`,
      ruleIds: [d.ruleId],
    }));

    return {
      total: active.length,
      enabled: active.filter((r) => r.enabled).length,
      disabled: active.filter((r) => !r.enabled).length,
      withoutCategory: active.filter((r) => !r.category_id).length,
      neverUsed: unused.length,
      duplicates,
      conflicts,
      overlaps,
      unused,
      broad,
      broadDetails,
      issues: [...conflicts, ...duplicates, ...broad, ...overlaps, ...unused],
    };
  }

  /**
   * Sprint 4.5.1 — identifica regras excessivamente genéricas.
   * Uma regra é "muito ampla" quando venceria em muitas movimentações
   * com contrapartes distintas, sem condição de contraparte própria.
   */
  analyzeBreadth(
    rules: ClassificationRule[],
    movements: Movement[],
  ): BroadRuleAnalysis[] {
    if (!movements.length) return [];
    const enabled = rules.filter((r) => r.enabled && !r.deleted_at);
    if (!enabled.length) return [];

    const acc = new Map<
      UUID,
      {
        rule: ClassificationRule;
        movements: number;
        counterparties: Set<string>;
        categories: Set<UUID>;
        examples: BroadRuleAnalysis["examples"];
      }
    >();

    for (const m of movements) {
      const ctx: RuleContext = {
        description: m.description,
        type: m.type,
        amount: m.amount,
        account_id: m.account_id,
        transfer_account_id: m.transfer_account_id,
        card_id: m.card_id,
      };
      const winner = ClassificationRuleServiceImpl.evaluate(ctx, enabled);
      if (!winner) continue;
      const entry =
        acc.get(winner.rule.id) ??
        {
          rule: winner.rule,
          movements: 0,
          counterparties: new Set<string>(),
          categories: new Set<UUID>(),
          examples: [] as BroadRuleAnalysis["examples"],
        };
      entry.movements++;
      const cp = FP.counterparty(m.description).trim();
      if (cp) entry.counterparties.add(cp);
      if (m.category_id) entry.categories.add(m.category_id);
      if (entry.examples.length < 5) {
        entry.examples.push({
          description: m.description,
          amount: Number(m.amount),
          date: m.transaction_date,
        });
      }
      acc.set(winner.rule.id, entry);
    }

    const out: BroadRuleAnalysis[] = [];
    for (const entry of acc.values()) {
      if (entry.rule.counterparty_pattern) continue;
      if (entry.movements < BROAD_RULE_THRESHOLDS.minMovements) continue;
      if (entry.counterparties.size < BROAD_RULE_THRESHOLDS.minCounterparties) continue;
      out.push({
        ruleId: entry.rule.id,
        pattern: entry.rule.text_pattern,
        movements: entry.movements,
        counterparties: [...entry.counterparties].sort(),
        categories: [...entry.categories],
        examples: entry.examples,
        recommendation: "Torne esta regra mais específica (informe a contraparte).",
      });
    }
    return out.sort((a, b) => b.movements - a.movements);
  }

  /** Atalho para o simulador (mantém a lógica no motor de regras). */
  simulate(input: RuleContext | string, rules: ClassificationRule[]) {
    return ClassificationRuleServiceImpl.simulate(input, rules);
  }
}

export const RuleIntegrityService = new RuleIntegrityServiceImpl();
export { RuleIntegrityServiceImpl };
