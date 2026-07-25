import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CardService } from "@/services/CardService";
import type { CreateCardInput, UpdateCardInput, UUID } from "@/models";

const KEY = "cards";

export function useCards(workspaceId: UUID | undefined) {
  return useQuery({
    queryKey: [KEY, workspaceId],
    queryFn: () => CardService.list(workspaceId as UUID),
    enabled: !!workspaceId,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: [KEY] });
  qc.invalidateQueries({ queryKey: ["card_invoices"] });
  qc.invalidateQueries({ queryKey: ["dashboard"] });
}

export function useCreateCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCardInput) => CardService.create(input),
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: UUID; input: UpdateCardInput }) =>
      CardService.update(id, input),
    onSuccess: () => invalidate(qc),
  });
}

export function useToggleCardActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: UUID; isActive: boolean }) =>
      CardService.setActive(id, isActive),
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: UUID) => CardService.softDelete(id),
    onSuccess: () => invalidate(qc),
  });
}
