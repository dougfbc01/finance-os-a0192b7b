import { Link } from "@tanstack/react-router";
import { CalendarCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { ROUTES } from "@/constants";
import {
  CLOSING_STATUS_LABELS,
  MONTH_LABELS,
  type MonthlyClosing,
} from "@/models/MonthlyClosing";

interface Props {
  closing: MonthlyClosing | null;
}

export function LastClosingWidget({ closing }: Props) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Último fechamento
        </CardTitle>
        <CalendarCheck className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {!closing ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Nenhum mês fechado ainda.</p>
            <Link to={ROUTES.FECHAMENTOS} className="text-sm font-medium underline">
              Fechar um mês
            </Link>
          </div>
        ) : (
          <Link to={ROUTES.FECHAMENTOS} className="block space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-lg font-semibold">
                {MONTH_LABELS[closing.month - 1]} {closing.year}
              </p>
              <Badge variant={closing.status === "CLOSED" ? "default" : "secondary"}>
                {CLOSING_STATUS_LABELS[closing.status]}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground">Resultado</p>
                <p
                  className={`font-semibold tabular-nums ${
                    (closing.snapshot_json?.totals?.result ?? 0) >= 0
                      ? "text-emerald-600"
                      : "text-red-600"
                  }`}
                >
                  {formatCurrency(closing.snapshot_json?.totals?.result ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Patrimônio</p>
                <p className="font-semibold tabular-nums">
                  {formatCurrency(closing.snapshot_json?.totals?.netWorth ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Passivo</p>
                <p className="font-semibold tabular-nums text-red-600">
                  {formatCurrency(closing.snapshot_json?.totals?.liabilities ?? 0)}
                </p>
              </div>
            </div>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
