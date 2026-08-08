// Widget de Metas no Dashboard — consolidado do FinancialGoalService.
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GoalProgressBar, GoalStatusBadge } from "@/components/goals";
import { formatCurrency } from "@/lib/format";
import type { GoalProgress, GoalsOverview } from "@/models/FinancialGoal";
import { ROUTES } from "@/constants";

interface Props {
  overview: GoalsOverview;
  progress: GoalProgress[];
}

export function GoalsWidget({ overview, progress }: Props) {
  const active = progress
    .filter((p) => p.status === "ACTIVE")
    .sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0))
    .slice(0, 3);

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Metas financeiras
        </CardTitle>
        <Button size="sm" variant="ghost" asChild>
          <Link to={ROUTES.METAS}>Ver metas</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {overview.active === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma meta ativa. Crie uma meta para acompanhar sua evolução.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Ativas</p>
                <p className="text-base font-semibold">{overview.active}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Atrasadas</p>
                <p className="text-base font-semibold">{overview.late}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Acumulado</p>
                <p className="text-base font-semibold tabular-nums">
                  {formatCurrency(overview.totalCurrent)}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {active.map((p) => (
                <div key={p.goalId} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{p.name}</span>
                    <GoalStatusBadge level={p.level} />
                  </div>
                  <GoalProgressBar percent={p.percent} level={p.level} showLabel={false} />
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatCurrency(p.current)} de {formatCurrency(p.target)}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
