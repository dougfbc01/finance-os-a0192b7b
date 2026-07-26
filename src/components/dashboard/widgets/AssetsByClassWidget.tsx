import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ASSET_CLASS_GROUP_LABELS, AssetClassGroup } from "@/constants/enums";
import { formatCurrency } from "@/lib/format";
import type { GroupBreakdown } from "@/services/PatrimonyService";

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#64748B"];

interface Props {
  title?: string;
  data: GroupBreakdown[];
}

export function AssetsByClassWidget({ title = "Patrimônio por Classe", data }: Props) {
  const chartData = data.map((d) => ({
    name: ASSET_CLASS_GROUP_LABELS[d.key as AssetClassGroup] ?? d.label,
    value: Number(d.amount.toFixed(2)),
  }));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
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
