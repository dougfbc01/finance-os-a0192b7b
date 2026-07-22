import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AccountService } from "@/services/AccountService";
import type { CreateAccountInput, UpdateAccountInput, UUID } from "@/models";

const KEY = "accounts";

export function useAccounts(workspaceId: UUID | undefined) {
  return useQuery({
    queryKey: [KEY, workspaceId],
    queryFn: () => AccountService.getAccounts(workspaceId as UUID),
    enabled: !!workspaceId,
  });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAccountInput) => AccountService.createAccount(input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [KEY, vars.workspace_id] });
    },
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: UUID; input: UpdateAccountInput }) =>
      AccountService.updateAccount(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
    },
  });
}

export function useToggleAccountActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: UUID; isActive: boolean }) =>
      AccountService.setActive(id, isActive),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
    },
  });
}
