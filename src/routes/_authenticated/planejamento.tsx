import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BudgetFormDialog,
  BudgetItemsEditor,
  BudgetSummaryCards,
  BudgetTable,
} from "@/components/budgets";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useCategories, useSubcategories } from "@/hooks/useCategories";
import {
  useActivateBudget,
  useBudgetSuggestion,
  useCloseBudget,
  useCreateBudget,
  useMonthlyBudget,
  useSaveBudgetItems,
} from "@/hooks/useMonthlyBudgets";
import { MonthlyBudgetService } from "@/services/MonthlyBudgetService";
import { MONTH_LABELS } from "@/models/MonthlyClosing";
import {
  BUDGET_SORT_LABELS,
  BUDGET_STATUS_LABELS,
  type BudgetMode,
  type BudgetSortKey,
  type BudgetSuggestionSource,
} from "@/models/MonthlyBudget";

export const Route = createFileRoute("/_authenticated/planejamento")({
  head: () => ({
    meta: [
      { title: "Planejamento Mensal — Finance OS" },
      {
        name: "description",
        content:
          "Defina quanto pretende gastar e receber em cada mês e acompanhe o planejado x realizado em tempo real.",
      },
      { property: "og:title", content: "Planejamento Mensal — Finance OS" },
      {
        property: "og:description",
        content: "Orçamento inteligente com comparação contínua entre planejado e realizado.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanejamentoPage,
});

function PlanejamentoPage() {
  const today = new Date();
  const { data: ws } = useWorkspace();
  const wsId = ws?.id as string | undefined;

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [sort, setSort] = useState<BudgetSortKey>("SPENT");
  const [mode, setMode] = useState<BudgetMode>("SIMPLE");
  const [source, setSource] = useState<BudgetSuggestionSource>("EMPTY");
  const [createOpen, setCreateOpen] = useState(false);

  const { budget, items, comparison, isLoading } = useMonthlyBudget(year, month);
  const { data: categories = [] } = useCategories(wsId);
  const { data: subcategories = [] } = useSubcategories(wsId);
  const suggestion = useBudgetSuggestion(year, month, mode, source);

  const createMut = useCreateBudget();
  const saveItemsMut = useSaveBudgetItems();
  const activateMut = useActivateBudget();
  const closeMut = useCloseBudget();

  const years = useMemo(() => {
    const base = today.getFullYear();
    return [base + 1, base, base - 1, base - 2];
  }, [today]);

  const lines = useMemo(
    () => (comparison ? MonthlyBudgetService.sortLines(comparison.lines, sort) : []),
    [comparison, sort],
  );

  const expenseLines = lines.filter((l) => l.kind === "EXPENSE");
  const incomeLines = lines.filter((l) => l.kind === "INCOME");

  const suggestedTotal = suggestion.reduce((s, i) => s + i.planned_amount, 0);

  const handleCreate = async (name: string) => {
    if (!wsId) return;
    try {
      await createMut.mutateAsync({
        workspaceId: wsId,
        year,
        month,
        mode,
        name,
        status: "ACTIVE",
        items: suggestion,
      });
      toast.success("Planejamento criado");
      setCreateOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar planejamento");
    }
  };

  const handleSaveItems = async (drafts: Parameters<typeof saveItemsMut.mutateAsync>[0]["items"]) => {
    if (!budget || !wsId) return;
    try {
      await saveItemsMut.mutateAsync({ budgetId: budget.id, workspaceId: wsId, items: drafts });
      toast.success("Planejamento salvo");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Planejamento Mensal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O orçamento guarda apenas o valor planejado. O realizado é calculado em tempo real
          por competência, a partir das suas movimentações.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Período</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_LABELS.map((label, i) => (
                  <SelectItem key={label} value={String(i + 1)}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-32">
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-48">
            <Select value={sort} onValueChange={(v) => setSort(v as BudgetSortKey)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(BUDGET_SORT_LABELS) as [string, string][]).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>

          {budget ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={budget.status === "ACTIVE" ? "default" : "secondary"}>
                {BUDGET_STATUS_LABELS[budget.status]}
              </Badge>
              <span className="text-sm text-muted-foreground">{budget.name}</span>
              {budget.status !== "ACTIVE" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={activateMut.isPending}
                  onClick={() => activateMut.mutate(budget)}
                >
                  Ativar
                </Button>
              )}
              {budget.status !== "CLOSED" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={closeMut.isPending}
                  onClick={() => closeMut.mutate(budget.id)}
                >
                  Encerrar
                </Button>
              )}
            </div>
          ) : (
            <Button onClick={() => setCreateOpen(true)}>Criar planejamento</Button>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <>
          {comparison && <BudgetSummaryCards summary={comparison.summary} />}

          <Tabs defaultValue="comparison">
            <TabsList>
              <TabsTrigger value="comparison">Planejado x Realizado</TabsTrigger>
              <TabsTrigger value="income">Receitas</TabsTrigger>
              <TabsTrigger value="edit" disabled={!budget}>
                Editar planejamento
              </TabsTrigger>
            </TabsList>

            <TabsContent value="comparison" className="pt-4">
              <Card>
                <CardContent className="pt-6">
                  <BudgetTable lines={expenseLines} emptyLabel="Nenhuma despesa no período." />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="income" className="pt-4">
              <Card>
                <CardContent className="pt-6">
                  <BudgetTable lines={incomeLines} emptyLabel="Nenhuma receita no período." />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="edit" className="pt-4">
              <Card>
                <CardContent className="pt-6">
                  {budget && (
                    <BudgetItemsEditor
                      mode={budget.mode}
                      categories={categories}
                      subcategories={subcategories}
                      items={items}
                      isPending={saveItemsMut.isPending}
                      onSave={handleSaveItems}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      <BudgetFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        year={year}
        month={month}
        mode={mode}
        source={source}
        suggestedCount={suggestion.length}
        suggestedTotal={suggestedTotal}
        isPending={createMut.isPending}
        onModeChange={setMode}
        onSourceChange={setSource}
        onConfirm={handleCreate}
      />
    </div>
  );
}
