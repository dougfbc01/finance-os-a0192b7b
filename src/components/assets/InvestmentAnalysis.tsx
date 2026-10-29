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
import { InvestmentCapitalVsMarketChart } from "./InvestmentCapitalVsMarketChart";
import { B3QuoteHistoryImportDialog } from "./B3QuoteHistoryImportDialog";
import { B3QuoteHistoryImportService } from "@/services/B3QuoteHistoryImportService";
import { accountMirrorRows, GROUP_RETURN_COVERAGE_WARNING, summarizeInvestments } from "@/services/InvestmentAnalysisService";
import type { InvestmentRow } from "@/services/InvestmentService";
import type { Account, Asset, Movement } from "@/models";
import { formatCurrency } from "@/lib/format";
import { historicalChartView, investmentPeriodStart, limitationSummary, validInvestmentRange } from "@/services/InvestmentViewService";

const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const dateLabel = (v: string) => new Date(`${v}T12:00:00Z`).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
type ReturnCoverage = Record<string, { pct: number | null; valued: number; missing: number }>;
type ReturnDatum = { date: string; coverage: ReturnCoverage } & Record<string, number | string | null | ReturnCoverage>;

function ReturnTooltip({ active, payload, label, groups }: {
  active?: boolean;
  payload?: { dataKey?: string | number; value?: number; payload?: ReturnDatum }[];
  label?: string;
  groups: { key: string; label: string }[];
}) {
  if (!active || !payload?.length || !label) return null;
  const entries = payload.filter((entry) => typeof entry.value === "number" && Number.isFinite(entry.value));
  if (!entries.length) return null;
  return <div className="max-w-80 space-y-2 rounded-md border bg-popover p-3 text-sm text-popover-foreground shadow-md">
    <p className="font-medium">{new Date(`${label}T12:00:00Z`).toLocaleDateString("pt-BR")}</p>
    {entries.map((entry) => {
      const key = String(entry.dataKey);
      const coverage = entry.payload?.coverage?.[key];
      const low = coverage && coverage.pct !== null && coverage.pct < GROUP_RETURN_COVERAGE_WARNING;
      return <div key={key}>
        <p>{groups.find((g) => g.key === key)?.label ?? key}: {(entry.value ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</p>
        {coverage && <p className="text-xs text-muted-foreground">
          Cobertura: {coverage.pct === null ? "—" : `${(coverage.pct * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}% do capital do grupo`} · {coverage.valued} avaliados · {coverage.missing} sem avaliação
          {low ? " — cobertura baixa, compare com cautela" : ""}
        </p>}
      </div>;
    })}
  </div>;
}

export function InvestmentAnalysis({ workspaceId, rows, movements, accounts = [], assets = [] }: { workspaceId: string | undefined; rows: InvestmentRow[]; movements: Movement[]; accounts?: Account[]; assets?: Asset[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const [period, setPeriod] = useState("MAX");
  const [customFrom, setCustomFrom] = useState(today.slice(0, 4) + "-01-01");
  const [customTo, setCustomTo] = useState(today);
  // Ativos espelhados em conta (caixinha/CDB) entram na Análise pelo saldo da conta.
  const accountRows = useMemo(() => accountMirrorRows(assets, accounts, movements, today), [assets, accounts, movements, today]);
  const currencies = [...new Set([...rows, ...accountRows].map((r) => r.asset.currency))];
  const [selectedCurrency, setCurrency] = useState("BRL");
  const currency = currencies.includes(selectedCurrency) ? selectedCurrency : currencies[0] ?? "BRL";
  const [group, setGroup] = useState("ALL");
  const [hiddenGroups, setHiddenGroups] = useState<string[]>([]);
  const groups = summarizeInvestments([...rows.filter((r) => r.asset.currency === currency), ...accountRows.filter((r) => r.asset.currency === currency)]);
  const selectedGroup = group === "ALL" || groups.some((g) => g.key === group) ? group : "ALL";
  const range = useMemo(() => {
    if (period === "CUSTOM") return { from: customFrom, to: customTo };
    const from = investmentPeriodStart(today, period === "1M" ? 1 : period === "3M" ? 3 : period === "6M" ? 6 : 12);
    const assetIds = new Set(rows.filter((r) => r.asset.currency === currency && (selectedGroup === "ALL" || r.asset.asset_type + "_" + currency === selectedGroup)).map((r) => r.asset.id));
    const first = movements.filter((m) => m.asset_id && assetIds.has(m.asset_id) && !m.deleted_at).map((m) => m.transaction_date).sort()[0];
    return { from: period === "MAX" ? first ?? today : from, to: today };
  }, [period, today, customFrom, customTo, movements, rows, currency, selectedGroup]);
  const queryClient = useQueryClient();
  const quoteTargets = useMemo(() => B3QuoteHistoryImportService.targetsFrom(rows.map((r) => r.asset), movements), [rows, movements]);
  // ALL is scoped to currency before aggregation; amounts in different currencies are never added.
  const analysis = useInvestmentAnalysis(workspaceId, movements, range.from, range.to, selectedGroup, currency);
  const visibleGroups = groups.filter((g) => (selectedGroup === "ALL" || g.key === selectedGroup) && (selectedGroup !== "ALL" || !hiddenGroups.includes(g.key)));
  const chart = historicalChartView(analysis.points, visibleGroups.map((g) => g.key));
  const chartData = chart.data;
  const returnGroups = visibleGroups.filter((g) => chart.returnKeys.includes(g.key));
  const composition = groups.filter((g) => g.current > 0);
  const hasReturns = returnGroups.length > 0;
  const incomplete = analysis.points.some((p) => p.missingAssets > 0);
  const validRange = validInvestmentRange(range.from, range.to, today);
  const limitations = limitationSummary(analysis.points);
  const carriedPrices = analysis.points.some((p) => p.carriedPrices.length > 0);
  const lowCoverage = chartData.some((point) => Object.values(point.coverage ?? {}).some((c) => c.pct !== null && c.pct < GROUP_RETURN_COVERAGE_WARNING && c.valued > 0));
  const fmtDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("pt-BR");
  const fetchResult = analysis.completeHistory.data;
  const providerNotes = [...new Set((fetchResult ?? []).map((r) => r.message).filter((m): m is string => !!m))];
  const groupColor = (key: string) => colors[Math.max(0, groups.findIndex((g) => g.key === key)) % colors.length];
  const returnDot = (key: string, color: string) => (props: { cx?: number; cy?: number; payload?: ReturnDatum }) => {
    const { cx, cy } = props;
    if (typeof cx !== "number" || typeof cy !== "number") return <g key={`${key}-empty`} />;
    const pct = props.payload?.coverage?.[key]?.pct;
    const hollow = pct !== null && pct !== undefined && pct < GROUP_RETURN_COVERAGE_WARNING;
    return <circle key={`${key}-${cx}-${cy}`} cx={cx} cy={cy} r={3} fill={hollow ? "var(--background)" : color} stroke={color} strokeWidth={2} />;
  };
  return <section className="space-y-6" aria-label="Análise de investimentos">
    <div className="flex flex-wrap items-end gap-3 border-b pb-5">
      <div className="space-y-2"><Label>Período</Label><Select value={period} onValueChange={setPeriod}><SelectTrigger aria-label="Período" className="w-44"><SelectValue /></SelectTrigger><SelectContent>{[["1M", "1 mês"], ["3M", "3 meses"], ["6M", "6 meses"], ["1A", "1 ano"], ["MAX", "Desde o início"], ["CUSTOM", "Personalizado"]].map(([v, label]) => <SelectItem key={v} value={v}>{label}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label>Grupo</Label><Select value={selectedGroup} onValueChange={setGroup}><SelectTrigger aria-label="Grupo" className="w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Todos os grupos</SelectItem>{groups.map((g) => <SelectItem key={g.key} value={g.key}>{g.label}</SelectItem>)}</SelectContent></Select></div>
      {currencies.length > 1 && <div className="space-y-2"><Label>Moeda</Label><Select value={currency} onValueChange={setCurrency}><SelectTrigger aria-label="Moeda" className="w-24"><SelectValue /></SelectTrigger><SelectContent>{currencies.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>}
      {period === "CUSTOM" && <><div className="space-y-2"><Label htmlFor="analysis-from">De</Label><Input id="analysis-from" type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} className="w-40" /></div><div className="space-y-2"><Label htmlFor="analysis-to">Até</Label><Input id="analysis-to" type="date" value={customTo} min={customFrom} max={today} onChange={(e) => setCustomTo(e.target.value)} className="w-40" /></div></>}
      <Button variant="outline" size="icon" aria-label="Reler histórico salvo" title="Reler histórico salvo" onClick={() => void queryClient.invalidateQueries({ queryKey: ["investment-analysis-prices", workspaceId] })}><RefreshCw className="h-4 w-4" /></Button>
      <Button variant="outline" disabled={!validRange || analysis.completeHistory.isPending} onClick={() => analysis.completeHistory.mutate()}>{analysis.completeHistory.isPending ? "Buscando cotações…" : "Buscar cotações mensais desde a primeira movimentação"}</Button>
      <B3QuoteHistoryImportDialog workspaceId={workspaceId} targets={quoteTargets} />
    </div>
    {validRange && <InvestmentCapitalVsMarketChart rows={analysis.capitalVsMarket} currency={currency} isLoading={analysis.isLoading} error={analysis.error} />}
    {groups.length > 1 && selectedGroup === "ALL" && <fieldset className="space-y-3"><legend className="text-sm font-medium">Comparar rentabilidade</legend><div className="flex flex-wrap gap-x-5 gap-y-3">{groups.map((g) => <Label key={g.key} className="flex items-center gap-2"><Checkbox checked={!hiddenGroups.includes(g.key)} onCheckedChange={(checked) => setHiddenGroups((current) => checked === true ? current.filter((key) => key !== g.key) : [...current, g.key])} aria-label={`Comparar ${g.label}`} />{g.label}</Label>)}</div></fieldset>}
    {!validRange ? <p className="text-sm text-destructive" role="alert">Selecione um período válido até a data atual.</p> : analysis.isLoading ? <p className="text-sm text-muted-foreground">Carregando histórico…</p> : analysis.error ? <p className="text-sm text-destructive" role="alert">Não foi possível carregar o histórico salvo. Tente novamente.</p> : <>
      {fetchResult && <div className="space-y-1 text-sm text-muted-foreground" role="status"><p>Cotações consultadas para {fetchResult.length} ativos: {fetchResult.filter((r) => r.status === "OK").length} com histórico, {fetchResult.filter((r) => r.status !== "OK").length} sem retorno do provedor.</p>{providerNotes.map((m) => <p key={m}>{m}</p>)}</div>}
      {analysis.completeHistory.isError && <p className="text-sm text-destructive" role="alert">Não foi possível buscar as cotações históricas. As cotações já salvas foram mantidas.</p>}
      {limitations.length > 0 && <div className="space-y-2 border-l-2 border-border pl-3 text-sm text-muted-foreground" role="status"><p>{incomplete ? "Há meses com ativos sem avaliação comprovada; eles não entram como zero nos totais." : "Há ativos com custo histórico indeterminado."}</p><details><summary className="cursor-pointer">Dados faltantes por ativo ({new Set(limitations.map((l) => l.assetId)).size})</summary><ul className="mt-2 space-y-1">{limitations.map((l) => <li key={`${l.assetId}:${l.reason}`}>{l.name} — {l.reason === "NO_HISTORY" ? "faltam movimentos de posição ou quantidades nas compras/saídas" : l.reason === "NO_PRICE" ? "falta cotação histórica salva na data ou antes dela" : l.reason === "NO_VALUATION" ? "falta avaliação histórica registrada (aportes não comprovam o valor da posição)" : "falta base de custo comprovada; rentabilidade indisponível"} · {l.dates} {l.dates === 1 ? "data" : "datas"} ({fmtDate(l.first)}{l.first !== l.last ? ` a ${fmtDate(l.last)}` : ""})</li>)}</ul></details></div>}
      {chart.isolatedReturns.length > 0 && <div className="text-sm text-muted-foreground" role="status">{chart.isolatedReturns.map(({ key, date }) => <p key={key}>{groups.find((g) => g.key === key)?.label} — apenas uma observação válida, em {new Date(`${date}T12:00:00Z`).toLocaleDateString("pt-BR")}. O ponto representa essa data, não uma evolução; faltam cotações ou avaliações válidas nas demais datas do período.</p>)}</div>}
      {carriedPrices && <p className="text-sm text-muted-foreground">Cada mês usa a última cotação salva dentro dele; sem cotação no mês, usa a última anterior, com a data real sinalizada. Não há interpolação nem uso de preços futuros. Rentabilidade da posição não representa retorno acumulado com distribuições.</p>}
      <div className="min-w-0 space-y-4"><h2 className="text-base font-semibold">Rentabilidade da posição por grupo</h2>
        <p className="text-xs text-muted-foreground">Calculada somente sobre os ativos com avaliação no mês: (valor de mercado − custo dos mesmos ativos) ÷ custo dos mesmos ativos.{lowCoverage ? ` Pontos com marcador vazado têm menos de ${GROUP_RETURN_COVERAGE_WARNING * 100}% do capital do grupo avaliado.` : ""}</p>
        <div className="h-72" role="img" aria-label="Gráfico de rentabilidade por grupo">{hasReturns ? <ResponsiveContainer width="100%" height="100%"><LineChart data={chartData}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={dateLabel} fontSize={11} minTickGap={30} /><YAxis tickFormatter={(v) => `${v}%`} width={65} fontSize={11} /><Tooltip content={<ReturnTooltip groups={groups} />} /><Legend />{returnGroups.map((g) => <Line key={g.key} dataKey={g.key} name={g.label} stroke={groupColor(g.key)} strokeWidth={2} dot={returnDot(g.key, groupColor(g.key))} connectNulls={false} isAnimationActive={false} />)}</LineChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center border-y text-sm text-muted-foreground">{visibleGroups.length === 0 ? "Nenhum grupo selecionado para comparação." : "Rentabilidade histórica indisponível: faltam preços ou base de custo comprovada no período."}</div>}</div>
      </div>
      <InvestmentMonthlyTable rows={analysis.monthlyBase} />
    </>}
    <div className="space-y-4 border-t pt-6"><h2 className="text-base font-semibold">Composição atual da carteira · {currency}</h2><div className="grid items-center gap-6 md:grid-cols-[280px_1fr]">
      <div className="h-64" role="img" aria-label="Gráfico de composição atual por grupo">{composition.length > 0 ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={composition} dataKey="current" nameKey="label" innerRadius={65} outerRadius={95} paddingAngle={2} isAnimationActive={false}>{composition.map((g) => <Cell key={g.key} fill={groupColor(g.key)} />)}</Pie><Tooltip formatter={(v: number) => typeof v === "number" && Number.isFinite(v) ? formatCurrency(v, currency) : "—"} /></PieChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem valores disponíveis.</div>}</div>
      <div className="divide-y">{groups.map((g) => <div key={g.key} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="min-w-0 break-words font-medium">{g.label}</span><div className="flex flex-wrap gap-5 text-sm tabular-nums"><span>{formatCurrency(g.current, currency)}</span><span className="w-20 text-right text-muted-foreground">{g.participation.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</span></div></div>)}</div>
    </div></div>
  </section>;
}
