import { useMemo, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useInvestmentAnalysis } from "@/hooks/useInvestmentAnalysis";
import { InvestmentMonthlyTable } from "./InvestmentMonthlyTable";
import { summarizeInvestments } from "@/services/InvestmentAnalysisService";
import type { InvestmentRow } from "@/services/InvestmentService";
import type { Movement } from "@/models";
import { formatCurrency } from "@/lib/format";
import { historicalChartView, investmentPeriodStart, limitationSummary, validInvestmentRange, wealthChartView } from "@/services/InvestmentViewService";

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
  const [hiddenGroups, setHiddenGroups] = useState<string[]>([]);
  const [wealthMode, setWealthMode] = useState("TOTAL");
  const groups = summarizeInvestments(rows.filter((r) => r.asset.currency === currency));
  const selectedGroup = group === "ALL" || groups.some((g) => g.key === group) ? group : "ALL";
  const range = useMemo(() => {
    if (period === "CUSTOM") return { from: customFrom, to: customTo };
    const from = investmentPeriodStart(today, period === "1M" ? 1 : period === "3M" ? 3 : period === "6M" ? 6 : 12);
    const assetIds = new Set(rows.filter((r) => r.asset.currency === currency && (selectedGroup === "ALL" || r.asset.asset_type + "_" + currency === selectedGroup)).map((r) => r.asset.id));
    const first = movements.filter((m) => m.asset_id && assetIds.has(m.asset_id) && !m.deleted_at).map((m) => m.transaction_date).sort()[0];
    return { from: period === "MAX" ? first ?? today : from, to: today };
  }, [period, today, customFrom, customTo, movements, rows, currency, selectedGroup]);
  const queryClient = useQueryClient();
  // ALL is scoped to currency before aggregation; amounts in different currencies are never added.
  const analysis = useInvestmentAnalysis(workspaceId, movements, range.from, range.to, selectedGroup, currency);
  const visibleGroups = groups.filter((g) => (selectedGroup === "ALL" || g.key === selectedGroup) && (selectedGroup !== "ALL" || !hiddenGroups.includes(g.key)));
  const chart = historicalChartView(analysis.points, visibleGroups.map((g) => g.key));
  const chartData = chart.data;
  const returnGroups = visibleGroups.filter((g) => chart.returnKeys.includes(g.key));
  const composition = groups.filter((g) => g.current > 0);
  const wealthSeries = selectedGroup !== "ALL" ? [{ key: selectedGroup, label: groups.find((g) => g.key === selectedGroup)?.label ?? "Grupo" }]
    : wealthMode === "TOTAL" ? [{ key: "TOTAL", label: "Total consolidado" }] : groups;
  const wealthCharts = wealthSeries.map((series) => ({ ...series, ...wealthChartView(analysis.points, series.key) }));
  const hasReturns = returnGroups.length > 0;
  const incomplete = analysis.points.some((p) => p.missingAssets > 0);
  const validRange = validInvestmentRange(range.from, range.to, today);
  const limitations = limitationSummary(analysis.points);
  const missingDates = analysis.points.filter((p) => p.missingAssets > 0).length;
  const completeDates = analysis.points.length - missingDates;
  const calculableDates = analysis.points.filter((p) => p.missingAssets > 0 && typeof p.calculableValue === "number").length;
  const carriedPrices = analysis.points.some((p) => p.carriedPrices.length > 0);
  const fmtDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("pt-BR");
  const fetchResult = analysis.completeHistory.data;
  const providerNotes = [...new Set((fetchResult ?? []).map((r) => r.message).filter((m): m is string => !!m))];
  const groupColor = (key: string) => colors[Math.max(0, groups.findIndex((g) => g.key === key)) % colors.length];
  return <section className="space-y-6" aria-label="Análise de investimentos">
    <div className="flex flex-wrap items-end gap-3 border-b pb-5">
      <div className="space-y-2"><Label>Período</Label><Select value={period} onValueChange={setPeriod}><SelectTrigger aria-label="Período" className="w-44"><SelectValue /></SelectTrigger><SelectContent>{[["1M", "1 mês"], ["3M", "3 meses"], ["6M", "6 meses"], ["1A", "1 ano"], ["MAX", "Desde o início"], ["CUSTOM", "Personalizado"]].map(([v, label]) => <SelectItem key={v} value={v}>{label}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label>Grupo</Label><Select value={selectedGroup} onValueChange={setGroup}><SelectTrigger aria-label="Grupo" className="w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Todos os grupos</SelectItem>{groups.map((g) => <SelectItem key={g.key} value={g.key}>{g.label}</SelectItem>)}</SelectContent></Select></div>
      {currencies.length > 1 && <div className="space-y-2"><Label>Moeda</Label><Select value={currency} onValueChange={setCurrency}><SelectTrigger aria-label="Moeda" className="w-24"><SelectValue /></SelectTrigger><SelectContent>{currencies.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>}
      {period === "CUSTOM" && <><div className="space-y-2"><Label htmlFor="analysis-from">De</Label><Input id="analysis-from" type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} className="w-40" /></div><div className="space-y-2"><Label htmlFor="analysis-to">Até</Label><Input id="analysis-to" type="date" value={customTo} min={customFrom} max={today} onChange={(e) => setCustomTo(e.target.value)} className="w-40" /></div></>}
      {selectedGroup === "ALL" && <div className="space-y-2"><Label>Patrimônio</Label><Select value={wealthMode} onValueChange={setWealthMode}><SelectTrigger aria-label="Visão do patrimônio" className="w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="TOTAL">Total consolidado</SelectItem><SelectItem value="TYPES">Por tipo de investimento</SelectItem></SelectContent></Select></div>}
      <Button variant="outline" size="icon" aria-label="Reler histórico salvo" title="Reler histórico salvo" onClick={() => void queryClient.invalidateQueries({ queryKey: ["investment-analysis-prices", workspaceId] })}><RefreshCw className="h-4 w-4" /></Button>
      <Button variant="outline" disabled={!validRange || analysis.completeHistory.isPending} onClick={() => analysis.completeHistory.mutate()}>{analysis.completeHistory.isPending ? "Buscando cotações…" : "Buscar cotações mensais desde a primeira movimentação"}</Button>
    </div>
    {groups.length > 1 && selectedGroup === "ALL" && <fieldset className="space-y-3"><legend className="text-sm font-medium">Comparar rentabilidade</legend><div className="flex flex-wrap gap-x-5 gap-y-3">{groups.map((g) => <Label key={g.key} className="flex items-center gap-2"><Checkbox checked={!hiddenGroups.includes(g.key)} onCheckedChange={(checked) => setHiddenGroups((current) => checked === true ? current.filter((key) => key !== g.key) : [...current, g.key])} aria-label={`Comparar ${g.label}`} />{g.label}</Label>)}</div></fieldset>}
    {!validRange ? <p className="text-sm text-destructive" role="alert">Selecione um período válido até a data atual.</p> : analysis.isLoading ? <p className="text-sm text-muted-foreground">Carregando histórico…</p> : analysis.error ? <p className="text-sm text-destructive" role="alert">Não foi possível carregar o histórico salvo. Tente novamente.</p> : <>
      {fetchResult && <div className="space-y-1 text-sm text-muted-foreground" role="status"><p>Cotações consultadas para {fetchResult.length} ativos: {fetchResult.filter((r) => r.status === "OK").length} com histórico, {fetchResult.filter((r) => r.status !== "OK").length} sem retorno do provedor.</p>{providerNotes.map((m) => <p key={m}>{m}</p>)}</div>}
      {analysis.completeHistory.isError && <p className="text-sm text-destructive" role="alert">Não foi possível buscar as cotações históricas. As cotações já salvas foram mantidas.</p>}
      {limitations.length > 0 && <div className="space-y-2 border-l-2 border-border pl-3 text-sm text-muted-foreground" role="status"><p>{incomplete ? `Patrimônio completo em ${completeDates} de ${analysis.points.length} datas; patrimônio parcial (somente posições com cotação ou avaliação) em ${calculableDates} datas.` : "Há ativos com custo histórico indeterminado."} O valor parcial não representa a carteira inteira; ativos sem dados não entram como zero.</p><details><summary className="cursor-pointer">Dados faltantes por ativo ({new Set(limitations.map((l) => l.assetId)).size})</summary><ul className="mt-2 space-y-1">{limitations.map((l) => <li key={`${l.assetId}:${l.reason}`}>{l.name} — {l.reason === "NO_HISTORY" ? "faltam movimentos de posição ou quantidades nas compras/saídas" : l.reason === "NO_PRICE" ? "falta cotação histórica salva na data ou antes dela" : l.reason === "NO_VALUATION" ? "falta avaliação histórica registrada (aportes não comprovam o valor da posição)" : "falta base de custo comprovada; rentabilidade indisponível"} · {l.dates} {l.dates === 1 ? "data" : "datas"} ({fmtDate(l.first)}{l.first !== l.last ? ` a ${fmtDate(l.last)}` : ""})</li>)}</ul></details></div>}
      {chart.isolatedReturns.length > 0 && <div className="text-sm text-muted-foreground" role="status">{chart.isolatedReturns.map(({ key, date }) => <p key={key}>{groups.find((g) => g.key === key)?.label} — apenas uma observação válida, em {new Date(`${date}T12:00:00Z`).toLocaleDateString("pt-BR")}. O ponto representa essa data, não uma evolução; faltam cotações ou avaliações válidas nas demais datas do período.</p>)}</div>}
      {carriedPrices && <p className="text-sm text-muted-foreground">Cada data usa a última cotação salva até aquele dia, que pode ser anterior. Não há interpolação nem uso de preços futuros. Rentabilidade da posição não representa retorno acumulado com distribuições.</p>}
      <div className="grid gap-8 xl:grid-cols-2">
        <div className="min-w-0 space-y-6">{wealthCharts.map((series) => <div key={series.key} className="min-w-0 space-y-2"><h2 className="text-base font-semibold">Evolução do patrimônio investido · {series.label} · {currency}</h2><p className="text-xs text-muted-foreground">Completo em {series.completeDates} datas · parcial em {series.calculableDates} · sem dados em {series.unavailableDates}</p><div className="h-72" role="img" aria-label={`Gráfico de evolução do patrimônio investido — ${series.label}`}>{series.completeDates + series.calculableDates > 0 ? <ResponsiveContainer width="100%" height="100%"><LineChart data={series.data} margin={{ top: 10, right: 15, left: 15, bottom: 5 }}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={dateLabel} fontSize={11} minTickGap={30} /><YAxis tickFormatter={(v) => formatCurrency(v, currency)} width={90} fontSize={11} /><Tooltip labelFormatter={(v) => fmtDate(String(v))} formatter={(v: number, name: string, item: { payload?: { missing?: number } }) => [typeof v === "number" && Number.isFinite(v) ? formatCurrency(v, currency) + (name === "Parcial" ? ` · ${item.payload?.missing ?? 0} ativo(s) sem dados` : "") : "—", name]} /><Legend /><Line dataKey="complete" name="Completo" stroke={series.key === "TOTAL" ? "var(--chart-2)" : groupColor(series.key)} strokeWidth={2} dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} /><Line dataKey="calculable" name="Parcial" stroke="var(--muted-foreground)" strokeDasharray="4 3" strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false} /></LineChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center border-y px-4 text-center text-sm text-muted-foreground">Nenhuma posição deste grupo tem cotação ou avaliação no período. Consulte os dados faltantes acima.</div>}</div></div>)}</div>
        <div className="min-w-0 space-y-4"><h2 className="text-base font-semibold">Rentabilidade da posição por grupo</h2><div className="h-72" role="img" aria-label="Gráfico de rentabilidade por grupo">{hasReturns ? <ResponsiveContainer width="100%" height="100%"><LineChart data={chartData}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={dateLabel} fontSize={11} minTickGap={30} /><YAxis tickFormatter={(v) => `${v}%`} width={65} fontSize={11} /><Tooltip formatter={(v: number) => typeof v === "number" && Number.isFinite(v) ? `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%` : "—"} labelFormatter={(v) => new Date(`${v}T12:00:00Z`).toLocaleDateString("pt-BR")} /><Legend />{returnGroups.map((g) => <Line key={g.key} dataKey={g.key} name={g.label} stroke={groupColor(g.key)} strokeWidth={2} dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />)}</LineChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center border-y text-sm text-muted-foreground">{visibleGroups.length === 0 ? "Nenhum grupo selecionado para comparação." : "Rentabilidade histórica indisponível: faltam preços ou base de custo comprovada no período."}</div>}</div></div>
      </div>
      <InvestmentMonthlyTable rows={analysis.monthlyBase} />
    </>}
    <div className="space-y-4 border-t pt-6"><h2 className="text-base font-semibold">Composição atual da carteira · {currency}</h2><div className="grid items-center gap-6 md:grid-cols-[280px_1fr]">
      <div className="h-64" role="img" aria-label="Gráfico de composição atual por grupo">{composition.length > 0 ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={composition} dataKey="current" nameKey="label" innerRadius={65} outerRadius={95} paddingAngle={2} isAnimationActive={false}>{composition.map((g) => <Cell key={g.key} fill={groupColor(g.key)} />)}</Pie><Tooltip formatter={(v: number) => typeof v === "number" && Number.isFinite(v) ? formatCurrency(v, currency) : "—"} /></PieChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem valores disponíveis.</div>}</div>
      <div className="divide-y">{groups.map((g) => <div key={g.key} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="min-w-0 break-words font-medium">{g.label}</span><div className="flex flex-wrap gap-5 text-sm tabular-nums"><span>{formatCurrency(g.current, currency)}</span><span className="w-20 text-right text-muted-foreground">{g.participation.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</span></div></div>)}</div>
    </div></div>
  </section>;
}