// Hooks de Compromissos/Parcelamentos — apenas orquestração de dados e cache.
// Toda regra de cronograma vive no CommitmentService.
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "./useWorkspace";
import { CommitmentService, CommitmentServiceImpl } from "@/services/CommitmentService";
import type { UUID } from "@/models";
import type {
  Commitment,
  CommitmentForecast,
  CommitmentInstallment,
  CommitmentView,
  CreateCommitmentInput,
  UpdateCommitmentInput,
} from "@/models/Commitment";

const KEY = "commitments";
const INSTALLMENTS_KEY = "commitment-installments";

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: [KEY] });
    qc.invalidateQueries({ queryKey: [INSTALLMENTS_KEY] });
  };
}

export function useCommitmentList(workspaceId: UUID | undefined) {
  return useQuery({
    queryKey: [KEY, workspaceId],
    queryFn: () => CommitmentService.list(workspaceId as UUID),
    enabled: !!workspaceId,
  });
}

export function useCommitmentInstallments(workspaceId: UUID | undefined) {
  return useQuery({
    queryKey: [INSTALLMENTS_KEY, workspaceId],
    queryFn: () => CommitmentService.listInstallments(workspaceId as UUID),
    enabled: !!workspaceId,
  });
}

export interface CommitmentsState {
  workspaceId: UUID | undefined;
  commitments: Commitment[];
  installments: CommitmentInstallment[];
  views: CommitmentView[];
  overdueCount: number;
  remainingTotal: number;
  monthlyTotal: number;
  isLoading: boolean;
}

/** Estado consolidado usado por /compromissos. */
export function useCommitments(today?: string): CommitmentsState {
  const { data: ws } = useWorkspace();
  const wsId = ws?.id as UUID | undefined;
  const commitmentsQ = useCommitmentList(wsId);
  const installmentsQ = useCommitmentInstallments(wsId);

  const commitments = useMemo(() => commitmentsQ.data ?? [], [commitmentsQ.data]);
  const installments = useMemo(() => installmentsQ.data ?? [], [installmentsQ.data]);

  const views = useMemo(
    () => commitments.map((c) => CommitmentServiceImpl.view(c, installments, today)),
    [commitments, installments, today],
  );

  return {
    workspaceId: wsId,
    commitments,
    installments,
    views,
    overdueCount: views.reduce((s, v) => s + v.overdueCount, 0),
    remainingTotal: Number(
      views
        .filter((v) => v.commitment.status !== "CANCELLED")
        .reduce((s, v) => s + v.remainingAmount, 0)
        .toFixed(2),
    ),
    monthlyTotal: Number(
      views
        .filter((v) => v.commitment.status === "ACTIVE" && v.next)
        .reduce((s, v) => s + (v.next?.amount ?? 0), 0)
        .toFixed(2),
    ),
    isLoading: commitmentsQ.isLoading || installmentsQ.isLoading,
  };
}

/**
 * Obrigações previstas de uma competência (YYYY-MM) para o Planejamento.
 * `budgetedCategoryIds` marca o que já está orçado, evitando dupla contagem.
 */
export function useCommitmentForecast(
  competence: string,
  budgetedCategoryIds: (UUID | null)[] = [],
): CommitmentForecast {
  const { data: ws } = useWorkspace();
  const wsId = ws?.id as UUID | undefined;
  const { data: commitments } = useCommitmentList(wsId);
  const { data: installments } = useCommitmentInstallments(wsId);
  const key = budgetedCategoryIds.filter(Boolean).sort().join(",");

  return useMemo(
    () =>
      CommitmentServiceImpl.forecastForCompetence({
        competence,
        commitments: commitments ?? [],
        installments: installments ?? [],
        budgetedCategoryIds: key ? (key.split(",") as UUID[]) : [],
      }),
    [competence, commitments, installments, key],
  );
}

export function useCreateCommitment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: CreateCommitmentInput) => CommitmentService.create(input),
    onSuccess: invalidate,
  });
}

export function useUpdateCommitment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (vars: { id: UUID; input: UpdateCommitmentInput }) =>
      CommitmentService.update(vars.id, vars.input),
    onSuccess: invalidate,
  });
}

export function useCancelCommitment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: UUID) => CommitmentService.cancel(id),
    onSuccess: invalidate,
  });
}

export function useToggleInstallmentPaid() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (vars: { id: UUID; paid: boolean }) =>
      vars.paid
        ? CommitmentService.markInstallmentPaid(vars.id)
        : CommitmentService.unmarkInstallmentPaid(vars.id),
    onSuccess: invalidate,
  });
}
