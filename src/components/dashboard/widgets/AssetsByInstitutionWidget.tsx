import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { GroupBreakdown } from "@/services/PatrimonyService";

const COLORS = ["#6366F1", "#F97316", "#14B8A6", "#EAB308", "#EF4444", "#0EA5E9", "#94A3B8"];

interface Props {
  data: GroupBreakdown[];
}

export function AssetsByInstitutionWidget({ data }: Props) {
  const chartData = data.map((d) => ({ name: d.label, value: Number(d.amount.toFixed(2)) }));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Distribuição por Instituição
        </CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem ativos cadastrados.</p>
        ) : (
          <ResponsiveContainer>
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={80} label>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
