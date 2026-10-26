import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { B3QuoteHistoryImportService, type QuoteImportPreview, type QuoteImportTarget } from "@/services/B3QuoteHistoryImportService";

export function useB3QuoteHistoryImport(workspaceId: string | undefined, targets: QuoteImportTarget[]) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<{ file: string; lines: number } | null>(null);
  const preview = useMutation({
    mutationFn: async (files: File[]): Promise<QuoteImportPreview> => {
      if (!workspaceId) throw new Error("Workspace indisponível");
      setProgress(null);
      return B3QuoteHistoryImportService.readFiles(workspaceId, files, targets, setProgress);
    },
  });
  const commit = useMutation({
    mutationFn: async () => {
      if (!workspaceId || !preview.data) throw new Error("Nada para importar");
      return B3QuoteHistoryImportService.commit(workspaceId, preview.data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["investment-analysis-prices", workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ["market-price-history"] });
    },
  });
  const reset = () => { preview.reset(); commit.reset(); setProgress(null); };
  return { progress, preview, commit, reset };
}
