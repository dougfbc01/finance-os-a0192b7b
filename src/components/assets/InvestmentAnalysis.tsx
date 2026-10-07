import { useMemo, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useInvestmentAnalysis } from "@/hooks/useInvestmentAnalysis";
import { summarizeInvestments } from "@/services/InvestmentAnalysisService";
import type { InvestmentRow } from "@/services/InvestmentService";
import type { Movement } from "@/models";
import { formatCurrency } from "@/lib/format";

const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const dateLabel = (v: string) => new Date(`${v}T12:00:00Z`).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });

export function InvestmentAnalysis({ workspaceId, rows, movements }: { workspaceId: string | undefined; rows: InvestmentRow[]; movements: Movement[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const [period, setPeriod] = useState("1A");
  const [customFrom, setCustomFrom] = useState(today.slice(0, 4) + "-01-01");
  const [customTo, setCustomTo] = useState(today);
  const currencies = [...new Set(rows.map((r) => r.asset.currency))];
  const [selectedCurrency, setCurrency] = useState("BRL");
  const currency = currencies.includes(selectedCurrency) ? selectedCurrency : currencies[0] ?? "BRL";
  const [group, setGroup] = useState("ALL");
  const groups = summarizeInvestments(rows.filter((r) => r.asset.currency === currency));
  const selectedGroup = group === "ALL" || groups.some((g) => g.key === group) ? group : "ALL";
  const range = useMemo(() => {
    if (period === "CUSTOM") return { from: customFrom, to: customTo };
    const date = new Date(`${today}T12:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() - (period === "1M" ? 1 : period === "3M" ? 3 : period === "6M" ? 6 : 12));
    const first = movements.filter((m) => m.asset_id && !m.deleted_at).map((m) => m.transaction_date).sort()[0];
    return { from: period === "MAX" ? first ?? today : date.toISOString().slice(0, 10), to: today };
  }, [period, today, customFrom, customTo, movements]);
  const queryClient = useQueryClient();
  // ALL is scoped to currency before aggregation; amounts in different currencies are never added.
  const analysis = useInvestmentAnalysis(workspaceId, movements, range.from, range.to, selectedGroup, currency);
  const visibleGroups = groups.filter((g) => selectedGroup === "ALL" || g.key === selectedGroup);
  const chartData = analysis.points.map((p) => ({ date: p.date, value: p.value, ...p.returns }));
  const composition = visibleGroups.filter((g) => g.current > 0);
  const hasValues = analysis.points.some((p) => p.value !== null);
  const hasReturns = analysis.points.some((p) => Object.values(p.returns).some((v) => v !== null));
  const incomplete = analysis.points.some((p) => p.missingAssets > 0);
  const validRange = !!range.from && !!range.to && range.from <= range.to && range.to <= today;
  return <section className="space-y-6" aria-label="Análise de investimentos">
    <div className="flex flex-wrap items-end gap-3 border-b pb-5">
      <div className="space-y-2"><Label>Período</Label><Select value={period} onValueChange={setPeriod}><SelectTrigger aria-label="Período" className="w-44"><SelectValue /></SelectTrigger><SelectContent>{[["1M", "1 mês"], ["3M", "3 meses"], ["6M", "6 meses"], ["1A", "1 ano"], ["MAX", "Desde o início"], ["CUSTOM", "Personalizado"]].map(([v, label]) => <SelectItem key={v} value={v}>{label}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label>Grupo</Label><Select value={selectedGroup} onValueChange={setGroup}><SelectTrigger aria-label="Grupo" className="w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Todos os grupos</SelectItem>{groups.map((g) => <SelectItem key={g.key} value={g.key}>{g.label}</SelectItem>)}</SelectContent></Select></div>
      {currencies.length > 1 && <div className="space-y-2"><Label>Moeda</Label><Select value={currency} onValueChange={setCurrency}><SelectTrigger aria-label="Moeda" className="w-24"><SelectValue /></SelectTrigger><SelectContent>{currencies.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>}
      {period === "CUSTOM" && <><div className="space-y-2"><Label htmlFor="analysis-from">De</Label><Input id="analysis-from" type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} className="w-40" /></div><div className="space-y-2"><Label htmlFor="analysis-to">Até</Label><Input id="analysis-to" type="date" value={customTo} min={customFrom} max={today} onChange={(e) => setCustomTo(e.target.value)} className="w-40" /></div></>}
      <Button variant="outline" size="icon" aria-label="Reler histórico salvo" title="Reler histórico salvo" onClick={() => void queryClient.invalidateQueries({ queryKey: ["investment-analysis-prices", workspaceId] })}><RefreshCw className="h-4 w-4" /></Button>
    </div>
    {!validRange ? <p className="text-sm text-destructive" role="alert">Selecione um período válido até a data atual.</p> : analysis.isLoading ? <p className="text-sm text-muted-foreground">Carregando histórico…</p> : analysis.error ? <p className="text-sm text-destructive" role="alert">Não foi possível carregar o histórico salvo. Tente novamente.</p> : <>
      {incomplete && <p className="border-l-2 border-border pl-3 text-sm text-muted-foreground">Histórico incompleto: há datas sem cotação salva ou ativos sem avaliação histórica. Valores indisponíveis não entram como zero.</p>}
      <div className="grid gap-8 xl:grid-cols-2">
        <div className="min-w-0 space-y-4"><h2 className="text-base font-semibold">Evolução do patrimônio investido · {currency}</h2><div className="h-72" role="img" aria-label="Gráfico de evolução do patrimônio investido">{hasValues ? <ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 10, right: 15, left: 15, bottom: 5 }}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={dateLabel} fontSize={11} minTickGap={30} /><YAxis tickFormatter={(v) => formatCurrency(v, currency)} width={90} fontSize={11} /><Tooltip labelFormatter={(v) => new Date(`${v}T12:00:00Z`).toLocaleDateString("pt-BR")} formatter={(v: number) => formatCurrency(v, currency)} /><Line dataKey="value" name="Patrimônio investido" stroke="var(--chart-2)" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} /></LineChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center border-y text-sm text-muted-foreground">Histórico patrimonial indisponível no período.</div>}</div></div>
        <div className="min-w-0 space-y-4"><h2 className="text-base font-semibold">Rentabilidade da posição por grupo</h2><div className="h-72" role="img" aria-label="Gráfico de rentabilidade por grupo">{hasReturns ? <ResponsiveContainer width="100%" height="100%"><LineChart data={chartData}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={dateLabel} fontSize={11} minTickGap={30} /><YAxis tickFormatter={(v) => `${v}%`} width={65} fontSize={11} /><Tooltip formatter={(v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`} labelFormatter={(v) => new Date(`${v}T12:00:00Z`).toLocaleDateString("pt-BR")} /><Legend />{visibleGroups.map((g, i) => <Line key={g.key} dataKey={g.key} name={g.label} stroke={colors[i % colors.length]} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />)}</LineChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center border-y text-sm text-muted-foreground">Rentabilidade histórica indisponível no período.</div>}</div></div>
      </div>
    </>}
    <div className="space-y-4 border-t pt-6"><h2 className="text-base font-semibold">Composição atual da carteira · {currency}</h2><div className="grid items-center gap-6 md:grid-cols-[280px_1fr]">
      <div className="h-64" role="img" aria-label="Gráfico de composição atual por grupo">{composition.length > 0 ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={composition} dataKey="current" nameKey="label" innerRadius={65} outerRadius={95} paddingAngle={2} isAnimationActive={false}>{composition.map((g, i) => <Cell key={g.key} fill={colors[i % colors.length]} />)}</Pie><Tooltip formatter={(v: number) => formatCurrency(v, currency)} /></PieChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem valores disponíveis.</div>}</div>
      <div className="divide-y">{visibleGroups.map((g) => <div key={g.key} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="font-medium">{g.label}</span><div className="flex gap-5 text-sm tabular-nums"><span>{formatCurrency(g.current, currency)}</span><span className="w-20 text-right text-muted-foreground">{g.participation.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</span></div></div>)}</div>
    </div></div>
  </section>;
}