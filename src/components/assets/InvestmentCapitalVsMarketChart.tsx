import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import type { CapitalVsMarketMonth } from "@/services/InvestmentAnalysisService";

const monthLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
const amount = (value: number | null, currency: string) => value === null ? "—" : formatCurrency(value, currency);
const percent = (value: number | null) => value === null ? "—" : `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const coverage = (row: CapitalVsMarketMonth) => `${row.ativosAvaliados} de ${row.ativosComPosicao} ativos avaliados a mercado`;

function MonthTooltip({ active, payload }: { active?: boolean; payload?: { payload?: CapitalVsMarketMonth }[] }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return <div className="max-w-80 space-y-2 rounded-md border bg-popover p-3 text-sm text-popover-foreground shadow-md">
    <p className="font-semibold">{monthLabel(row.date)}</p>
    <p>Capital total: {amount(row.capitalTotal, row.currency)}</p>
    <p>Mercado avaliado: {amount(row.valorMercadoAvaliados, row.currency)}</p>
    <p>Capital dos avaliados: {amount(row.custoAvaliados, row.currency)}</p>
    <p>Ganho/perda não realizado: {amount(row.ganhoNaoRealizado, row.currency)} · {percent(row.ganhoPct)}</p>
    <p>{coverage(row)}</p>
    <p>Capital somente a custo: {amount(row.capitalSomenteCusto, row.currency)}</p>
    {row.ativosSemHistorico > 0 && <p className="text-muted-foreground">{row.ativosSemHistorico} ativos sem histórico suficiente, fora do capital.</p>}
  </div>;
}

export function InvestmentCapitalVsMarketChart({ rows, currency, isLoading, error }: {
  rows: CapitalVsMarketMonth[]; currency: string; isLoading: boolean; error: unknown;
}) {
  return <section className="min-w-0 space-y-4" aria-label="Comparativo mensal de capital e mercado">
    <h2 className="text-base font-semibold">Capital investido × Valor de mercado · {currency}</h2>
    <p className="text-sm text-muted-foreground">Ativos sem cotação no mês entram somente no capital. O ganho/perda compara mercado e custo apenas dos mesmos ativos avaliados.</p>
    {isLoading ? <p className="text-sm text-muted-foreground" role="status">Carregando comparativo mensal…</p>
      : error ? <p className="text-sm text-destructive" role="alert">Não foi possível carregar o comparativo mensal.</p>
      : rows.length === 0 ? <p className="text-sm text-muted-foreground">Sem histórico de movimentações no período selecionado.</p>
      : <>
        <div className="h-80 min-w-0" role="img" aria-label="Gráfico mensal de capital investido e valor de mercado">
          <ResponsiveContainer width="100%" height="100%"><LineChart data={rows} margin={{ top: 10, right: 15, bottom: 10, left: 10 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={monthLabel} fontSize={11} minTickGap={35} />
            <YAxis tickFormatter={(v: number) => formatCurrency(v, currency)} width={95} fontSize={11} />
            <Tooltip content={<MonthTooltip />} /><Legend />
            <Line dataKey="capitalTotal" name="Capital investido (total)" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />
            <Line dataKey="valorMercadoAvaliados" name="Valor de mercado (ativos avaliados)" stroke="var(--chart-2)" strokeWidth={2} dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />
            <Line dataKey="custoAvaliados" name="Capital dos ativos avaliados" stroke="var(--chart-3)" strokeDasharray="5 4" strokeWidth={2} dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />
          </LineChart></ResponsiveContainer>
        </div>
        <details className="border-y py-3"><summary className="cursor-pointer text-sm font-medium">Comparativo mensal · cobertura e valores</summary>
          <div className="mt-3 overflow-x-auto"><Table>
            <TableHeader><TableRow><TableHead>Mês / referência</TableHead><TableHead>Capital total</TableHead><TableHead>Mercado avaliado</TableHead><TableHead>Capital dos avaliados</TableHead><TableHead>Ganho/perda não realizado</TableHead><TableHead>%</TableHead><TableHead>Cobertura</TableHead><TableHead>Capital somente a custo</TableHead><TableHead>Sem histórico</TableHead></TableRow></TableHeader>
            <TableBody>{rows.map((row) => <TableRow key={`${row.currency}:${row.month}`}>
              <TableCell className="whitespace-nowrap">{monthLabel(row.date)}<span className="block text-xs text-muted-foreground">{new Date(`${row.date}T12:00:00Z`).toLocaleDateString("pt-BR")}</span></TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">{amount(row.capitalTotal, currency)}</TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">{amount(row.valorMercadoAvaliados, currency)}</TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">{amount(row.custoAvaliados, currency)}</TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">{amount(row.ganhoNaoRealizado, currency)}</TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">{percent(row.ganhoPct)}</TableCell>
              <TableCell className="min-w-48">{coverage(row)}</TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">{amount(row.capitalSomenteCusto, currency)}</TableCell>
              <TableCell>{row.ativosSemHistorico}</TableCell>
            </TableRow>)}</TableBody>
          </Table></div>
        </details>
      </>}
  </section>;
}