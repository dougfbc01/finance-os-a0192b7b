import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImportHistoryService } from "@/services/ImportHistoryService";
import { ImportService, type BuildPreviewParams, type CommitParams } from "@/services/ImportService";
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: UUID) => ImportHistoryService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ["movements"] });
    },
  });
}
