// Widget genérico de composição (valor absoluto + percentual) para
// Receitas por Categoria / Subcategoria.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import type { BreakdownItem } from "@/services/DashboardService";
import { formatCurrency } from "@/lib/format";

const PALETTE = [
  "#22C55E", "#14B8A6", "#3B82F6", "#6366F1", "#7C3AED",
  "#EC4899", "#F97316", "#EAB308", "#64748B", "#0EA5E9",
];

export interface BreakdownLookupItem {
  id: string;
  name: string;
  color?: string | null;
}

export function IncomeBreakdownWidget({
  title,
  data,
  lookup,
  emptyLabel = "Nenhuma receita no período.",
}: {
  title: string;
  data: BreakdownItem[];
  lookup: BreakdownLookupItem[];
  emptyLabel?: string;
}) {
  const map = Object.fromEntries(lookup.map((l) => [l.id, l]));
  const rows = data.map((d, i) => ({
    name: d.id ? (map[d.id]?.name ?? "Sem classificação") : "Sem classificação",
    value: d.amount,
    percent: d.percent,
    color: (d.id && map[d.id]?.color) || PALETTE[i % PALETTE.length],
  }));

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            {emptyLabel}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={rows}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={45}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {rows.map((r, i) => (
                      <Cell key={i} fill={r.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-2 self-center text-sm">
              {rows.slice(0, 8).map((r, i) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: r.color }}
                    />
                    <span className="truncate">{r.name}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {formatCurrency(r.value)}{" "}
                    <span className="text-muted-foreground">({r.percent.toFixed(1)}%)</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
