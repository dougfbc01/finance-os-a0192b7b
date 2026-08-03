// Hooks do painel de regras inteligentes (integridade + simulador).
// Toda a lógica vive em RuleIntegrityService / ClassificationRuleService.
import { useMemo } from "react";
import { RuleIntegrityService } from "@/services/RuleIntegrityService";
import type { RuleIntegrityReport } from "@/services/RuleIntegrityService";
import type { RuleSimulation } from "@/services/ClassificationRuleService";
import type { ClassificationRule } from "@/models";

export function useRuleIntegrity(rules: ClassificationRule[]): RuleIntegrityReport {
  return useMemo(() => RuleIntegrityService.analyze(rules), [rules]);
}

export function useRuleSimulation(
  description: string,
  rules: ClassificationRule[],
): RuleSimulation | null {
  return useMemo(() => {
    if (!description.trim()) return null;
    return RuleIntegrityService.simulate(description, rules);
  }, [description, rules]);
}
