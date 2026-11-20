import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ClosingAuditTrail,
  ClosingList,
  ClosingTrendChart,
  CloseMonthDialog,
  MonthGrid,
  ReopenDialog,
  SnapshotView,
} from "@/components/closings";
import { MonthlySummaryReport } from "@/components/reports/MonthlySummaryReport";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  useCloseMonth,
  useCloseOpenMonths,
  useMonthlyClosings,
  useReopenClosing,
  useStaleClosings,
} from "@/hooks/useMonthlyClosings";
import { useMonthlySummary } from "@/hooks/useMonthlySummary";
import { MonthlyClosingService } from "@/services/MonthlyClosingService";
import { closingTrend, lastMonthsGrid, monthsToBatchClose } from "@/services/MonthlySummaryService";
import { formatCurrency } from "@/lib/format";
import { MONTH_LABELS, type MonthlyClosing } from "@/models/MonthlyClosing";

interface Search {
  year?: number;
  month?: number;
}

export const Route = createFileRoute("/_authenticated/fechamentos")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    year: search['year'] ? Number(search['year']) : undefined,
    month: search['month'] ? Number(search['month']) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Fechamentos Mensais — Finance OS" },
      {
        name: "description",
        content:
          "Registre e audite o fechamento mensal do seu workspace com snapshots congelados dos indicadores.",
      },
      { property: "og:title", content: "Fechamentos Mensais — Finance OS" },
      {
        property: "og:description",
        content: "Snapshot auditável de receitas, despesas, patrimônio e passivo de cada mês.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FechamentosPage,
});

function FechamentosPage() {
  const search = Route.useSearch();
  const { data: ws } = useWorkspace();
  const wsId = ws?.id as string | undefined;

  const today = new Date();
  const defaultRef = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const [year, setYear] = useState(search.year ?? defaultRef.getFullYear());
  const [month, setMonth] = useState(search.month ?? defaultRef.getMonth() + 1);

  const { data: closings = [], isLoading } = useMonthlyClosings(wsId);
  const staleIds = useStaleClosings(closings);
  const { summary, builder, closing: existing } = useMonthlySummary(year, month);
  const closeMut = useCloseMonth();
  const batchMut = useCloseOpenMonths();
  const reopenMut = useReopenClosing();

  const [closeOpen, setCloseOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [reopenTarget, setReopenTarget] = useState<MonthlyClosing | null>(null);

  const grid = useMemo(() => lastMonthsGrid(closings, staleIds), [closings, staleIds]);
  const batchMonths = useMemo(() => monthsToBatchClose(grid), [grid]);
  const trend = useMemo(() => {
    const p = builder.buildParams;
    if (!p) return [];
    return closingTrend({ accounts: p.accounts, movements: p.movements, assets: p.assets, invoices: p.invoices,
      investmentsByMonth: p.investmentsByMonth ?? {}, months: grid.map((g) => g.key) });
  }, [builder.buildParams, grid]);
  const staleChanges = useMemo(
    () => (existing && staleIds.has(existing.id) && builder.preview
      ? MonthlyClosingService.staleChanges(existing, builder.preview) : null),
    [existing, staleIds, builder.preview],
  );
  const selectedKey = `${year}-${String(month).padStart(2, "0")}`;

  const handleClose = async (notes: string) => {
    if (!wsId || !builder.buildParams) return;
    try {
      await closeMut.mutateAsync({ workspaceId: wsId, buildParams: builder.buildParams, notes });
      toast.success("Fechamento registrado");
      setCloseOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao fechar o mês");
    }
  };

  const handleBatch = async () => {
    if (!wsId || !builder.buildParams) return;
    try {
      const done = await batchMut.mutateAsync({ workspaceId: wsId, buildParams: builder.buildParams,
        months: batchMonths.map((m) => ({ year: m.year, month: m.month })), closings });
      toast.success(`${done.length} mês(es) fechado(s)`);
      setBatchOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro no fechamento em lote");
    }
  };

  const handleReopen = async (reason: string) => {
    if (!reopenTarget) return;
    try {
      await reopenMut.mutateAsync({ closing: reopenTarget, reason });
      toast.success("Fechamento reaberto");
      setReopenTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao reabrir");
    }
  };

  const select = (y: number, m: number) => { setYear(y); setMonth(m); };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Fechamentos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Snapshot auditável de cada mês. Os cálculos do sistema continuam normais — aqui o
          histórico fica congelado.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Últimos 12 meses</CardTitle>
          <Button variant="outline" disabled={batchMonths.length === 0 || builder.isLoading || !builder.buildParams}
            onClick={() => setBatchOpen(true)}>
            Fechar meses abertos em lote ({batchMonths.length})
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <MonthGrid cells={grid} selectedKey={selectedKey} onSelect={(c) => select(c.year, c.month)} />
          {trend.length > 0 && <ClosingTrendChart data={trend} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{MONTH_LABELS[month - 1]} {year}</CardTitle>
          <div className="flex items-center gap-2">
            {builder.warnings.length > 0 && (
              <span className="text-sm text-muted-foreground">{builder.warnings.length} aviso(s)</span>
            )}
            {existing?.status === "CLOSED" && (
              <Button variant="ghost" onClick={() => setReopenTarget(existing)}>Reabrir</Button>
            )}
            <Button disabled={builder.isLoading || !builder.preview} onClick={() => setCloseOpen(true)}>
              {existing ? "Refazer fechamento" : "Fechar"}
            </Button>
          </div>
        </CardHeader>
        {staleChanges && staleChanges.rows.length > 0 && (
          <CardContent>
            <div className="rounded-md border border-destructive/40 p-3 text-sm">
              <p className="mb-2 font-medium text-destructive">Desatualizado — o que mudou desde o fechamento</p>
              <ul className="space-y-1">
                {staleChanges.rows.map((r) => (
                  <li key={r.key} className="flex justify-between gap-4">
                    <span>{r.label}</span>
                    <span className="tabular-nums">
                      {r.key === "movements" || r.key === "uncategorized"
                        ? `${r.previous} → ${r.current}`
                        : `${formatCurrency(r.previous)} → ${formatCurrency(r.current)} (${r.delta > 0 ? "+" : ""}${formatCurrency(r.delta)})`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        )}
      </Card>

      {summary && <MonthlySummaryReport summary={summary} />}

      {existing && (
        <div className="space-y-4">
          <SnapshotView closing={existing} />
          <ClosingAuditTrail closing={existing} />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <ClosingList
              closings={closings}
              staleIds={staleIds}
              onView={(c) => select(c.year, c.month)}
              onReopen={setReopenTarget}
            />
          )}
        </CardContent>
      </Card>

      <CloseMonthDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        year={year}
        month={month}
        preview={builder.preview}
        warnings={builder.warnings}
        isReclose={!!existing}
        isPending={closeMut.isPending}
        onConfirm={handleClose}
      />

      <AlertDialog open={batchOpen} onOpenChange={setBatchOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fechar {batchMonths.length} mês(es) em lote?</AlertDialogTitle>
            <AlertDialogDescription>
              {batchMonths.map((m) => `${MONTH_LABELS[m.month - 1]} ${m.year}`).join(", ")}. Cada mês grava um snapshot com
              o patrimônio do fim do mês. Os avisos de qualidade não são exibidos um a um; os alertas do mês selecionado não
              são congelados nos outros meses.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={batchMut.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={batchMut.isPending} onClick={(e) => { e.preventDefault(); void handleBatch(); }}>
              {batchMut.isPending ? "Fechando…" : "Fechar em lote"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ReopenDialog
        open={!!reopenTarget}
        onOpenChange={(o) => !o && setReopenTarget(null)}
        isPending={reopenMut.isPending}
        onConfirm={handleReopen}
      />
    </div>
  );
}
