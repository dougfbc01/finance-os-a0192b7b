import { useState } from "react";
import { ResponsiveContainer, AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { UNVALUED_AT_COST_BAND, type WealthByTypePoint, type WealthBandOrigin } from "@/services/InvestmentAnalysisService";
import { wealthByTypeChartView } from "@/services/InvestmentViewService";

const TYPE_COLORS: Record<string, string> = {
  ACAO: "var(--chart-acao)", FII: "var(--chart-fii)", ETF: "var(--chart-etf)", BDR: "var(--chart-bdr)",
  CRIPTO: "var(--chart-cripto)", PREVIDENCIA: "var(--chart-variavel-outros)", FUNDO: "var(--chart-variavel-outros)",
  TESOURO: "var(--chart-rf-1)", CDB: "var(--chart-rf-2)", POUPANCA: "var(--chart-rf-3)", LCI: "var(--chart-rf-4)",
  LCA: "var(--chart-rf-4)", RENDA_FIXA: "var(--chart-rf-5)", DEBENTURE: "var(--chart-rf-5)",
};
/** Color by asset type (group key = TYPE_CURRENCY): variable income distinct hues, fixed income one teal family. */
export const investmentTypeColor = (key: string) => TYPE_COLORS[key.replace(/_[A-Z]{3}$/, "")] ?? "var(--chart-variavel-outros)";

const ORIGIN_LABEL: Record<WealthBandOrigin, string | null> = { MARKET: null, ACCOUNT: "Conta (conciliado)", COST: "A custo" };
const dateLabel = (v: string) => new Date(`${v}T12:00:00Z`).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });

type Datum = Record<string, unknown> & { date: string; total: number; coveragePct: number | null; excludedAssets: number; excludedNames: string[] };

export function InvestmentWealthByTypeChart({ points, groups, currency }: { points: WealthByTypePoint[]; groups: { key: string; label: string }[]; currency: string }) {
  const [mode, setMode] = useState<"stacked" | "lines">("stacked");
  const view = wealthByTypeChartView(points, groups.map((g) => g.key));
  const label = (key: string) => {
    if (key === UNVALUED_AT_COST_BAND) return "Sem avaliação (a custo)";
    const base = groups.find((g) => g.key === key)?.label ?? key;
    const origin = (view.origins[key] ?? []).map((o) => ORIGIN_LABEL[o]).filter(Boolean);
    return origin.length ? `${base} — ${origin.join(" / ")}` : base;
  };
  const bands = [...view.keys, ...(view.hasUnvalued ? [UNVALUED_AT_COST_BAND] : [])];
  const color = (key: string) => key === UNVALUED_AT_COST_BAND ? "var(--chart-unvalued)" : investmentTypeColor(key);
  const money = (v: number) => formatCurrency(v, currency);
  const tooltip = ({ active, payload, label: date }: { active?: boolean; payload?: { dataKey?: string | number; value?: number; payload?: Datum }[]; label?: string }) => {
    const d = payload?.[0]?.payload;
    if (!active || !d || !date) return null;
    return <div className="max-w-80 space-y-1 rounded-md border bg-popover p-3 text-sm text-popover-foreground shadow-md">
      <p className="font-medium">{new Date(`${date}T12:00:00Z`).toLocaleDateString("pt-BR")}</p>
      {bands.filter((k) => Number(d[k] ?? 0) !== 0).map((k) => <p key={k} className="flex justify-between gap-4"><span><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: color(k) }} />{label(k)}</span><span className="tabular-nums">{money(Number(d[k]))}</span></p>)}
      <p className="flex justify-between gap-4 border-t pt-1 font-medium"><span>Total do mês</span><span className="tabular-nums">{money(d.total)}</span></p>
      <p className="text-xs text-muted-foreground">Cobertura: {d.coveragePct === null ? "—" : `${(d.coveragePct * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}% do capital com valor de mercado/conta`} · {d.excludedAssets} {d.excludedAssets === 1 ? "ativo" : "ativos"} fora das faixas por tipo{d.excludedNames.length ? `: ${d.excludedNames.join(", ")}` : ""}</p>
    </div>;
  };
  return <div className="min-w-0 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-base font-semibold">Valor patrimonial por tipo de ativo · {currency}</h2>
      <div className="flex gap-1" role="group" aria-label="Modo do gráfico">
        <Button size="sm" variant={mode === "stacked" ? "default" : "outline"} aria-pressed={mode === "stacked"} onClick={() => setMode("stacked")}>Empilhado</Button>
        <Button size="sm" variant={mode === "lines" ? "default" : "outline"} aria-pressed={mode === "lines"} onClick={() => setMode("lines")}>Linhas</Button>
      </div>
    </div>
    <p className="text-xs text-muted-foreground">Cada faixa soma os ativos do tipo com valor comprovado no mês (última cotação salva no mês, saldo da conta conciliado ou renda fixa a custo). Ativos cotáveis sem nenhuma cotação ficam na faixa "Sem avaliação (a custo)", para o total fechar com o capital; nenhum preço é estimado.</p>
    <div className="h-80" role="img" aria-label="Gráfico de valor patrimonial por tipo de ativo">{bands.length ? <ResponsiveContainer width="100%" height="100%">
      {mode === "stacked"
        ? <AreaChart data={view.data}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={dateLabel} fontSize={11} minTickGap={30} /><YAxis tickFormatter={(v) => money(Number(v)).replace(/,\d{2}$/, "")} width={90} fontSize={11} /><Tooltip content={tooltip} /><Legend />{bands.map((k) => <Area key={k} type="linear" dataKey={k} name={label(k)} stackId="wealth" stroke={color(k)} fill={color(k)} fillOpacity={k === UNVALUED_AT_COST_BAND ? 0.3 : 0.75} strokeDasharray={k === UNVALUED_AT_COST_BAND ? "4 3" : undefined} isAnimationActive={false} />)}</AreaChart>
        : <LineChart data={view.data}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={dateLabel} fontSize={11} minTickGap={30} /><YAxis tickFormatter={(v) => money(Number(v)).replace(/,\d{2}$/, "")} width={90} fontSize={11} /><Tooltip content={tooltip} /><Legend />{bands.map((k) => <Line key={k} type="linear" dataKey={k} name={label(k)} stroke={color(k)} strokeWidth={2} strokeDasharray={k === UNVALUED_AT_COST_BAND ? "4 3" : undefined} dot={false} isAnimationActive={false} />)}</LineChart>}
    </ResponsiveContainer> : <div className="flex h-full items-center justify-center border-y text-sm text-muted-foreground">Sem valores históricos no período.</div>}</div>
  </div>;
}
