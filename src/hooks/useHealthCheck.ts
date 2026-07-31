import { useMutation, useQueryClient } from "@tanstack/react-query";
import { HealthCheckService } from "@/services/HealthCheckService";
import { invalidateFinancialQueries } from "./invalidate";
import type { UUID } from "@/models";

export function useRunHealthCheck() {
  return useMutation({
    mutationFn: (workspaceId: UUID) => HealthCheckService.run(workspaceId),
  });
}

export function useRebuildInvoices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (workspaceId: UUID) => HealthCheckService.rebuildInvoices(workspaceId),
    onSuccess: () => invalidateFinancialQueries(qc),
  });
}
