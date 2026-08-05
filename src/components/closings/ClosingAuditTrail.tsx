import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useClosingEvents } from "@/hooks/useMonthlyClosings";
import type { MonthlyClosing, MonthlyClosingEventType } from "@/models/MonthlyClosing";

const EVENT_LABELS: Record<MonthlyClosingEventType, string> = {
  CLOSED: "Fechado",
  REOPENED: "Reaberto",
  RECLOSED: "Refechado",
};

export function ClosingAuditTrail({ closing }: { closing: MonthlyClosing }) {
  const { data: events = [], isLoading } = useClosingEvents(closing.id);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Auditoria</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem eventos registrados.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex items-start gap-2">
                <Badge variant="secondary">{EVENT_LABELS[e.event]}</Badge>
                <div>
                  <p className="text-muted-foreground">
                    {new Date(e.created_at).toLocaleString("pt-BR")}
                  </p>
                  {e.reason && <p>{e.reason}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
