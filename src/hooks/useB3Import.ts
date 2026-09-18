import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { buildB3PreviewFn } from "@/lib/b3Import.functions";

export function useBuildB3Preview() {
  const buildPreview = useServerFn(buildB3PreviewFn);
  return useMutation({
    mutationFn: (input: { workspaceId: string; fileName: string; fileBase64: string }) =>
      buildPreview({ data: input }),
  });
}