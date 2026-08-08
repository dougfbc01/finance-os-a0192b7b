import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { formatCurrency } from "@/lib/format";
import type { GoalHistoryPoint } from "@/models/FinancialGoal";

interface Props {
  history: GoalHistoryPoint[];
  target: number;
}

/** Gráfico de evolução da meta a partir do histórico real de aportes. */
export function GoalEvolutionChart({ history, target }: Props) {
  if (history.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Ainda não há histórico de evolução para esta meta.
      </p>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Evolução da meta
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" fontSize={12} />
              <YAxis fontSize={12} width={90} tickFormatter={(v) => formatCurrency(v)} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              {target > 0 && (
                <ReferenceLine y={target} stroke="hsl(var(--destructive))" strokeDasharray="4 4" />
              )}
              <Area
                type="monotone"
                dataKey="accumulated"
                name="Acumulado"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary) / 0.15)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
