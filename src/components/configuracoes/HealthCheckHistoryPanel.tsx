import { History, CheckCircle2, XCircle, AlertTriangle, Timer } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useHealthCheckRuns } from "@/hooks/useHealthCheck";
import type { HealthCheckAlert } from "@/services/HealthCheckService";
import type { UUID } from "@/models";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("pt-BR");
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function sourceLabel(source: string): string {
  return source === "SCHEDULED" ? "Automática" : "Manual";
}

function StatusIcon({ run }: { run: HealthCheckAlert }) {
  if (run.status === "FAILED") return <XCircle className="h-4 w-4 text-destructive" />;
  if (run.issues > 0) return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
}

function statusText(run: HealthCheckAlert): string {
  if (run.status === "FAILED") return "Falha";
  return run.issues > 0 ? `Sucesso · ${run.issues} inconsistência(s)` : "Sucesso";
}

export function HealthCheckHistoryPanel({ workspaceId }: { workspaceId?: UUID }) {
  const { data: runs = [], isLoading } = useHealthCheckRuns(workspaceId);
  const last = runs[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4 text-primary" />
          Histórico de Execuções
        </CardTitle>
        <CardDescription>
          Última execução, situação (sucesso ou falha) e tempo de processamento das verificações
          de integridade.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando histórico...</p>}

        {!isLoading && !last && (
          <p className="text-sm text-muted-foreground">
            Nenhuma execução registrada ainda. Rode a verificação acima ou ative o agendamento
            automático.
          </p>
        )}

        {last && (
          <div className="rounded-md border p-3 space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Última execução
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <span className="flex items-center gap-2 font-medium">
                <StatusIcon run={last} />
                {statusText(last)}
              </span>
              <span className="text-muted-foreground">{formatDateTime(last.created_at)}</span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <Timer className="h-3.5 w-3.5" />
                {formatDuration(last.duration_ms)}
              </span>
              <Badge variant="secondary">{sourceLabel(last.source)}</Badge>
            </div>
            {last.error_message && (
              <p className="text-sm text-destructive">{last.error_message}</p>
            )}
          </div>
        )}

        {runs.length > 1 && (
          <ul className="divide-y rounded-md border">
            {runs.slice(1).map((run) => (
              <li
                key={run.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  <StatusIcon run={run} />
                  {formatDateTime(run.created_at)}
                </span>
                <span className="flex items-center gap-3 text-muted-foreground">
                  <span>{statusText(run)}</span>
                  <span className="flex items-center gap-1">
                    <Timer className="h-3.5 w-3.5" />
                    {formatDuration(run.duration_ms)}
                  </span>
                  <Badge variant="outline">{sourceLabel(run.source)}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
