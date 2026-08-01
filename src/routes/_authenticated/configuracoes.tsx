import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Sparkles, ShieldCheck, RefreshCw, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { useWorkspace } from "@/hooks/useWorkspace";
import { useDryRunReprocess, useReprocessRules } from "@/hooks/useClassificationRules";
import { useRebuildInvoices, useRunHealthCheck } from "@/hooks/useHealthCheck";
import { HealthCheckServiceImpl, type HealthCheckReport } from "@/services/HealthCheckService";
import type { ReprocessReport } from "@/services/ClassificationRuleService";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Finance OS" },
      {
        name: "description",
        content:
          "Ferramentas do workspace: integridade financeira, reconstrução de faturas e reprocessamento de regras de classificação.",
      },
      { property: "og:title", content: "Configurações — Finance OS" },
      {
        property: "og:description",
        content: "Integridade financeira e ferramentas de manutenção do Finance OS.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const { data: ws } = useWorkspace();
  const dryRun = useDryRunReprocess();
  const reprocess = useReprocessRules();
  const healthCheck = useRunHealthCheck();
  const rebuild = useRebuildInvoices();

  const [plan, setPlan] = useState<ReprocessReport | null>(null);
  const [result, setResult] = useState<ReprocessReport | null>(null);
  const [health, setHealth] = useState<HealthCheckReport | null>(null);

  const handleDryRun = async () => {
    if (!ws?.id) return;
    try {
      setResult(null);
      setPlan(await dryRun.mutateAsync(ws.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao simular reprocessamento");
    }
  };

  const handleApply = async () => {
    if (!ws?.id) return;
    try {
      const report = await reprocess.mutateAsync(ws.id);
      setPlan(null);
      setResult(report);
      toast.success(
        report.classified === 0
          ? "Nenhuma movimentação compatível"
          : `${report.classified} movimentações classificadas`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao reprocessar");
    }
  };

  const handleHealth = async () => {
    if (!ws?.id) return;
    try {
      setHealth(await healthCheck.mutateAsync(ws.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao verificar integridade");
    }
  };

  const handleRebuild = async () => {
    if (!ws?.id) return;
    try {
      const n = await rebuild.mutateAsync(ws.id);
      toast.success(`${n} fatura(s) reconstruída(s)`);
      setHealth(await healthCheck.mutateAsync(ws.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao reconstruir faturas");
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
            <ShieldCheck className="h-4 w-4 text-primary" />
            Integridade Financeira
          </CardTitle>
          <CardDescription>
            Verifica faturas, movimentações, ativos, transferências e importações em busca de
            inconsistências.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleHealth} disabled={healthCheck.isPending || !ws?.id}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              {healthCheck.isPending ? "Verificando..." : "Executar verificação"}
            </Button>
            <Button variant="outline" onClick={handleRebuild} disabled={rebuild.isPending || !ws?.id}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {rebuild.isPending ? "Reconstruindo..." : "Reconstruir faturas"}
            </Button>
          </div>

          {health && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                {health.issues === 0 ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span>Nenhuma inconsistência encontrada.</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span>{health.issues} verificação(ões) com problema.</span>
                  </>
                )}
              </div>
              <ul className="divide-y rounded-md border">
                {health.items.map((item) => (
                  <li
                    key={item.key}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      {item.ok ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : HealthCheckServiceImpl.isInfo(item.key) ? (
                        <Info className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      )}
                      {item.label}
                    </span>
                    <Badge variant={item.ok ? "secondary" : "outline"}>{item.count}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <HealthCheckSchedulePanel workspaceId={ws?.id} />


      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Classificação Inteligente
          </CardTitle>
          <CardDescription>
            Aplica as regras memorizadas às movimentações sem categoria. Classificações manuais
            nunca são sobrescritas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={handleDryRun} disabled={dryRun.isPending || !ws?.id}>
            <Sparkles className="mr-2 h-4 w-4" />
            {dryRun.isPending ? "Analisando..." : "Reprocessar regras"}
          </Button>

          {result && (
            <div className="rounded-md border p-3 text-sm space-y-1">
              <p className="font-medium">Relatório do reprocessamento</p>
              <p>Analisadas: {result.analyzed}</p>
              <p>Classificadas: {result.classified}</p>
              <p>Sem regra: {result.wouldRemain}</p>
              <p>Tempo: {result.elapsedMs}ms</p>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!plan} onOpenChange={(o) => !o && setPlan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Simulação do reprocessamento</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-1 text-sm">
                <p>Movimentações analisadas: {plan?.analyzed ?? 0}</p>
                <p>Sem categoria: {plan?.withoutCategory ?? 0}</p>
                <p>Seriam classificadas: {plan?.wouldClassify ?? 0}</p>
                <p>Continuariam sem categoria: {plan?.wouldRemain ?? 0}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleApply} disabled={reprocess.isPending}>
              {reprocess.isPending ? "Aplicando..." : "Aplicar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
