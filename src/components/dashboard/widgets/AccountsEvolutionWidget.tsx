// Evolução do saldo das contas: consolidado ou uma conta específica.
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import type { AccountBalancePoint } from "@/services/DashboardService";
import type { Account } from "@/models";
import { formatCurrency } from "@/lib/format";

const PALETTE = ["#3B82F6", "#22C55E", "#F97316", "#7C3AED", "#EC4899", "#14B8A6", "#EAB308"];

export function AccountsEvolutionWidget({
  data,
  accounts,
}: {
  data: AccountBalancePoint[];
  accounts: Account[];
}) {
  const [selected, setSelected] = useState<string>("ALL");

  const chart = data.map((p) => ({
    label: p.label,
    total: p.total,
    ...Object.fromEntries(accounts.map((a) => [a.id, p.byAccount[a.id] ?? 0])),
  }));

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Evolução das contas
        </CardTitle>
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas as contas</SelectItem>
            <SelectItem value="CONSOLIDATED">Somente consolidado</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" fontSize={12} />
              <YAxis fontSize={12} width={90} tickFormatter={(v) => formatCurrency(v)} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
              {selected !== "CONSOLIDATED" && selected !== "ALL" ? null : (
                <Line
                  type="monotone"
                  dataKey="total"
                  name="Consolidado"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
              )}
              {accounts
                .filter((a) => (selected === "ALL" ? true : selected === a.id))
                .map((a, i) => (
                  <Line
                    key={a.id}
                    type="monotone"
                    dataKey={a.id}
                    name={a.name}
                    stroke={PALETTE[i % PALETTE.length]}
                    strokeWidth={1.5}
                    dot={false}
                  />
                ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
