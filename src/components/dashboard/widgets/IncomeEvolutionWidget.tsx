// Evolução mensal das receitas (e despesas) dentro do período filtrado.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import type { MonthlySeriesPoint } from "@/services/DashboardService";
import { formatCurrency } from "@/lib/format";

export function IncomeEvolutionWidget({ data }: { data: MonthlySeriesPoint[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Evolução mensal das receitas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" fontSize={12} />
              <YAxis fontSize={12} width={90} tickFormatter={(v) => formatCurrency(v)} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
              <Bar dataKey="income" name="Receitas" fill="#22C55E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
