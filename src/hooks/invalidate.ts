// Helper central de invalidação de cache do React Query.
// Sprint 3.1 - Parte 7: qualquer mutação relevante deve invalidar TODAS as
// consultas que dependem do estado financeiro, mantendo a UI sempre coerente
// sem exigir reload manual.
import type { useQueryClient } from "@tanstack/react-query";

const FINANCIAL_KEYS = [
  "movements",
  "accounts",
  "dashboard",
  "patrimony",
  "cards",
  "card_invoices",
  "assets",
  "imports",
  "classification-rules",
] as const;

export function invalidateFinancialQueries(qc: ReturnType<typeof useQueryClient>) {
  for (const key of FINANCIAL_KEYS) {
    qc.invalidateQueries({ queryKey: [key] });
  }
}
