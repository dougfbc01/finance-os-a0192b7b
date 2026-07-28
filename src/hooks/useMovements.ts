import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MovementService } from "@/services/MovementService";
import { invalidateFinancialQueries } from "./invalidate";
import type {
  CreateMovementInput,
  UpdateMovementInput,
  MovementFilters,
  UUID,
} from "@/models";

const KEY = "movements";

export function useMovements(workspaceId: UUID | undefined, filters: MovementFilters = {}) {
  return useQuery({
    queryKey: [KEY, workspaceId, filters],
    queryFn: () => MovementService.list(workspaceId as UUID, filters),
    enabled: !!workspaceId,
  });
}

export function useAllMovements(workspaceId: UUID | undefined) {
  return useQuery({
    queryKey: [KEY, workspaceId, "all"],
    queryFn: () => MovementService.list(workspaceId as UUID, {}),
    enabled: !!workspaceId,
  });
}

export function useCreateMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMovementInput) => MovementService.create(input),
    onSuccess: () => invalidateFinancialQueries(qc),
  });
}

export function useUpdateMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: UUID; input: UpdateMovementInput }) =>
      MovementService.update(id, input),
    onSuccess: () => invalidateFinancialQueries(qc),
  });
}

export function useDeleteMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: UUID) => MovementService.softDelete(id),
    onSuccess: () => invalidateFinancialQueries(qc),
  });
}

export function useBulkDeleteMovements() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: UUID[]) => MovementService.bulkSoftDelete(ids),
    onSuccess: () => invalidateFinancialQueries(qc),
  });
}

export function useBulkUpdateMovements() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      ids,
      patch,
    }: {
      ids: UUID[];
      patch: Parameters<typeof MovementService.bulkUpdate>[1];
    }) => MovementService.bulkUpdate(ids, patch),
    onSuccess: () => invalidateFinancialQueries(qc),
  });
}
