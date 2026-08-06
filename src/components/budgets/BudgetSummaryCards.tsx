import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/format";
import type { BudgetSummary } from "@/models/MonthlyBudget";

interface Props {
  summary: BudgetSummary;
}

/** Cartões de resumo do orçamento. Apenas apresentação. */
export function BudgetSummaryCards({ summary }: Props) {
  const e = summary.expense;
  const percent = e.percent ?? 0;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      <Card>
        <CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Planejado (despesas)</p>
          <p className="text-2xl font-semibold tabular-nums">{formatCurrency(e.planned)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Realizado</p>
          <p className="text-2xl font-semibold tabular-nums">{formatCurrency(e.actual)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Saldo restante</p>
          <p
            className={`text-2xl font-semibold tabular-nums ${
              e.difference < 0 ? "text-destructive" : ""
            }`}
          >
            {formatCurrency(e.remaining)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-2 pt-6">
          <p className="text-xs text-muted-foreground">Utilizado</p>
          <p className="text-2xl font-semibold tabular-nums">
            {e.percent === null ? "—" : `${percent.toFixed(0)}%`}
          </p>
          <Progress value={Math.min(percent, 100)} />
          <p className="text-xs text-muted-foreground">
            {summary.overCount} acima do orçamento · {summary.warningCount} em alerta
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
