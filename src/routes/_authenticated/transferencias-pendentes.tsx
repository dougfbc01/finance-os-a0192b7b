import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { toast } from "sonner";
import { ArrowRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  useApplyReconciliation,
  useApplyReconciliations,
  useRejectTransferCandidate,
  useTransferCandidates,
} from "@/hooks/useReconciliation";
import { useAccounts } from "@/hooks/useAccounts";
import { useWorkspace } from "@/hooks/useWorkspace";
import { formatCurrency, formatDate } from "@/lib/format";
import type { TransferCandidate } from "@/services/ReconciliationService";

export const Route = createFileRoute("/_authenticated/transferencias-pendentes")({
  head: () => ({
    meta: [
      { title: "Transferências Pendentes — Finance OS" },
      {
        name: "description",
        content:
          "Confirme manualmente transferências entre suas contas identificadas pelo motor de conciliação do Finance OS.",
      },
      { property: "og:title", content: "Transferências Pendentes — Finance OS" },
      {
        property: "og:description",
        content: "Revise e confirme transferências entre contas próprias sem duplicar valores.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TransferenciasPendentesPage,
});

function TransferenciasPendentesPage() {
  const { data: ws } = useWorkspace();
  const { candidates, isLoading } = useTransferCandidates();
  const { data: accounts = [] } = useAccounts(ws?.id);
  const applyOne = useApplyReconciliation();
  const applyAll = useApplyReconciliations();
  const rejectOne = useRejectTransferCandidate();

  const accountMap = useMemo(
    () => Object.fromEntries(accounts.map((a) => [a.id, a])),
    [accounts],
  );

  const highConfidence = candidates.filter((c) => c.confidence === "high");
  const rest = candidates.filter((c) => c.confidence !== "high");

  const handleApplyAllHigh = async () => {
    try {
      const n = await applyAll.mutateAsync(highConfidence);
      toast.success(`${n} transferência(s) conciliada(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao conciliar");
    }
  };

  const handleApply = async (c: TransferCandidate) => {
    try {
      await applyOne.mutateAsync(c);
      toast.success("Transferência conciliada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao conciliar");
    }
  };

  const handleReject = async (c: TransferCandidate) => {
    try {
      await rejectOne.mutateAsync(c);
      toast.success("Par marcado como não relacionado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao registrar decisão");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transferências Pendentes</h1>
          <p className="text-sm text-muted-foreground">
            Pares de entrada + saída que parecem ser a mesma transferência entre contas
            próprias. Ao confirmar, os dois lançamentos permanecem no histórico e o valor
            deixa de ser contado em dobro. Nada é excluído.
          </p>
        </div>
        {highConfidence.length > 0 && (
          <Button onClick={handleApplyAllHigh} disabled={applyAll.isPending}>
            <Check className="mr-1 h-4 w-4" />
            Conciliar {highConfidence.length} confiáveis
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : candidates.length === 0 ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma transferência pendente. Tudo conciliado.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...highConfidence, ...rest].map((c) => {
            const accOut = c.outflow.account_id ? accountMap[c.outflow.account_id] : null;
            const accIn = c.inflow.account_id ? accountMap[c.inflow.account_id] : null;
            return (
              <Card key={`${c.outflow.id}-${c.inflow.id}`}>
                <CardContent className="p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-center">
                      <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Saída</p>
                        <p className="font-medium truncate">{c.outflow.description || "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {accOut?.name ?? "—"} • {formatDate(c.outflow.transaction_date)}
                        </p>
                        <p className="text-red-600 tabular-nums font-semibold mt-1">
                          -{formatCurrency(c.outflow.amount, accOut?.currency ?? "BRL")}
                        </p>
                      </div>
                      <ArrowRight className="mx-auto h-5 w-5 text-muted-foreground" />
                      <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Entrada</p>
                        <p className="font-medium truncate">{c.inflow.description || "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {accIn?.name ?? "—"} • {formatDate(c.inflow.transaction_date)}
                        </p>
                        <p className="text-emerald-600 tabular-nums font-semibold mt-1">
                          +{formatCurrency(c.inflow.amount, accIn?.currency ?? "BRL")}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-start gap-2 md:items-end">
                      <Badge
                        variant={
                          c.confidence === "high"
                            ? "default"
                            : c.confidence === "medium"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {c.confidence === "high"
                          ? "Alta confiança"
                          : c.confidence === "medium"
                            ? "Média"
                            : "Revisar"}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(c)}
                          disabled={rejectOne.isPending}
                        >
                          <X className="mr-1 h-3.5 w-3.5" /> Não são relacionadas
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApply(c)}
                          disabled={applyOne.isPending}
                        >
                          <Check className="mr-1 h-3.5 w-3.5" /> Confirmar transferência
                        </Button>
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Por que sugerimos: {c.signals.join(" · ")}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
