// Evolução do patrimônio total (caixa + ativos − passivos) no período.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { NetWorthPoint } from "@/services/DashboardService";
import { formatCurrency } from "@/lib/format";

export function NetWorthEvolutionWidget({ data }: { data: NetWorthPoint[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Evolução do patrimônio
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" fontSize={12} />
              <YAxis fontSize={12} width={90} tickFormatter={(v) => formatCurrency(v)} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Area
                type="monotone"
                dataKey="netWorth"
                name="Patrimônio"
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
