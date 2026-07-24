import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClassificationRuleService } from "@/services/ClassificationRuleService";
import type {
  CreateClassificationRuleInput,
  UpdateClassificationRuleInput,
  UUID,
} from "@/models";

const KEY = "classification-rules";

export function useClassificationRules(workspaceId: UUID | undefined) {
  return useQuery({
    queryKey: [KEY, workspaceId],
    queryFn: () => ClassificationRuleService.list(workspaceId as UUID),
    enabled: !!workspaceId,
  });
}

export function useCreateClassificationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateClassificationRuleInput) => ClassificationRuleService.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateClassificationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: UUID; input: UpdateClassificationRuleInput }) =>
      ClassificationRuleService.update(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteClassificationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: UUID) => ClassificationRuleService.softDelete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useRememberClassification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      workspaceId: UUID;
      description: string;
      categoryId: UUID | null;
      subcategoryId: UUID | null;
    }) => ClassificationRuleService.rememberFromMovement(params),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
