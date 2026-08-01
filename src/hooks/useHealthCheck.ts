import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  HealthCheckService,
  type HealthCheckFrequency,
} from "@/services/HealthCheckService";
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

export function useHealthCheckSchedule(workspaceId?: UUID) {
  return useQuery({
    queryKey: ["health-check-schedule", workspaceId],
    queryFn: () => HealthCheckService.getSchedule(workspaceId!),
    enabled: !!workspaceId,
  });
}

export function useSaveHealthCheckSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      workspaceId: UUID;
      enabled: boolean;
      frequency: HealthCheckFrequency;
      hourUtc: number;
    }) =>
      HealthCheckService.saveSchedule(vars.workspaceId, {
        enabled: vars.enabled,
        frequency: vars.frequency,
        hourUtc: vars.hourUtc,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["health-check-schedule"] }),
  });
}

export function useHealthCheckAlerts(workspaceId?: UUID) {
  return useQuery({
    queryKey: ["health-check-alerts", workspaceId],
    queryFn: () => HealthCheckService.listAlerts(workspaceId!),
    enabled: !!workspaceId,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useAcknowledgeHealthAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (alertId: UUID) => HealthCheckService.acknowledgeAlert(alertId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["health-check-alerts"] }),
  });
}
