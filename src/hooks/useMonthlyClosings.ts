// Hooks do Fechamento Mensal — apenas orquestração de dados e cache.
// Toda regra vive em MonthlyClosingService.
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "./useWorkspace";
import { useAuth } from "./useAuth";
import { useAccounts } from "./useAccounts";
import { useAllMovements } from "./useMovements";
import { useAssets } from "./useAssets";
import { useCardInvoices } from "./useCardInvoices";
import { useCards } from "./useCards";
import { useCategories, useSubcategories } from "./useCategories";
import { useImports } from "./useImports";
import { useDuplicatePairs } from "./useDuplicates";
import { useClassificationRules } from "./useClassificationRules";
import { useRuleIntegrity } from "./useRuleIntegrity";
import { useHealthCheckRuns } from "./useHealthCheck";
import { useFinancialInsights } from "./useFinancialInsights";
import { invalidateFinancialQueries } from "./invalidate";
import { DashboardFilterService } from "@/services/DashboardFilterService";
import { DashboardPeriod } from "@/constants/dashboard";
import { HealthCheckService } from "@/services/HealthCheckService";
import {
  MonthlyClosingService,
  type BuildSnapshotParams,
} from "@/services/MonthlyClosingService";
import type { UUID } from "@/models";
import type {
  ClosingHealth,
  ClosingSnapshot,
  MonthlyClosing,
} from "@/models/MonthlyClosing";

const KEY = "monthly-closings";

export function useMonthlyClosings(workspaceId: UUID | undefined) {
  return useQuery({
    queryKey: [KEY, workspaceId],
    queryFn: () => MonthlyClosingService.list(workspaceId as UUID),
    enabled: !!workspaceId,
  });
}

export function useClosingEvents(closingId: UUID | undefined) {
  return useQuery({
    queryKey: [KEY, "events", closingId],
    queryFn: () => MonthlyClosingService.listEvents(closingId as UUID),
    enabled: !!closingId,
  });
}

export interface ClosingBuilderState {
  buildParams: BuildSnapshotParams | null;
  preview: ClosingSnapshot | null;
  warnings: ReturnType<typeof MonthlyClosingService.validate>;
  isLoading: boolean;
}

/**
 * Reúne todos os insumos do período e monta um snapshot de PRÉ-VISUALIZAÇÃO.
 * O snapshot definitivo é gerado no momento do fechamento (com Health Check).
 */
export function useClosingBuilder(year: number, month: number): ClosingBuilderState {
  const { data: ws } = useWorkspace();
  const wsId = ws?.id as string | undefined;

  const resolved = useMemo(
    () =>
      DashboardFilterService.resolve(
        DashboardPeriod.CURRENT_MONTH,
        undefined,
        new Date(year, month - 1, 15),
      ),
    [year, month],
  );

  const accountsQ = useAccounts(wsId);
  const movementsQ = useAllMovements(wsId);
  const assetsQ = useAssets(wsId);
  const invoicesQ = useCardInvoices(wsId);
  const cardsQ = useCards(wsId);
  const categoriesQ = useCategories(wsId);
  const subcategoriesQ = useSubcategories(wsId);
  const importsQ = useImports(wsId);
  const duplicatesQ = useDuplicatePairs(wsId);
  const { data: rules = [] } = useClassificationRules(wsId);
  const ruleReport = useRuleIntegrity(rules);
  const { data: runs = [] } = useHealthCheckRuns(wsId);
  const insightsState = useFinancialInsights(resolved);

  const lastRun = runs[0];

  const buildParams = useMemo<BuildSnapshotParams | null>(() => {
    if (!wsId) return null;
    const health: ClosingHealth = {
      issues: lastRun?.issues ?? 0,
      checkedAt: lastRun?.created_at ?? null,
      items: [],
    };
    return {
      year,
      month,
      accounts: accountsQ.data ?? [],
      movements: movementsQ.data ?? [],
      assets: assetsQ.data ?? [],
      invoices: invoicesQ.data ?? [],
      cards: cardsQ.data ?? [],
      categories: (categoriesQ.data ?? []).map((c) => ({ id: c.id, name: c.name })),
      subcategories: (subcategoriesQ.data ?? []).map((s) => ({ id: s.id, name: s.name })),
      importsCount: (importsQ.data ?? []).length,
      duplicatesCount: (duplicatesQ.data ?? []).length,
      ruleConflicts: ruleReport.conflicts.length,
      ruleDuplicates: ruleReport.duplicates.length,
      insights: insightsState.insights,
      insightsSummary: insightsState.summary,
      health,
    };
  }, [
    wsId,
    year,
    month,
    accountsQ.data,
    movementsQ.data,
    assetsQ.data,
    invoicesQ.data,
    cardsQ.data,
    categoriesQ.data,
    subcategoriesQ.data,
    importsQ.data,
    duplicatesQ.data,
    ruleReport,
    insightsState.insights,
    insightsState.summary,
    lastRun,
  ]);

  const preview = useMemo(
    () => (buildParams ? MonthlyClosingService.buildSnapshot(buildParams) : null),
    [buildParams],
  );

  const warnings = useMemo(
    () => (preview ? MonthlyClosingService.validate(preview) : []),
    [preview],
  );

  return {
    buildParams,
    preview,
    warnings,
    isLoading:
      accountsQ.isLoading ||
      movementsQ.isLoading ||
      assetsQ.isLoading ||
      invoicesQ.isLoading ||
      insightsState.isLoading,
  };
}

export function useCloseMonth() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (vars: {
      workspaceId: UUID;
      buildParams: BuildSnapshotParams;
      notes?: string | null;
    }) => {
      // Health Check oficial do fechamento — congelado no snapshot.
      let health: ClosingHealth = vars.buildParams.health;
      try {
        const report = await HealthCheckService.run(vars.workspaceId);
        health = {
          issues: report.issues,
          checkedAt: report.checkedAt,
          items: report.items,
        };
      } catch {
        // Falha no Health Check não impede o fechamento; mantém o último conhecido.
      }
      const snapshot = MonthlyClosingService.buildSnapshot({
        ...vars.buildParams,
        health,
      });
      return MonthlyClosingService.close({
        workspaceId: vars.workspaceId,
        year: vars.buildParams.year,
        month: vars.buildParams.month,
        snapshot,
        notes: vars.notes ?? null,
        performedBy: (user?.id as UUID | undefined) ?? null,
      });
    },
    onSuccess: () => {
      invalidateFinancialQueries(qc);
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ["health-check-runs"] });
    },
  });
}

export function useReopenClosing() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (vars: { closing: MonthlyClosing; reason: string }) =>
      MonthlyClosingService.reopen({
        closing: vars.closing,
        reason: vars.reason,
        performedBy: (user?.id as UUID | undefined) ?? null,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

/** Fechamentos marcados como desatualizados (movimentações alteradas depois). */
export function useStaleClosings(closings: MonthlyClosing[]) {
  const { data: ws } = useWorkspace();
  const { data: movements = [] } = useAllMovements(ws?.id as string | undefined);
  return useMemo(() => {
    const set = new Set<UUID>();
    for (const c of closings) {
      if (MonthlyClosingService.isStale(c, movements)) set.add(c.id);
    }
    return set;
  }, [closings, movements]);
}
