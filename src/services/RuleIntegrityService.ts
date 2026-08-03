// RuleIntegrityService — Sprint 4.1.1
// Detecta problemas no conjunto de regras de classificação:
// duplicadas, conflitantes, sobrepostas e nunca utilizadas.
// Somente leitura/diagnóstico: nunca altera regras automaticamente.
import { TransactionFingerprintService as FP } from "./TransactionFingerprintService";
import { ClassificationRuleServiceImpl } from "./ClassificationRuleService";
import type { ClassificationRule, UUID } from "@/models";

export type RuleIssueType = "DUPLICATE" | "CONFLICT" | "OVERLAP" | "UNUSED";

export interface RuleIssue {
  id: string;
  type: RuleIssueType;
  level: "INFO" | "WARNING" | "CRITICAL";
  message: string;
  ruleIds: UUID[];
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
}

class RuleIntegrityServiceImpl {
  analyze(rules: ClassificationRule[]): RuleIntegrityReport {
    const active = rules.filter((r) => !r.deleted_at);
    const duplicates: RuleIssue[] = [];
    const conflicts: RuleIssue[] = [];
    const overlaps: RuleIssue[] = [];
    const unused: RuleIssue[] = [];

    const byFingerprint = new Map<string, ClassificationRule[]>();
    for (const rule of active) {
      const fp = FP.build(rule.text_pattern) || FP.normalize(rule.text_pattern);
      const list = byFingerprint.get(fp) ?? [];
      list.push(rule);
      byFingerprint.set(fp, list);
    }

    for (const [fp, group] of byFingerprint) {
      if (group.length < 2 || !fp) continue;
      const categories = new Set(group.map((g) => `${g.category_id}|${g.subcategory_id}`));
      if (categories.size === 1) {
        duplicates.push({
          id: `dup:${fp}`,
          type: "DUPLICATE",
          level: "WARNING",
          message: `${group.length} regras idênticas para "${fp}".`,
          ruleIds: group.map((g) => g.id),
        });
      } else {
        conflicts.push({
          id: `conf:${fp}`,
          type: "CONFLICT",
          level: "CRITICAL",
          message: `${group.length} regras conflitantes para "${fp}" apontam para categorias diferentes.`,
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
      issues: [...conflicts, ...duplicates, ...overlaps, ...unused],
    };
  }

  /** Atalho para o simulador (mantém a lógica no motor de regras). */
  simulate(description: string, rules: ClassificationRule[]) {
    return ClassificationRuleServiceImpl.simulate(description, rules);
  }
}

export const RuleIntegrityService = new RuleIntegrityServiceImpl();
export { RuleIntegrityServiceImpl };
