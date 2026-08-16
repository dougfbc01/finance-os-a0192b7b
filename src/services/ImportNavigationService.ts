// ImportNavigationService — Sprint 4.5.2 (correção)
// Regras puras do fluxo pós-importação: quando existe revisão a fazer e qual
// rota abrir. Isolado para ser testável sem router/UI.
import type { CommitResult } from "./ImportService";
import type { UUID } from "@/models";

export const IMPORT_REVIEW_ROUTE = "/importacoes/revisao/$importId" as const;

/** Só há revisão quando a importação criou lançamentos novos de fato. */
export function hasNewMovements(result: Pick<CommitResult, "inserted"> | null): boolean {
  return !!result && result.inserted > 0;
}

/** ID da importação recém-processada, usado na navegação. */
export function reviewImportId(result: CommitResult | null): UUID | null {
  return result?.importRecord?.id ?? null;
}

/** URL final da revisão (usada apenas por testes/logs; a UI usa params). */
export function buildReviewPath(importId: UUID): string {
  return `/importacoes/revisao/${importId}`;
}
