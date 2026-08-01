import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BellRing, CalendarClock, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAcknowledgeHealthAlert,
  useHealthCheckAlerts,
  useHealthCheckSchedule,
  useSaveHealthCheckSchedule,
} from "@/hooks/useHealthCheck";
import {
  HealthCheckServiceImpl,
  type HealthCheckFrequency,
} from "@/services/HealthCheckService";
import type { UUID } from "@/models";

const HOURS = Array.from({ length: 24 }, (_, h) => h);

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("pt-BR");
}

export function HealthCheckSchedulePanel({ workspaceId }: { workspaceId?: UUID }) {
  const { data: schedule } = useHealthCheckSchedule(workspaceId);
  const { data: alerts = [] } = useHealthCheckAlerts(workspaceId);
  const save = useSaveHealthCheckSchedule();
  const ack = useAcknowledgeHealthAlert();

  const [enabled, setEnabled] = useState(false);
  const [frequency, setFrequency] = useState<HealthCheckFrequency>("DAILY");
  const [hourUtc, setHourUtc] = useState(9);

  useEffect(() => {
    if (!schedule) return;
    setEnabled(schedule.enabled);
    setFrequency(schedule.frequency);
    setHourUtc(schedule.hour_utc);
  }, [schedule]);

  const pending = alerts.filter((a) => !a.acknowledged_at);

  const handleSave = async () => {
    if (!workspaceId) return;
    try {
      await save.mutateAsync({ workspaceId, enabled, frequency, hourUtc });
      toast.success(
        enabled ? "Verificação automática ativada" : "Verificação automática desativada",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar agendamento");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4 text-primary" />
          Verificação Automática
          {pending.length > 0 && (
            <Badge variant="destructive" className="ml-1">
              {pending.length} alerta(s)
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Executa o Health Check de Integridade Financeira no horário escolhido e registra um
          alerta sempre que encontrar inconsistências.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between rounded-md border p-3">
          <div className="space-y-0.5">
            <Label htmlFor="hc-enabled">Ativar verificação automática</Label>
            <p className="text-xs text-muted-foreground">
              {schedule?.last_run_at
                ? `Última execução: ${formatDateTime(schedule.last_run_at)}`
                : "Ainda não executada"}
            </p>
          </div>
          <Switch id="hc-enabled" checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Frequência</Label>
            <Select
              value={frequency}
              onValueChange={(v) => setFrequency(v as HealthCheckFrequency)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DAILY">Diária</SelectItem>
                <SelectItem value="WEEKLY">Semanal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Horário (UTC)</Label>
            <Select value={String(hourUtc)} onValueChange={(v) => setHourUtc(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOURS.map((h) => (
                  <SelectItem key={h} value={String(h)}>
                    {String(h).padStart(2, "0")}:00
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={handleSave} disabled={save.isPending || !workspaceId}>
          {save.isPending ? "Salvando..." : "Salvar agendamento"}
        </Button>

        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-medium">
            <BellRing className="h-4 w-4 text-muted-foreground" />
            Alertas recentes
          </p>
          {alerts.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Nenhum alerta gerado até agora.
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {alerts.map((alert) => {
                const items = HealthCheckServiceImpl.describeReport(alert.report);
                return (
                  <li key={alert.id} className="space-y-1 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        <AlertTriangle
                          className={
                            alert.acknowledged_at
                              ? "h-4 w-4 text-muted-foreground"
                              : "h-4 w-4 text-amber-500"
                          }
                        />
                        {formatDateTime(alert.created_at)} — {alert.issues} problema(s)
                      </span>
                      {alert.acknowledged_at ? (
                        <Badge variant="secondary">Lido</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => ack.mutate(alert.id)}
                          disabled={ack.isPending}
                        >
                          Marcar como lido
                        </Button>
                      )}
                    </div>
                    {items.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {items.map((i) => `${i.label} (${i.count})`).join(" · ")}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
