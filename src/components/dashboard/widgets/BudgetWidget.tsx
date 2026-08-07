import { Link } from "@tanstack/react-router";
import { Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BudgetProgressBar, BudgetStatusBadge } from "@/components/budgets";
import { formatCurrency } from "@/lib/format";
import { ROUTES } from "@/constants";
import { MonthlyBudgetService } from "@/services/MonthlyBudgetService";
import type { BudgetComparison } from "@/models/MonthlyBudget";

interface Props {
  comparison: BudgetComparison | null;
  hasBudget: boolean;
}

/** Widget "Orçamento do Mês" — apenas apresenta o que o Service calculou. */
export function BudgetWidget({ comparison, hasBudget }: Props) {
  const e = comparison?.summary.expense;
  const status = MonthlyBudgetService.statusLevel(e?.percent ?? null);


  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Orçamento do mês
        </CardTitle>
        <Target className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {!hasBudget || !e ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Nenhum planejamento definido para o mês.
            </p>
            <Link to={ROUTES.PLANEJAMENTO} className="text-sm font-medium underline">
              Criar planejamento
            </Link>
          </div>
        ) : (
          <Link to={ROUTES.PLANEJAMENTO} className="block space-y-3">
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground">Planejado</p>
                <p className="font-semibold tabular-nums">{formatCurrency(e.planned)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Realizado</p>
                <p className="font-semibold tabular-nums">{formatCurrency(e.actual)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Saldo restante</p>
                <p
                  className={`font-semibold tabular-nums ${
                    e.difference < 0 ? "text-destructive" : "text-emerald-600"
                  }`}
                >
                  {formatCurrency(e.remaining)}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <BudgetProgressBar percent={e.percent} status={status} />
              <BudgetStatusBadge status={status} muted={e.percent === null} />
            </div>

          </Link>
        )}
      </CardContent>
    </Card>
  );
}
