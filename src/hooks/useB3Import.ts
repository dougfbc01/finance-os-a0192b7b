import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { buildB3PreviewFn, commitB3ImportFn } from "@/lib/b3Import.functions";

export function useBuildB3Preview() {
  const buildPreview = useServerFn(buildB3PreviewFn);
  return useMutation({
    mutationFn: (input: { workspaceId: string; fileName: string; fileBase64: string }) =>
      buildPreview({ data: input }),
  });
}

export function useCommitB3Import() {
  const commitImport = useServerFn(commitB3ImportFn);
  return useMutation({
    mutationFn: (input: { workspaceId: string; fileName: string; fileBase64: string; selectedIndexes: number[] }) =>
      commitImport({ data: input }),
  });
}