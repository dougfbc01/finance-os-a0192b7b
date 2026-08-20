// Hooks do módulo administrativo — apenas orquestração de dados/cache.
// A autorização real acontece no banco (RLS + has_role).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { AdminService } from "@/services/AdminService";
import type { UUID } from "@/models";

const KEY = "admin";

export function useIsAdmin() {
  const { user, loading } = useAuth();
  const query = useQuery({
    queryKey: [KEY, "is-admin", user?.id],
    queryFn: () => AdminService.isAdmin(user!.id),
    enabled: !!user?.id,
    staleTime: 60_000,
  });
  return { isAdmin: query.data === true, isLoading: loading || query.isLoading };
}

/** Status de liberação do usuário logado. */
export function useMyAccess() {
  const { user, loading } = useAuth();
  const query = useQuery({
    queryKey: [KEY, "my-access", user?.id],
    queryFn: () => AdminService.myAccess(user!.id),
    enabled: !!user?.id,
    staleTime: 30_000,
  });
  return {
    access: query.data ?? null,
    status: query.data?.status ?? null,
    isLoading: loading || query.isLoading,
  };
}

export function useAdminUsers(enabled: boolean) {
  return useQuery({
    queryKey: [KEY, "users"],
    queryFn: () => AdminService.listUsers(),
    enabled,
  });
}

export function useAdminAudit(enabled: boolean) {
  return useQuery({
    queryKey: [KEY, "audit"],
    queryFn: () => AdminService.listAudit(),
    enabled,
  });
}

function useAdminMutation<T>(fn: (actorId: UUID, input: T) => Promise<void>) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: T) => {
      if (!user?.id) throw new Error("Sessão expirada.");
      await fn(user.id, input);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY] });
    },
  });
}

export function useGrantAccess() {
  return useAdminMutation<{ userId: UUID; reason?: string }>((actorId, input) =>
    AdminService.grantAccess(actorId, input.userId, input.reason),
  );
}

export function useBlockAccess() {
  return useAdminMutation<{ userId: UUID; reason?: string }>((actorId, input) =>
    AdminService.blockAccess(actorId, input.userId, input.reason),
  );
}

export function useSetAdminRole() {
  return useAdminMutation<{ userId: UUID; isAdmin: boolean }>((actorId, input) =>
    AdminService.setAdminRole(actorId, input.userId, input.isAdmin),
  );
}
