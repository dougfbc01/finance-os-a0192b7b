import { useMemo } from "react";
import { useWorkspace } from "./useWorkspace";
import { useAllMovements } from "./useMovements";
import { useClassificationRules } from "./useClassificationRules";
import { useImportRecord } from "./useImports";
import { ImportReviewServiceImpl } from "@/services/ImportReviewService";
import type { UUID } from "@/models";

/**
 * Sprint 4.5.2 — dados da tela "Revisão da Importação".
 * Mostra somente os lançamentos efetivamente persistidos por aquela importação.
 */
export function useImportReview(importId: UUID | undefined) {
  const { data: ws } = useWorkspace();
  const wsId = ws?.id as string | undefined;
  const movementsQ = useAllMovements(wsId);
  const rulesQ = useClassificationRules(wsId);
  const recordQ = useImportRecord(importId);

  const movements = movementsQ.data ?? [];
  const rules = rulesQ.data ?? [];

  const rows = useMemo(
    () => (importId ? ImportReviewServiceImpl.buildRows(movements, importId, rules) : []),
    [movements, importId, rules],
  );
  const summary = useMemo(() => ImportReviewServiceImpl.summarize(rows), [rows]);

  return {
    workspaceId: wsId,
    importRecord: recordQ.data ?? null,
    rows,
    summary,
    isLoading: movementsQ.isLoading || rulesQ.isLoading || recordQ.isLoading,
  };
}
