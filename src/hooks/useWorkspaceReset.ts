import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { WorkspaceResetService, type WorkspaceResetMode } from "@/services/WorkspaceResetService";

export function useWorkspaceResetPreview(workspaceId: string | undefined, mode: WorkspaceResetMode, enabled: boolean) {
  return useQuery({
    queryKey: ["workspace-reset-preview", workspaceId, mode],
    queryFn: () => WorkspaceResetService.preview(workspaceId!, mode),
    enabled: enabled && !!workspaceId,
    staleTime: 0,
  });
}

export function useWorkspaceReset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, mode }: { workspaceId: string; mode: WorkspaceResetMode }) =>
      WorkspaceResetService.execute(workspaceId, mode, mode === "ALL"),
    onSuccess: async () => {
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "workspace" });
      await qc.invalidateQueries();
    },
  });
}
