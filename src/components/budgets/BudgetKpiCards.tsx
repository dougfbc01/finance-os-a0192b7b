import { Card, CardContent } from "@/components/ui/card";
import { BudgetProgressBar } from "./BudgetProgressBar";
import { BudgetStatusBadge } from "./BudgetStatusBadge";
import { formatCurrency } from "@/lib/format";
import type { BudgetKpis } from "@/models/MonthlyBudget";

interface Props {
  kpis: BudgetKpis;
  /** Rótulos mudam entre despesas e receitas. */
  variant?: "EXPENSE" | "INCOME";
}

/** KPIs do Planejamento. Todos os números vêm prontos do MonthlyBudgetService. */
export function BudgetKpiCards({ kpis, variant = "EXPENSE" }: Props) {
  const isIncome = variant === "INCOME";
  const plannedLabel = isIncome ? "Receita planejada" : "Planejado";
  const actualLabel = isIncome ? "Receita realizada" : "Realizado";
  const remainingLabel = isIncome ? "Falta receber" : "Saldo restante";

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card>
        <CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">{plannedLabel}</p>
          <p className="text-2xl font-semibold tabular-nums">{formatCurrency(kpis.planned)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Diferença {formatCurrency(kpis.difference)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">{actualLabel}</p>
          <p className="text-2xl font-semibold tabular-nums">{formatCurrency(kpis.actual)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Consumo médio diário {formatCurrency(kpis.dailyAverage)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">{remainingLabel}</p>
          <p
            className={`text-2xl font-semibold tabular-nums ${
              !isIncome && kpis.difference < 0 ? "text-destructive" : ""
            }`}
          >
            {formatCurrency(kpis.remaining)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {kpis.daysRemaining} dia(s) restante(s)
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 pt-6">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {isIncome ? "Percentual realizado" : "Percentual utilizado"}
            </p>
            <BudgetStatusBadge status={kpis.status} muted={kpis.percent === null} />
          </div>
          <p className="text-2xl font-semibold tabular-nums">
            {kpis.percent === null ? "—" : `${kpis.percent.toFixed(0)}%`}
          </p>
          <BudgetProgressBar percent={kpis.percent} status={kpis.status} showLabel={false} />
          <p className="text-xs text-muted-foreground">
            Projeção de fechamento {formatCurrency(kpis.projection)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
