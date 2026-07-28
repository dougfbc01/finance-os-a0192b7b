import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ReconciliationService,
  ReconciliationServiceImpl,
  type TransferCandidate,
} from "@/services/ReconciliationService";
import { useAllMovements } from "./useMovements";
import { useWorkspace } from "./useWorkspace";
import { invalidateFinancialQueries } from "./invalidate";

export function useTransferCandidates() {
  const { data: ws } = useWorkspace();
  const wsId = ws?.id as string | undefined;
  const { data: movements = [], isLoading } = useAllMovements(wsId);
  const candidates = useMemo(
    () => ReconciliationServiceImpl.findCandidates(movements),
    [movements],
  );
  return { candidates, isLoading, workspaceId: wsId };
}

const invalidate = invalidateFinancialQueries;


export function useApplyReconciliation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (candidate: TransferCandidate) => ReconciliationService.apply(candidate),
    onSuccess: () => invalidate(qc),
  });
}

export function useApplyReconciliations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (candidates: TransferCandidate[]) =>
      ReconciliationService.applyMany(candidates),
    onSuccess: () => invalidate(qc),
  });
}
