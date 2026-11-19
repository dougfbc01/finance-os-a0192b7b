// Exibe o "Resumo do mês". Nenhum cálculo financeiro aqui: só formatação.
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Kpi, MonthlySummary, MonthStatus } from "@/services/MonthlySummaryService";

export const MONTH_STATUS_LABELS: Record<MonthStatus, string> = {
  CLOSED: "Fechado",
  STALE: "Desatualizado",
  REOPENED: "Reaberto",
  OPEN: "Aberto",
  IN_PROGRESS: "Em andamento",
};

function fmt(k: Kpi, v: number | null) {
  if (v === null) return "—";
  return k.key === "savingsRate" ? `${v.toFixed(1)}%` : formatCurrency(v);
}
function fmtDelta(k: Kpi, v: number | null) {
  if (v === null) return "—";
  const sign = v > 0 ? "+" : "";
  return k.key === "savingsRate" ? `${sign}${v.toFixed(1)} p.p.` : `${sign}${formatCurrency(v)}`;
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <li className={`flex justify-between gap-4 ${strong ? "font-semibold" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{formatCurrency(value)}</span>
    </li>
  );
}

export function MonthlySummaryReport({ summary }: { summary: MonthlySummary }) {
  const s = summary;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Pronto para fechar?</CardTitle>
          <div className="flex gap-2">
            <Badge variant={s.status === "CLOSED" ? "default" : s.status === "STALE" ? "destructive" : "secondary"}>
              {MONTH_STATUS_LABELS[s.status]}
            </Badge>
            <Badge variant={s.ready ? "default" : "outline"}>{s.ready ? "Pronto" : "Pendências"}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {s.checklist.map((c) => (
              <li key={c.key} className={c.ok ? "" : "text-destructive"}>
                {c.ok ? "✓" : "✗"} {c.label}
                {!c.ok && c.count > 0 && c.key !== "ended" ? ` (${c.count})` : ""}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {s.kpis.map((k) => (
          <Card key={k.key}>
            <CardContent className="space-y-1 pt-6">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className="text-xl font-semibold tabular-nums">{fmt(k, k.value)}</p>
              <p className="text-xs text-muted-foreground">vs mês anterior: {fmtDelta(k, k.deltaPrevious)}</p>
              <p className="text-xs text-muted-foreground">vs média 6 meses: {fmtDelta(k, k.deltaAverage)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Por que o patrimônio mudou</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              <Row label="Patrimônio no início" value={s.bridge.start} strong />
              <Row label="Resultado do mês" value={s.bridge.result} />
              <Row label="Valorização dos investimentos" value={s.bridge.valuation} />
              <Row label="Outros (ajustes e estornos)" value={s.bridge.others} />
              <Row label="Não explicado" value={s.bridge.unexplained} />
              <Row label="Patrimônio no fim" value={s.bridge.end} strong />
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              "Não explicado" reúne diferenças de data entre competência e caixa, faturas a pagar e lucro ou prejuízo de vendas de investimentos.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Investimentos do mês</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              <Row label="Aportes" value={s.investments.contributions} />
              <Row label="Proventos recebidos" value={s.investments.income} />
              <Row label="Valorização" value={s.investments.valuation} />
              <Row label="Valor no fim do mês" value={s.investments.endValue} strong />
            </ul>
            {s.investments.atCost > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {formatCurrency(s.investments.atCost)} estão "a custo" por falta de cotação no mês.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Categorias que mais mudaram</CardTitle></CardHeader>
          <CardContent>
            {s.categoryChanges.length === 0 ? <p className="text-sm text-muted-foreground">Sem despesas.</p> : (
              <ul className="space-y-1 text-sm">
                {s.categoryChanges.map((c) => (
                  <li key={c.id ?? "none"} className="flex justify-between gap-4">
                    <span className="truncate">{c.label}</span>
                    <span className="tabular-nums">{formatCurrency(c.current)} ({c.delta > 0 ? "+" : ""}{formatCurrency(c.delta)})</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">10 maiores despesas</CardTitle></CardHeader>
          <CardContent>
            {s.topExpenses.length === 0 ? <p className="text-sm text-muted-foreground">Sem despesas.</p> : (
              <ul className="space-y-1 text-sm">
                {s.topExpenses.map((e) => (
                  <li key={e.id} className="flex justify-between gap-4">
                    <span className="truncate">{formatDate(e.date)} · {e.description} <span className="text-muted-foreground">({e.category})</span></span>
                    <span className="tabular-nums">{formatCurrency(e.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Gastos incomuns</CardTitle></CardHeader>
          <CardContent>
            {s.unusual.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum gasto fora do padrão.</p> : (
              <ul className="space-y-1 text-sm">
                {s.unusual.map((e) => (
                  <li key={e.id} className="flex justify-between gap-4">
                    <span className="truncate">{e.description} <span className="text-muted-foreground">({e.category}, média {formatCurrency(e.average)})</span></span>
                    <span className="tabular-nums">{formatCurrency(e.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Cartões</CardTitle></CardHeader>
          <CardContent>
            {s.cards.length === 0 ? <p className="text-sm text-muted-foreground">Sem movimento nos cartões.</p> : (
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr><th className="text-left font-normal">Cartão</th><th className="text-right font-normal">Compras</th><th className="text-right font-normal">Faturas pagas</th><th className="text-right font-normal">Aberta</th></tr>
                </thead>
                <tbody>
                  {s.cards.map((c) => (
                    <tr key={c.id}>
                      <td className="truncate">{c.label}</td>
                      <td className="text-right tabular-nums">{formatCurrency(c.purchases)}</td>
                      <td className="text-right tabular-nums">{formatCurrency(c.paidInvoices)}</td>
                      <td className="text-right tabular-nums">{formatCurrency(c.open)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Orçamento — maiores desvios</CardTitle></CardHeader>
          <CardContent>
            {s.budget.length === 0 ? <p className="text-sm text-muted-foreground">Sem orçamento para este mês.</p> : (
              <ul className="space-y-1 text-sm">
                {s.budget.map((b) => (
                  <li key={b.key} className="flex justify-between gap-4">
                    <span className="truncate">{b.label}</span>
                    <span className="tabular-nums">
                      {formatCurrency(b.actual)} de {formatCurrency(b.planned)}{" "}
                      <span className={b.difference < 0 ? "text-destructive" : "text-muted-foreground"}>
                        ({b.difference > 0 ? "+" : ""}{formatCurrency(b.difference)})
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
