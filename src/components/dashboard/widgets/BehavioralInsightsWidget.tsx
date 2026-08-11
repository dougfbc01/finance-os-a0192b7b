import { ArrowDownRight, ArrowUpRight, Compass, Sparkles, Target, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import type { AnalyticsReport } from "@/models/Analytics";
import { CONFIDENCE_LABELS } from "@/models/Analytics";

interface Props {
  report: AnalyticsReport;
  summary: string[];
}

/**
 * Comportamento Financeiro — apresentação pura.
 * Todos os números chegam prontos do FinancialAnalyticsService.
 */
export function BehavioralInsightsWidget({ report, summary }: Props) {
  const empty = report.window.monthsAnalyzed === 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Sparkles className="h-4 w-4" /> Comportamento Financeiro
          </CardTitle>
          <Badge variant={report.window.confidence === "NORMAL" ? "secondary" : "outline"}>
            {CONFIDENCE_LABELS[report.window.confidence]}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <ul className="space-y-1 text-sm text-muted-foreground">
          {summary.map((line, i) => (
            <li key={`s${i}`}>{line}</li>
          ))}
        </ul>

        {!empty && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Section title="Categorias em crescimento" icon={ArrowUpRight}>
              {report.growing.length === 0 ? (
                <Empty>Nenhuma categoria acima da média histórica.</Empty>
              ) : (
                report.growing.map((t) => (
                  <Row
                    key={`up-${t.categoryId ?? "none"}`}
                    label={t.name}
                    hint={`Média ${formatCurrency(t.average)}`}
                    amount={t.current}
                    badge={`+${Math.abs(t.variationPercent ?? 0).toFixed(0)}%`}
                    tone="negative"
                  />
                ))
              )}
            </Section>

            <Section title="Categorias em redução" icon={ArrowDownRight}>
              {report.decreasing.length === 0 ? (
                <Empty>Nenhuma redução relevante no período.</Empty>
              ) : (
                report.decreasing.map((t) => (
                  <Row
                    key={`down-${t.categoryId ?? "none"}`}
                    label={t.name}
                    hint={`Média ${formatCurrency(t.average)}`}
                    amount={t.current}
                    badge={`−${Math.abs(t.variationPercent ?? 0).toFixed(0)}%`}
                    tone="positive"
                  />
                ))
              )}
            </Section>

            <Section title="Lançamentos atípicos" icon={Zap}>
              {report.outliers.length === 0 ? (
                <Empty>Nenhum lançamento fora do padrão.</Empty>
              ) : (
                report.outliers.map((o) => (
                  <Row
                    key={o.movementId}
                    label={o.description}
                    hint={`${o.categoryName} · ${formatDate(o.date)}`}
                    amount={o.amount}
                    badge={`${o.times.toFixed(1)}x`}
                    tone="negative"
                  />
                ))
              )}
            </Section>

            <Section title="Oportunidades de economia" icon={Target}>
              {report.savings.length === 0 ? (
                <Empty>Sem excesso frente ao planejamento do mês.</Empty>
              ) : (
                report.savings.map((s) => (
                  <Row
                    key={`sv-${s.categoryId ?? "none"}`}
                    label={s.name}
                    hint={`Planejado ${formatCurrency(s.planned)} · Média ${formatCurrency(s.monthlyAverage)}`}
                    amount={s.excess}
                    badge="por mês"
                    tone="negative"
                  />
                ))
              )}
            </Section>

            <Section title="Concentração de gastos" icon={Compass}>
              {report.concentration.length === 0 ? (
                <Empty>Sem despesas no período.</Empty>
              ) : (
                report.concentration.slice(0, 4).map((c) => (
                  <Row
                    key={`cc-${c.categoryId ?? "none"}`}
                    label={c.name}
                    hint={`${c.percent.toFixed(0)}% do total`}
                    amount={c.amount}
                  />
                ))
              )}
            </Section>

            <Section title="Sazonalidade" icon={Compass}>
              {!report.seasonality ? (
                <Empty>Sem dados do mesmo mês no ano anterior.</Empty>
              ) : (
                <Row
                  label={`${report.seasonality.monthKey} x ${report.seasonality.referenceKey}`}
                  hint={`Ano anterior ${formatCurrency(report.seasonality.reference)}`}
                  amount={report.seasonality.current}
                  badge={
                    report.seasonality.variationPercent === null
                      ? undefined
                      : `${report.seasonality.variationPercent > 0 ? "+" : "−"}${Math.abs(report.seasonality.variationPercent).toFixed(0)}%`
                  }
                  tone={
                    (report.seasonality.variationPercent ?? 0) > 0 ? "negative" : "positive"
                  }
                />
              )}
            </Section>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Zap;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

function Row({
  label,
  hint,
  amount,
  badge,
  tone,
}: {
  label: string;
  hint?: string;
  amount: number;
  badge?: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{label}</p>
        {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {badge && (
          <Badge
            variant={tone === "negative" ? "destructive" : "secondary"}
            className="text-[10px]"
          >
            {badge}
          </Badge>
        )}
        <span className="tabular-nums text-sm font-medium">{formatCurrency(amount)}</span>
      </div>
    </div>
  );
}
