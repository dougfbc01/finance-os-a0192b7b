import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/format";

export function ClosingTrendChart({ data }: { data: { key: string; label: string; result: number; netWorth: number }[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="label" fontSize={12} />
          <YAxis yAxisId="r" fontSize={12} tickFormatter={(v) => formatCurrency(Number(v))} width={90} />
          <YAxis yAxisId="n" orientation="right" fontSize={12} tickFormatter={(v) => formatCurrency(Number(v))} width={100} />
          <Tooltip formatter={(v) => formatCurrency(Number(v))} />
          <Legend />
          <Bar yAxisId="r" dataKey="result" name="Resultado" fill="var(--color-chart-2)" />
          <Line yAxisId="n" dataKey="netWorth" name="Patrimônio" stroke="var(--color-chart-1)" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
