import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import type { CategoryBreakdown } from "@/services/DashboardService";
import type { Category } from "@/models";
import { formatCurrency } from "@/lib/format";

const PALETTE = ["#EF4444","#F97316","#EAB308","#22C55E","#14B8A6","#3B82F6","#6366F1","#7C3AED","#EC4899","#64748B"];

export function ExpensesByCategoryWidget({
  data,
  categories,
}: {
  data: CategoryBreakdown[];
  categories: Category[];
}) {
  const map = Object.fromEntries(categories.map((c) => [c.id, c]));
  const chart = data.map((d, i) => ({
    name: d.categoryId ? map[d.categoryId]?.name ?? "Sem categoria" : "Sem categoria",
    value: d.amount,
    color: (d.categoryId && map[d.categoryId]?.color) || PALETTE[i % PALETTE.length],
  }));

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Despesas por categoria
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          {chart.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Nenhuma despesa no mês.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chart} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {chart.map((c, i) => (
                    <Cell key={i} fill={c.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
