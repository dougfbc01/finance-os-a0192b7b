import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClassificationRuleService } from "@/services/ClassificationRuleService";
import { invalidateFinancialQueries } from "./invalidate";
import type {
  ClassificationRule,
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
    onSuccess: () => invalidateFinancialQueries(qc),
  });
}

export function useUpdateClassificationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: UUID; input: UpdateClassificationRuleInput }) =>
      ClassificationRuleService.update(id, input),
    onSuccess: () => invalidateFinancialQueries(qc),
  });
}

export function useDeleteClassificationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: UUID) => ClassificationRuleService.softDelete(id),
    onSuccess: () => invalidateFinancialQueries(qc),
  });
}

/**
 * Memoriza uma classificação. Retorna também a lista de movimentações
 * não classificadas compatíveis, para permitir aplicação em massa via UI.
 */
export function useRememberClassification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      workspaceId: UUID;
      description: string;
      categoryId: UUID | null;
      subcategoryId: UUID | null;
    }): Promise<{ rule: ClassificationRule | null; matchIds: UUID[] }> => {
      const rule = await ClassificationRuleService.rememberFromMovement(params);
      const matchIds = rule
        ? await ClassificationRuleService.findUnclassifiedMatches(
            params.workspaceId,
            rule.text_pattern,
          )
        : [];
      return { rule, matchIds };
    },
    onSuccess: () => invalidateFinancialQueries(qc),
  });
}

export function useBulkClassify() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      ids: UUID[];
      categoryId: UUID | null;
      subcategoryId: UUID | null;
    }) =>
      ClassificationRuleService.bulkClassify(params.ids, {
        category_id: params.categoryId,
        subcategory_id: params.subcategoryId,
      }),
    onSuccess: () => invalidateFinancialQueries(qc),
  });
}

/** Simulação (dry run) do reprocessamento — não grava nada. */
export function useDryRunReprocess() {
  return useMutation({
    mutationFn: (workspaceId: UUID) => ClassificationRuleService.dryRunReprocess(workspaceId),
  });
}

export function useReprocessRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (workspaceId: UUID) => ClassificationRuleService.reprocessAll(workspaceId),
    onSuccess: () => invalidateFinancialQueries(qc),
  });
}
