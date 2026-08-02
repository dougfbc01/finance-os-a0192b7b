// Comparativo do período atual x período anterior.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { ComparisonRow } from "@/services/DashboardService";
import { formatCurrency } from "@/lib/format";

export function PeriodComparisonWidget({ rows }: { rows: ComparisonRow[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Comparativo com o período anterior
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {rows.map((row) => {
            const up = row.delta > 0;
            const flat = row.delta === 0;
            const Icon = flat ? Minus : up ? ArrowUp : ArrowDown;
            const tone = flat
              ? "text-muted-foreground"
              : up
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-destructive";
            return (
              <div key={row.label} className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{row.label}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {formatCurrency(row.current)}
                </p>
                <p className={`mt-1 flex items-center gap-1 text-xs tabular-nums ${tone}`}>
                  <Icon className="h-3 w-3" />
                  {formatCurrency(Math.abs(row.delta))}
                  {row.percent !== null && <span>({Math.abs(row.percent).toFixed(1)}%)</span>}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Anterior: {formatCurrency(row.previous)}
                </p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
