// Hooks do painel de regras inteligentes (integridade + simulador).
// Toda a lógica vive em RuleIntegrityService / ClassificationRuleService.
import { useMemo } from "react";
import { RuleIntegrityService } from "@/services/RuleIntegrityService";
import type { RuleIntegrityReport } from "@/services/RuleIntegrityService";
import type { RuleContext, RuleSimulation } from "@/services/ClassificationRuleService";
import type { ClassificationRule, Movement } from "@/models";

export function useRuleIntegrity(
  rules: ClassificationRule[],
  movements: Movement[] = [],
): RuleIntegrityReport {
  return useMemo(() => RuleIntegrityService.analyze(rules, movements), [rules, movements]);
}

export function useRuleSimulation(
  input: RuleContext | string,
  rules: ClassificationRule[],
): RuleSimulation | null {
  return useMemo(() => {
    const description = typeof input === "string" ? input : input.description;
    if (!description.trim()) return null;
    return RuleIntegrityService.simulate(input, rules);
  }, [input, rules]);
}
