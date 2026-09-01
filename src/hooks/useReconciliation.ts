import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ReconciliationService,
  type TransferCandidate,
} from "@/services/ReconciliationService";
import { useWorkspace } from "./useWorkspace";
import { invalidateFinancialQueries } from "./invalidate";

const KEY = "transfer-candidates";

export function useTransferCandidates() {
  const { data: ws } = useWorkspace();
  const wsId = ws?.id as string | undefined;
  const { data: candidates = [], isLoading } = useQuery({
    queryKey: [KEY, wsId],
    queryFn: () => ReconciliationService.listCandidates(wsId as string),
    enabled: !!wsId,
  });
  return { candidates, isLoading, workspaceId: wsId };
}

const invalidate = invalidateFinancialQueries;

function useInvalidateCandidates() {
  const qc = useQueryClient();
  return () => {
    invalidate(qc);
    qc.invalidateQueries({ queryKey: [KEY] });
  };
}

export function useApplyReconciliation() {
  const refresh = useInvalidateCandidates();
  return useMutation({
    mutationFn: (candidate: TransferCandidate) => ReconciliationService.apply(candidate),
    onSuccess: refresh,
  });
}

export function useApplyReconciliations() {
  const refresh = useInvalidateCandidates();
  return useMutation({
    mutationFn: (candidates: TransferCandidate[]) =>
      ReconciliationService.applyMany(candidates),
    onSuccess: refresh,
  });
}

/** "Não são relacionadas" — decisão manual persistente. */
export function useRejectTransferCandidate() {
  const refresh = useInvalidateCandidates();
  return useMutation({
    mutationFn: (candidate: TransferCandidate) => ReconciliationService.reject(candidate),
    onSuccess: refresh,
  });
}
