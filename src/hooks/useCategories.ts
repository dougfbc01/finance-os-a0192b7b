import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CategoryService } from "@/services/CategoryService";
import { SubcategoryService } from "@/services/SubcategoryService";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateSubcategoryInput,
  UpdateSubcategoryInput,
  UUID,
} from "@/models";

const CAT_KEY = "categories";
const SUB_KEY = "subcategories";

export function useCategories(workspaceId: UUID | undefined) {
  return useQuery({
    queryKey: [CAT_KEY, workspaceId],
    queryFn: () => CategoryService.getAll(workspaceId as UUID),
    enabled: !!workspaceId,
  });
}

export function useSubcategories(workspaceId: UUID | undefined) {
  return useQuery({
    queryKey: [SUB_KEY, workspaceId],
    queryFn: () => SubcategoryService.getAll(workspaceId as UUID),
    enabled: !!workspaceId,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCategoryInput) => CategoryService.create(input),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: [CAT_KEY, vars.workspace_id] });
    },
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: UUID; input: UpdateCategoryInput }) =>
      CategoryService.update(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: [CAT_KEY] }),
  });
}

export function useToggleCategoryActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: UUID; isActive: boolean }) =>
      CategoryService.setActive(id, isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: [CAT_KEY] }),
  });
}

export function useCreateSubcategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSubcategoryInput) => SubcategoryService.create(input),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: [SUB_KEY, vars.workspace_id] });
    },
  });
}

export function useUpdateSubcategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: UUID; input: UpdateSubcategoryInput }) =>
      SubcategoryService.update(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: [SUB_KEY] }),
  });
}

export function useToggleSubcategoryActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: UUID; isActive: boolean }) =>
      SubcategoryService.setActive(id, isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: [SUB_KEY] }),
  });
}
