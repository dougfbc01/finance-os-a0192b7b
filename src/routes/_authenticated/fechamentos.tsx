import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ClosingAuditTrail,
  ClosingList,
  CloseMonthDialog,
  ReopenDialog,
  SnapshotView,
} from "@/components/closings";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  useClosingBuilder,
  useCloseMonth,
  useMonthlyClosings,
  useReopenClosing,
  useStaleClosings,
} from "@/hooks/useMonthlyClosings";
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
  const builder = useClosingBuilder(year, month);
  const closeMut = useCloseMonth();
  const reopenMut = useReopenClosing();

  const [closeOpen, setCloseOpen] = useState(false);
  const [reopenTarget, setReopenTarget] = useState<MonthlyClosing | null>(null);
  const [selected, setSelected] = useState<MonthlyClosing | null>(null);

  const existing = useMemo(
    () => closings.find((c) => c.year === year && c.month === month) ?? null,
    [closings, year, month],
  );

  const years = useMemo(() => {
    const base = today.getFullYear();
    return [base + 1, base, base - 1, base - 2, base - 3];
  }, [today]);

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
        <CardHeader>
          <CardTitle className="text-base">Novo fechamento</CardTitle>
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
          <Button disabled={builder.isLoading || !builder.preview} onClick={() => setCloseOpen(true)}>
            {existing ? "Refazer fechamento" : "Fechar mês"}
          </Button>
          {builder.warnings.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {builder.warnings.length} aviso(s) serão exibidos antes de confirmar.
            </span>
          )}
        </CardContent>
      </Card>

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
              onView={setSelected}
              onReopen={setReopenTarget}
            />
          )}
        </CardContent>
      </Card>

      {selected && (
        <div className="space-y-4">
          <SnapshotView closing={selected} />
          <ClosingAuditTrail closing={selected} />
        </div>
      )}

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

      <ReopenDialog
        open={!!reopenTarget}
        onOpenChange={(o) => !o && setReopenTarget(null)}
        isPending={reopenMut.isPending}
        onConfirm={handleReopen}
      />
    </div>
  );
}
