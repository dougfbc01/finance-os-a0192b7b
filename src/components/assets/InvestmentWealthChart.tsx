import { ResponsiveContainer, ComposedChart, Line, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { formatCurrency } from "@/lib/format";
import type { wealthChartView } from "@/services/InvestmentViewService";

type WealthSeries = ReturnType<typeof wealthChartView> & { key: string; label: string };
const dateLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
const fullDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("pt-BR");

function WealthTooltip({ active, payload, currency }: {
  active?: boolean;
  payload?: { payload?: WealthSeries["data"][number] }[];
  currency: string;
}) {
  const point = payload?.find((item) => item.payload)?.payload;
  if (!active || !point) return null;
  const value = point.complete ?? point.calculable;
  return <div className="max-w-80 space-y-2 rounded-md border bg-popover p-3 text-sm text-popover-foreground shadow-md">
    <p className="font-medium">{fullDate(point.date)}</p>
    <p>{point.complete !== null ? "Patrimônio completo" : "Patrimônio parcial"}: {value !== null ? formatCurrency(value, currency) : "—"}</p>
    <p>{point.valuedAssets} posições avaliadas · {point.missing} ativos sem dados</p>
    {point.missingNames.length > 0 && <p>Sem avaliação: {point.missingNames.join(", ")}</p>}
    {point.staleNames.length > 0 && <p>Cotação anterior: {point.staleNames.join(", ")}</p>}
    {point.coverageAdded.length > 0 && <p>Passaram a ter avaliação: {point.coverageAdded.join(", ")}. A inclusão não representa ganho.</p>}
    {point.coverageRemoved.length > 0 && <p>Perderam avaliação: {point.coverageRemoved.join(", ")}. A exclusão não representa perda.</p>}
  </div>;
}

export function InvestmentWealthChart({ series, currency, color }: { series: WealthSeries; currency: string; color: string }) {
  return <div className="min-w-0 space-y-2">
    <h2 className="text-base font-semibold">Evolução do patrimônio investido · {series.label} · {currency}</h2>
    <p className="text-xs text-muted-foreground">Completo em {series.completeDates} datas · parcial em {series.calculableDates} · sem dados em {series.unavailableDates}</p>
    <div className="h-72" role="img" aria-label={`Gráfico de evolução do patrimônio investido — ${series.label}`}>
      {series.completeDates + series.calculableDates > 0 ? <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={series.data} margin={{ top: 10, right: 15, left: 15, bottom: 5 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="date" tickFormatter={dateLabel} fontSize={11} minTickGap={30} />
          <YAxis tickFormatter={(v) => formatCurrency(v, currency)} width={90} fontSize={11} />
          <Tooltip content={<WealthTooltip currency={currency} />} />
          <Legend />
          <Line dataKey="complete" name="Completo" stroke={color} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
          <Scatter dataKey="calculable" name="Parcial · cobertura variável" fill="var(--muted-foreground)" line={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer> : <div className="flex h-full items-center justify-center border-y px-4 text-center text-sm text-muted-foreground">Nenhuma posição deste grupo tem cotação ou avaliação no período. Consulte os dados faltantes acima.</div>}
    </div>
    {series.calculableDates > 0 && <p className="text-xs text-muted-foreground">Os pontos parciais incluem apenas posições com avaliação e não representam a carteira inteira. Mudanças de cobertura não são ganhos ou perdas; variações de patrimônio também podem incluir compras, vendas e eventos.</p>}
    {series.coverageChanges.length > 0 && <details className="text-sm text-muted-foreground">
      <summary className="cursor-pointer">Mudanças na cobertura de avaliações ({series.coverageChanges.length})</summary>
      <ul className="mt-2 space-y-2">{series.coverageChanges.map((change) => <li key={change.date}>
        <span className="font-medium">{fullDate(change.date)}</span>
        {change.added.length > 0 && <p>Passaram a ter avaliação ({change.added.length}): {change.added.join(", ")}. Essas posições já existiam ou não tinham histórico suficiente; sua inclusão não comprova valorização.</p>}
        {change.removed.length > 0 && <p>Ficaram sem avaliação ({change.removed.length}): {change.removed.join(", ")}. A exclusão não comprova desvalorização.</p>}
      </li>)}</ul>
    </details>}
  </div>;
}