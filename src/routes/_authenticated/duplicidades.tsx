import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Merge, ShieldCheck, SplitSquareHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import {
  useDuplicatePairs,
  useDedupAudits,
  useConsolidateDuplicate,
  useRejectDuplicatePair,
} from "@/hooks/useDuplicates";
import { formatCurrency, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/duplicidades")({
  head: () => ({
    meta: [
      { title: "Revisar Duplicidades — Finance OS" },
      {
        name: "description",
        content:
          "Revise lançamentos muito semelhantes detectados pela inteligência do Finance OS antes de consolidar.",
      },
      { property: "og:title", content: "Revisar Duplicidades — Finance OS" },
      {
        property: "og:description",
        content: "Consolidação segura de lançamentos duplicados, sem perder informação manual.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DuplicidadesPage,
});

function DuplicidadesPage() {
  const { data: ws } = useWorkspace();
  const wsId = ws?.id as string | undefined;
  const { user } = useAuth();
  const { data: pairs = [], isLoading } = useDuplicatePairs(wsId);
  const { data: audits = [] } = useDedupAudits(wsId);
  const consolidate = useConsolidateDuplicate();
  const reject = useRejectDuplicatePair();

  const handleReject = async (index: number) => {
    const pair = pairs[index];
    if (!wsId || !pair) return;
    try {
      await reject.mutateAsync({
        workspaceId: wsId,
        movementAId: pair.original.id,
        movementBId: pair.duplicate.id,
      });
      toast.success("Decisão registrada: não são a mesma movimentação.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao registrar decisão");
    }
  };

  const handleConsolidate = async (index: number) => {
    const pair = pairs[index];
    if (!wsId || !pair) return;
    if (
      !confirm(
        "Consolidar mantém o lançamento original (com categoria, notas e anexos) e apenas atualiza as datas. Confirmar?",
      )
    )
      return;
    try {
      const res = await consolidate.mutateAsync({
        workspaceId: wsId,
        original: pair.original,
        duplicate: pair.duplicate,
        confidence: pair.score.confidence_match,
        reason: pair.score.label,
        performedBy: user?.id ?? null,
      });
      toast.success(
        res.changedFields.length
          ? `Consolidado. Campos atualizados: ${res.changedFields.join(", ")}.`
          : "Consolidado sem alterações no lançamento original.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao consolidar");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Revisar Duplicidades</h1>
        <p className="text-sm text-muted-foreground">
          Lançamentos semelhantes detectados por fingerprint, valor e janela de datas. Nada é
          excluído ou consolidado automaticamente.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Analisando…</p>
      ) : pairs.length === 0 ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <ShieldCheck className="mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhuma duplicidade pendente de revisão.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pairs.map((pair, index) => (
            <Card key={`${pair.original.id}-${pair.duplicate.id}`}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium">
                  {pair.original.description}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant={pair.score.confidence_match >= 90 ? "default" : "secondary"}>
                    {pair.score.confidence_match}% — {pair.score.label}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleConsolidate(index)}
                    disabled={consolidate.isPending}
                  >
                    <Merge className="mr-1 h-3.5 w-3.5" /> Consolidar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleReject(index)}
                    disabled={reject.isPending}
                  >
                    <SplitSquareHorizontal className="mr-1 h-3.5 w-3.5" /> Não são a mesma
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {[pair.original, pair.duplicate].map((mv, i) => (
                  <div key={mv.id} className="rounded-md border p-3 text-sm">
                    <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                      {i === 0 ? "Original (preservado)" : "Semelhante"}
                    </p>
                    <p className="font-medium">{mv.description}</p>
                    <p className="text-muted-foreground">
                      {formatDate(mv.transaction_date)} • {formatCurrency(Number(mv.amount))} •{" "}
                      {mv.type}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Auditoria de consolidações
          </CardTitle>
        </CardHeader>
        <CardContent>
          {audits.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma consolidação registrada.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {audits.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{a.confidence_match}%</Badge>
                  <span>{a.reason}</span>
                  <span className="text-muted-foreground">
                    campos: {(a.changed_fields ?? []).join(", ") || "nenhum"} •{" "}
                    {new Date(a.created_at).toLocaleString("pt-BR")} • {a.source}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
