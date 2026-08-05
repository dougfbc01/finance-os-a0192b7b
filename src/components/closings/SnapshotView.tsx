import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/format";
import {
  CLOSING_STATUS_LABELS,
  MONTH_LABELS,
  type ClosingBreakdownRow,
  type MonthlyClosing,
} from "@/models/MonthlyClosing";

function Rows({ title, rows }: { title: string; rows: ClosingBreakdownRow[] }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem registros.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {rows.map((r, i) => (
            <li key={`${r.id ?? "none"}-${i}`} className="flex justify-between gap-4">
              <span className="truncate">{r.label}</span>
              <span className="tabular-nums">{formatCurrency(r.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "pos" | "neg" }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`text-lg font-semibold tabular-nums ${
          tone === "pos" ? "text-emerald-600" : tone === "neg" ? "text-red-600" : ""
        }`}
      >
        {formatCurrency(value)}
      </p>
    </div>
  );
}

interface Props {
  closing: MonthlyClosing;
}

/** Exibe EXATAMENTE os números congelados no snapshot. Nunca recalcula. */
export function SnapshotView({ closing }: Props) {
  const s = closing.snapshot_json;
  if (!s?.totals) {
    return <p className="text-sm text-muted-foreground">Snapshot indisponível.</p>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            Snapshot — {MONTH_LABELS[closing.month - 1]} {closing.year}
          </CardTitle>
          <Badge variant={closing.status === "CLOSED" ? "default" : "secondary"}>
            {CLOSING_STATUS_LABELS[closing.status]}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Metric label="Receitas" value={s.totals.income} tone="pos" />
            <Metric label="Despesas" value={s.totals.expense} tone="neg" />
            <Metric
              label="Resultado"
              value={s.totals.result}
              tone={s.totals.result >= 0 ? "pos" : "neg"}
            />
            <Metric label="Saldo disponível" value={s.totals.cash} />
            <Metric label="Investimentos" value={s.totals.assets} />
            <Metric label="Passivo" value={s.totals.liabilities} tone="neg" />
            <Metric label="Patrimônio líquido" value={s.totals.netWorth} />
            <Metric label="Aportes no período" value={s.investments.contributions} />
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
            <p>Movimentações: <strong>{s.quality.movements}</strong></p>
            <p>Importações: <strong>{s.quality.imports}</strong></p>
            <p>Sem categoria: <strong>{s.quality.uncategorized}</strong></p>
            <p>Duplicidades: <strong>{s.quality.duplicates}</strong></p>
            <p>Regras conflitantes: <strong>{s.quality.ruleConflicts}</strong></p>
            <p>Regras duplicadas: <strong>{s.quality.ruleDuplicates}</strong></p>
            <p>Transferências: <strong>{s.transfers.count}</strong></p>
            <p>Health Check: <strong>{s.health.issues}</strong> alertas</p>
            <p>Insights críticos: <strong>{s.insights_summary?.critical ?? 0}</strong></p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por categoria</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Rows title="Receitas" rows={s.byCategory.income} />
            <Rows title="Despesas" rows={s.byCategory.expense} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por subcategoria</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Rows title="Receitas" rows={s.bySubcategory.income} />
            <Rows title="Despesas" rows={s.bySubcategory.expense} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contas</CardTitle>
          </CardHeader>
          <CardContent>
            {s.byAccount.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem contas.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {s.byAccount.map((a) => (
                  <li key={a.id} className="flex justify-between gap-4">
                    <span className="truncate">{a.label}</span>
                    <span className="tabular-nums">{formatCurrency(a.balance)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cartões</CardTitle>
          </CardHeader>
          <CardContent>
            {s.byCard.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem cartões.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {s.byCard.map((c) => (
                  <li key={c.id} className="flex justify-between gap-4">
                    <span className="truncate">
                      {c.label} <span className="text-muted-foreground">({c.count})</span>
                    </span>
                    <span className="tabular-nums">{formatCurrency(c.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {s.insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Insights congelados</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {s.insights.map((i) => (
                <li key={i.id} className="flex items-start gap-2">
                  <Badge
                    variant={i.severity === "CRITICAL" ? "destructive" : "secondary"}
                    className="mt-0.5"
                  >
                    {i.severity}
                  </Badge>
                  <div>
                    <p className="font-medium">{i.title}</p>
                    <p className="text-muted-foreground">{i.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
