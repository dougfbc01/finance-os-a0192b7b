import { AlertTriangle, CheckCircle2, Info, RefreshCw, ShieldAlert, Stethoscope, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/format";
import type { FinancialInsight, InsightSeverity } from "@/models/Insight";
import type { FinancialInsightsState } from "@/hooks/useFinancialInsights";

const LEVEL_META: Record<
  InsightSeverity,
  { label: string; icon: typeof Info; className: string; badge: "default" | "secondary" | "destructive" }
> = {
  CRITICAL: {
    label: "Crítico",
    icon: ShieldAlert,
    className: "text-destructive",
    badge: "destructive",
  },
  WARNING: {
    label: "Atenção",
    icon: AlertTriangle,
    className: "text-amber-500",
    badge: "default",
  },
  INFO: { label: "Info", icon: Info, className: "text-muted-foreground", badge: "secondary" },
};

interface Props extends FinancialInsightsState {
  limit?: number;
}

/**
 * Central Inteligente de Pendências — apenas apresentação.
 * Rotas, filtros e agrupamentos vêm prontos do FinancialInsightsService.
 */
export function FinancialInsightsWidget({
  insights,
  summary,
  dismiss,
  restoreAll,
  runHealthCheck,
  reprocessRules,
  isRunningAction,
  limit = 8,
}: Props) {
  const visible = insights.slice(0, limit);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Financial Insights
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={runHealthCheck}
              disabled={isRunningAction}
            >
              <Stethoscope className="mr-1 h-3.5 w-3.5" /> Health Check
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={reprocessRules}
              disabled={isRunningAction}
            >
              <RefreshCw className="mr-1 h-3.5 w-3.5" /> Reprocessar regras
            </Button>
            <Button variant="ghost" size="sm" onClick={restoreAll}>
              Restaurar lidos
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2 text-xs">
          <span className="flex items-center gap-1 text-destructive">
            <span className="h-2 w-2 rounded-full bg-destructive" />
            {summary.critical} {summary.critical === 1 ? "Problema Crítico" : "Problemas Críticos"}
          </span>
          <span className="flex items-center gap-1 text-amber-500">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            {summary.warning} {summary.warning === 1 ? "Pendência" : "Pendências"}
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-muted-foreground" />
            {summary.info} {summary.info === 1 ? "Informação" : "Informações"}
          </span>
        </div>
      </CardHeader>

      <CardContent>
        {visible.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Nenhum insight pendente para o período selecionado.
          </p>
        ) : (
          <ul className="space-y-4">
            {visible.map((insight) => (
              <InsightRow key={insight.id} insight={insight} onDismiss={dismiss} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function InsightRow({
  insight,
  onDismiss,
}: {
  insight: FinancialInsight;
  onDismiss: (i: FinancialInsight) => void;
}) {
  const meta = LEVEL_META[insight.severity];
  const Icon = meta.icon;

  return (
    <li className="flex items-start gap-3">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.className}`} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{insight.title}</span>
          <Badge variant={meta.badge} className="text-[10px]">
            {meta.label}
          </Badge>
          {insight.quantity > 1 && (
            <Badge variant="outline" className="text-[10px]">
              {insight.quantity} itens
            </Badge>
          )}
        </div>

        <p className="text-xs text-muted-foreground">{insight.description}</p>

        {insight.details.length > 0 && (
          <ul className="space-y-0.5 pt-1 text-xs text-muted-foreground">
            {insight.details.map((d, idx) => (
              <li key={`${insight.id}-d${idx}`} className="flex flex-wrap gap-2">
                <span className="truncate">{d.label}</span>
                {d.amount !== undefined && (
                  <span className="tabular-nums font-medium">{formatCurrency(d.amount)}</span>
                )}
                {d.value && <span>{d.value}</span>}
                {d.date && <span>{formatDate(d.date)}</span>}
              </li>
            ))}
          </ul>
        )}

        {insight.action_route && insight.action_label && (
          <div className="pt-1">
            <Button asChild variant="outline" size="sm">
              <Link
                to={insight.action_route}
                search={(insight.action_filters ?? {}) as never}
              >
                {insight.action_label}
              </Link>
            </Button>
          </div>
        )}
      </div>

      {insight.dismissible && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          aria-label="Marcar como lido"
          onClick={() => onDismiss(insight)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </li>
  );
}
