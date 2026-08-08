import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  GoalCard,
  GoalContributionDialog,
  GoalDetailPanel,
  GoalFormDialog,
} from "@/components/goals";
import { formatCurrency } from "@/lib/format";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  useDeleteContribution,
  useFinancialGoals,
  useGoalContributions,
  useSetGoalStatus,
} from "@/hooks/useFinancialGoals";
import { FinancialGoalService } from "@/services/FinancialGoalService";
import {
  GOAL_STATUS_LABELS,
  type FinancialGoal,
  type FinancialGoalStatus,
} from "@/models/FinancialGoal";

interface Search {
  goal?: string;
}

export const Route = createFileRoute("/_authenticated/metas")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    goal: typeof search['goal'] === "string" ? search['goal'] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Metas Financeiras — Finance OS" },
      {
        name: "description",
        content:
          "Acompanhe suas metas financeiras: progresso, quanto falta, ritmo médio e previsão de conclusão.",
      },
      { property: "og:title", content: "Metas Financeiras — Finance OS" },
      {
        property: "og:description",
        content: "Evolução, percentual atingido e previsão de conclusão de cada meta.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MetasPage,
});

const STATUS_FILTERS: (FinancialGoalStatus | "ALL")[] = [
  "ALL",
  "ACTIVE",
  "COMPLETED",
  "PAUSED",
  "CANCELLED",
];

function MetasPage() {
  const search = Route.useSearch();
  const { data: ws } = useWorkspace();
  const wsId = ws?.id as string | undefined;

  const { goals, progress, overview, isLoading } = useFinancialGoals();
  const { data: contributions = [] } = useGoalContributions(wsId);
  const statusMut = useSetGoalStatus();
  const deleteContribMut = useDeleteContribution();

  const [statusFilter, setStatusFilter] = useState<FinancialGoalStatus | "ALL">("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(search.goal ?? null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialGoal | null>(null);
  const [contribOpen, setContribOpen] = useState(false);

  const filtered = useMemo(
    () =>
      progress.filter((p) => (statusFilter === "ALL" ? true : p.status === statusFilter)),
    [progress, statusFilter],
  );

  const selected = useMemo(
    () => progress.find((p) => p.goalId === selectedId) ?? null,
    [progress, selectedId],
  );

  const selectedContributions = useMemo(
    () => (selected ? FinancialGoalService.contributionsOf(selected.goalId, contributions) : []),
    [selected, contributions],
  );

  const openDetail = (goalId: string) => setSelectedId(goalId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Metas Financeiras</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe evolução, quanto falta e a previsão de conclusão de cada meta.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          disabled={!wsId}
        >
          <Plus className="mr-1 h-4 w-4" /> Nova meta
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Metas ativas</p>
            <p className="text-xl font-semibold">{overview.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Concluídas</p>
            <p className="text-xl font-semibold">{overview.completed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Atrasadas</p>
            <p className="text-xl font-semibold">{overview.late}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Acumulado / alvo</p>
            <p className="text-xl font-semibold tabular-nums">
              {formatCurrency(overview.totalCurrent)}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              de {formatCurrency(overview.totalTarget)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="list">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="list">Minhas metas</TabsTrigger>
            <TabsTrigger value="detail">Detalhamento</TabsTrigger>
          </TabsList>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as FinancialGoalStatus | "ALL")}
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "ALL" ? "Todos os status" : GOAL_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <TabsContent value="list" className="mt-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : filtered.length === 0 ? (
            <div className="flex min-h-[20vh] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {goals.length === 0
                  ? "Crie sua primeira meta financeira para começar a acompanhar sua evolução."
                  : "Nenhuma meta com esse status."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((p) => (
                <GoalCard key={p.goalId} progress={p} onOpen={openDetail} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="detail" className="mt-4 space-y-4">
          <Select value={selectedId ?? ""} onValueChange={(v) => setSelectedId(v)}>
            <SelectTrigger className="w-full md:w-80">
              <SelectValue placeholder="Selecione uma meta" />
            </SelectTrigger>
            <SelectContent>
              {progress.map((p) => (
                <SelectItem key={p.goalId} value={p.goalId}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {!selected ? (
            <p className="text-sm text-muted-foreground">
              Selecione uma meta para ver o detalhamento completo.
            </p>
          ) : (
            <>
              <GoalDetailPanel
                progress={selected}
                contributions={selectedContributions}
                onAddContribution={() => setContribOpen(true)}
                onEdit={() => {
                  setEditing(goals.find((g) => g.id === selected.goalId) ?? null);
                  setFormOpen(true);
                }}
                onDeleteContribution={(id) =>
                  deleteContribMut.mutate(id, {
                    onSuccess: () => toast.success("Aporte removido"),
                    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
                  })
                }
              />

              <div className="flex flex-wrap gap-2">
                {selected.status !== "ACTIVE" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      statusMut.mutate({ id: selected.goalId, status: "ACTIVE" })
                    }
                  >
                    Reativar
                  </Button>
                )}
                {selected.status === "ACTIVE" && (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        statusMut.mutate({ id: selected.goalId, status: "PAUSED" })
                      }
                    >
                      Pausar
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        statusMut.mutate({ id: selected.goalId, status: "COMPLETED" })
                      }
                    >
                      Concluir
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        statusMut.mutate({ id: selected.goalId, status: "CANCELLED" })
                      }
                    >
                      Cancelar meta
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {wsId && (
        <GoalFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          workspaceId={wsId}
          goal={editing}
        />
      )}
      {wsId && selected && (
        <GoalContributionDialog
          open={contribOpen}
          onOpenChange={setContribOpen}
          workspaceId={wsId}
          goalId={selected.goalId}
        />
      )}
    </div>
  );
}
