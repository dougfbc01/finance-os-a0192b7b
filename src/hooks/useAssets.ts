import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AssetService } from "@/services/AssetService";
import type { CreateAssetInput, UpdateAssetInput, UUID } from "@/models";

const KEY = "assets";

export function useAssets(workspaceId: UUID | undefined) {
  return useQuery({
    queryKey: [KEY, workspaceId],
    queryFn: () => AssetService.list(workspaceId as UUID),
    enabled: !!workspaceId,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: [KEY] });
  qc.invalidateQueries({ queryKey: ["patrimony"] });
  qc.invalidateQueries({ queryKey: ["dashboard"] });
}

export function useCreateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAssetInput) => AssetService.create(input),
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: UUID; input: UpdateAssetInput }) =>
      AssetService.update(id, input),
    onSuccess: () => invalidate(qc),
  });
}

export function useToggleAssetActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: UUID; isActive: boolean }) =>
      AssetService.setActive(id, isActive),
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: UUID) => AssetService.softDelete(id),
    onSuccess: () => invalidate(qc),
  });
}
