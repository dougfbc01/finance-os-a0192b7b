// Sprint 4.15A — Histórico auditável das decisões tomadas nesta fatura.
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import {
  INVOICE_ACTION_LABELS,
  UNDOABLE_ACTIONS,
  DECISION_ACTIONS,
  type InvoiceReconciliationActionRecord,
} from "@/models/CardInvoiceReconciliationAction";

export function InvoiceReconciliationHistory({
  actions,
  pending,
  onUndo,
}: {
  actions: InvoiceReconciliationActionRecord[];
  pending?: boolean;
  onUndo: (id: string) => void;
}) {
  if (actions.length === 0) return null;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">Histórico de decisões</h2>
        <ul className="space-y-2">
          {actions.map((a) => {
            const undoable =
              !a.undone_at &&
              (UNDOABLE_ACTIONS.includes(a.action) || DECISION_ACTIONS.includes(a.action));
            return (
              <li
                key={a.id}
                className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm"
              >
                <Badge variant="outline">{INVOICE_ACTION_LABELS[a.action]}</Badge>
                <span className="text-xs text-muted-foreground">
                  {formatDate(a.created_at.slice(0, 10))}
                </span>
                {a.reason && <span className="text-xs">· {a.reason}</span>}
                {a.undone_at && (
                  <Badge variant="secondary" className="ml-auto">
                    Desfeita
                  </Badge>
                )}
                {undoable && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    disabled={pending}
                    onClick={() => onUndo(a.id)}
                  >
                    Desfazer
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
