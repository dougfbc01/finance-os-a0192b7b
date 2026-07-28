import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useReprocessRules } from "@/hooks/useClassificationRules";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Finance OS" }] }),
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const { data: ws } = useWorkspace();
  const reprocess = useReprocessRules();
  const [lastResult, setLastResult] = useState<number | null>(null);

  const handleReprocess = async () => {
    if (!ws?.id) return;
    try {
      const n = await reprocess.mutateAsync(ws.id);
      setLastResult(n);
      toast.success(
        n === 0 ? "Nenhuma movimentação compatível" : `${n} movimentações classificadas`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao reprocessar");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Ajustes gerais e ferramentas do workspace.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Classificação Inteligente
          </CardTitle>
          <CardDescription>
            Executa todas as regras memorizadas sobre movimentações ainda sem categoria.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={handleReprocess} disabled={reprocess.isPending || !ws?.id}>
            {reprocess.isPending ? "Reprocessando…" : "Reprocessar Regras"}
          </Button>
          {lastResult !== null && (
            <p className="text-sm text-muted-foreground">
              Última execução: <span className="font-medium">{lastResult}</span> movimentações
              classificadas.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
