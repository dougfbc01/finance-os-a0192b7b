import { useServerFn } from "@tanstack/react-start";
import { reviewBackupFn, askBackupQuestionFn } from "@/lib/backupReview.functions";
import { WorkspaceBackupAnalysisService } from "@/services/WorkspaceBackupAnalysisService";
import { WorkspaceResetService } from "@/services/WorkspaceResetService";
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

/** Comparação atual × backup e problemas do arquivo, sem IA. */
export function useBackupLocalReview() {
  return useMutation({
    mutationFn: async ({ workspaceId, backup }: { workspaceId: string; backup: WorkspaceBackup }) => {
      const base = WorkspaceBackupAnalysisService.profile(backup, workspaceId);
      const current = await WorkspaceResetService.preview(workspaceId, "ALL");
      return { ...base, comparison: WorkspaceBackupAnalysisService.compare(base, current) };
    },
  });
}

export function useBackupReview() {
  const review = useServerFn(reviewBackupFn);
  return useMutation({
    mutationFn: async ({ workspaceId, backup }: { workspaceId: string; backup: WorkspaceBackup }) => {
      const base = WorkspaceBackupAnalysisService.profile(backup, workspaceId);
      const current = await WorkspaceResetService.preview(workspaceId, "ALL");
      const profile = { ...base, comparison: WorkspaceBackupAnalysisService.compare(base, current) };
      const res = await review({ data: { workspaceId, profile } });
      return { profile, ...res };
    },
  });
}

type BackupProfileWithComparison = ReturnType<typeof WorkspaceBackupAnalysisService.profile> & {
  comparison: ReturnType<typeof WorkspaceBackupAnalysisService.compare>;
};

export function useBackupQuestion() {
  const ask = useServerFn(askBackupQuestionFn);
  return useMutation({
    mutationFn: (args: { workspaceId: string; profile: BackupProfileWithComparison; question: string; history: { q: string; a: string }[] }) =>
      ask({ data: { ...args, history: args.history.slice(-6) } }),
  });
}
