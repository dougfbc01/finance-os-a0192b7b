import { useMutation, useQueryClient } from "@tanstack/react-query";
import { WorkspaceBackupService, WorkspaceBackupServiceImpl, type WorkspaceBackup } from "@/services/WorkspaceBackupService";

export function useWorkspaceBackup() {
  return useMutation({
    mutationFn: async ({ workspaceId, workspaceName }: { workspaceId: string; workspaceName?: string | null }) => {
      const backup = await WorkspaceBackupService.export(workspaceId);
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = WorkspaceBackupServiceImpl.fileName(workspaceName);
      a.click();
      URL.revokeObjectURL(url);
      return backup;
    },
  });
}

export function useWorkspaceRestore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, backup }: { workspaceId: string; backup: WorkspaceBackup }) =>
      WorkspaceBackupService.restore(workspaceId, backup),
    onSuccess: async () => {
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "workspace" });
      await qc.invalidateQueries();
    },
  });
}

export function useBackupReview() {
  const review = useServerFn(reviewBackupFn);
  return useMutation({
    mutationFn: async ({ workspaceId, backup }: { workspaceId: string; backup: WorkspaceBackup }) => {
      const profile = WorkspaceBackupAnalysisService.profile(backup, workspaceId);
      const res = await review({ data: { workspaceId, profile } });
      return { profile, ...res };
    },
  });
}
