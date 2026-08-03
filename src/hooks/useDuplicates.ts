// Hooks de deduplicação inteligente. Nenhuma regra aqui — apenas orquestração.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SimilarityService, type DuplicatePair } from "@/services/SimilarityService";
import { invalidateFinancialQueries } from "./invalidate";
import type { Movement, UUID } from "@/models";

const KEY = "duplicates";

export function useDuplicatePairs(workspaceId: UUID | undefined) {
  return useQuery({
    queryKey: [KEY, workspaceId],
    queryFn: () => SimilarityService.listReviewPairs(workspaceId as UUID),
    enabled: !!workspaceId,
  });
}

export function useDedupAudits(workspaceId: UUID | undefined) {
  return useQuery({
    queryKey: [KEY, "audits", workspaceId],
    queryFn: () => SimilarityService.listAudits(workspaceId as UUID),
    enabled: !!workspaceId,
  });
}

export function useConsolidateDuplicate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      workspaceId: UUID;
      original: Movement;
      duplicate: Movement;
      confidence: number;
      reason: string;
      performedBy?: UUID | null;
    }) => SimilarityService.consolidate({ ...params, source: "USER" }),
    onSuccess: (_r, vars) => {
      invalidateFinancialQueries(qc);
      qc.invalidateQueries({ queryKey: [KEY, vars.workspaceId] });
      qc.invalidateQueries({ queryKey: [KEY] });
    },
  });
}

export type { DuplicatePair };
