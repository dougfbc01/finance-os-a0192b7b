// Hooks de Metas Financeiras — apenas orquestração de dados e cache.
// Toda regra financeira vive no FinancialGoalService.
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "./useWorkspace";
import { usePatrimony } from "./usePatrimony";
import { useDashboardData } from "./useDashboard";
import { FinancialGoalService } from "@/services/FinancialGoalService";
import type { UUID } from "@/models";
import type {
  CreateContributionInput,
  CreateGoalInput,
  FinancialGoal,
  FinancialGoalStatus,
  GoalAccountLink,
  GoalProgress,
  GoalsOverview,
  UpdateGoalInput,
} from "@/models/FinancialGoal";

const KEY = "financial-goals";
const CONTRIB_KEY = "financial-goal-contributions";
const ACCOUNTS_KEY = "financial-goal-accounts";

export function useGoals(workspaceId: UUID | undefined) {
  return useQuery({
    queryKey: [KEY, workspaceId],
    queryFn: () => FinancialGoalService.list(workspaceId as UUID),
    enabled: !!workspaceId,
  });
}

export function useGoalContributions(workspaceId: UUID | undefined) {
  return useQuery({
    queryKey: [CONTRIB_KEY, workspaceId],
    queryFn: () => FinancialGoalService.listContributions(workspaceId as UUID),
    enabled: !!workspaceId,
  });
}

/** Vínculos meta → conta do workspace (Sprint 4.4.1). */
export function useGoalAccounts(workspaceId: UUID | undefined) {
  return useQuery({
    queryKey: [ACCOUNTS_KEY, workspaceId],
    queryFn: () => FinancialGoalService.listGoalAccounts(workspaceId as UUID),
    enabled: !!workspaceId,
  });
}

export interface FinancialGoalsState {
  goals: FinancialGoal[];
  progress: GoalProgress[];
  overview: GoalsOverview;
  links: GoalAccountLink[];
  isLoading: boolean;
}

/** Estado consolidado das metas (usado em /metas, Dashboard e Insights). */
export function useFinancialGoals(): FinancialGoalsState {
  const { data: ws } = useWorkspace();
  const wsId = ws?.id as string | undefined;
  const goalsQ = useGoals(wsId);
  const contribQ = useGoalContributions(wsId);
  const linksQ = useGoalAccounts(wsId);
  const { snapshot } = usePatrimony();
  // Mesmas queries já usadas pelo Dashboard — React Query deduplica.
  const { accounts, movements } = useDashboardData();

  const goals = useMemo(() => goalsQ.data ?? [], [goalsQ.data]);
  const contributions = useMemo(() => contribQ.data ?? [], [contribQ.data]);
  const links = useMemo(() => linksQ.data ?? [], [linksQ.data]);

  const progress = useMemo(
    () =>
      FinancialGoalService.progressAll({
        goals,
        contributions,
        patrimony: snapshot,
        links,
        accounts,
        movements,
      }),
    [goals, contributions, snapshot, links, accounts, movements],
  );

  const overview = useMemo(() => FinancialGoalService.overview(progress), [progress]);

  return {
    goals,
    progress,
    overview,
    links,
    isLoading: goalsQ.isLoading || contribQ.isLoading || linksQ.isLoading,
  };
}

function useInvalidateGoals() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: [KEY] });
    qc.invalidateQueries({ queryKey: [CONTRIB_KEY] });
  };
}

export function useCreateGoal() {
  const invalidate = useInvalidateGoals();
  return useMutation({
    mutationFn: (input: CreateGoalInput) => FinancialGoalService.create(input),
    onSuccess: invalidate,
  });
}

export function useUpdateGoal() {
  const invalidate = useInvalidateGoals();
  return useMutation({
    mutationFn: (vars: { id: UUID; input: UpdateGoalInput }) =>
      FinancialGoalService.update(vars.id, vars.input),
    onSuccess: invalidate,
  });
}

export function useSetGoalStatus() {
  const invalidate = useInvalidateGoals();
  return useMutation({
    mutationFn: (vars: { id: UUID; status: FinancialGoalStatus }) =>
      FinancialGoalService.setStatus(vars.id, vars.status),
    onSuccess: invalidate,
  });
}

export function useDeleteGoal() {
  const invalidate = useInvalidateGoals();
  return useMutation({
    mutationFn: (id: UUID) => FinancialGoalService.remove(id),
    onSuccess: invalidate,
  });
}

export function useAddContribution() {
  const invalidate = useInvalidateGoals();
  return useMutation({
    mutationFn: (input: CreateContributionInput) => FinancialGoalService.addContribution(input),
    onSuccess: invalidate,
  });
}

export function useDeleteContribution() {
  const invalidate = useInvalidateGoals();
  return useMutation({
    mutationFn: (id: UUID) => FinancialGoalService.removeContribution(id),
    onSuccess: invalidate,
  });
}
