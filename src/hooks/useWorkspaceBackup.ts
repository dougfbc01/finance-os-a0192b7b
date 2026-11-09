import { useMutation } from "@tanstack/react-query";
import { WorkspaceBackupService, WorkspaceBackupServiceImpl } from "@/services/WorkspaceBackupService";

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
