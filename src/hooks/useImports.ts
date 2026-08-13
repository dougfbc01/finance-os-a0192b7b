import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImportHistoryService } from "@/services/ImportHistoryService";
import { ImportService, type BuildPreviewParams, type CommitParams } from "@/services/ImportService";
import { invalidateFinancialQueries } from "./invalidate";
import type { UUID } from "@/models";

const KEY = "imports";

export function useImports(workspaceId: UUID | undefined) {
  return useQuery({
    queryKey: [KEY, workspaceId],
    queryFn: () => ImportHistoryService.list(workspaceId as UUID),
    enabled: !!workspaceId,
  });
}

export function useBuildImportPreview() {
  return useMutation({
    mutationFn: (params: BuildPreviewParams) => ImportService.buildPreview(params),
  });
}

export function useCommitImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: CommitParams) => ImportService.commit(params),
    onSuccess: () => invalidateFinancialQueries(qc),
  });
}

export function useImportRecord(importId: UUID | undefined) {
  return useQuery({
    queryKey: [KEY, "record", importId],
    queryFn: () => ImportHistoryService.getById(importId as UUID),
    enabled: !!importId,
  });
}

export function useSetImportReviewed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      reviewed,
      userId,
    }: {
      id: UUID;
      reviewed: boolean;
      userId?: UUID | null;
    }) => ImportHistoryService.setReviewed(id, reviewed, userId ?? null),
    onSuccess: () => invalidateFinancialQueries(qc),
  });
}

export function useDeleteImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: UUID) => ImportHistoryService.delete(id),
    onSuccess: () => invalidateFinancialQueries(qc),
  });
}
