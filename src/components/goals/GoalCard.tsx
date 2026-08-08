import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GoalProgressBar } from "./GoalProgressBar";
import { GoalStatusBadge } from "./GoalStatusBadge";
import { formatCurrency, formatDate } from "@/lib/format";
import { GOAL_TYPE_ICONS, GOAL_TYPE_LABELS, GOAL_STATUS_LABELS } from "@/models/FinancialGoal";
import type { GoalProgress } from "@/models/FinancialGoal";
import { ROUTES } from "@/constants";

interface Props {
  progress: GoalProgress;
  onOpen: (goalId: string) => void;
}

/** Card de meta — apenas apresentação dos números vindos do Service. */
export function GoalCard({ progress: p, onOpen }: Props) {
  return (
    <Card className="h-full">
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold leading-tight">
              <span aria-hidden className="mr-1">
                {GOAL_TYPE_ICONS[p.type]}
              </span>
              {p.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {GOAL_TYPE_LABELS[p.type]} · {GOAL_STATUS_LABELS[p.status]}
            </p>
          </div>
          <GoalStatusBadge level={p.level} />
        </div>

        <p className="text-lg font-semibold tabular-nums">
          {formatCurrency(p.current)}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            / {formatCurrency(p.target)}
          </span>
        </p>

        <GoalProgressBar percent={p.percent} level={p.level} />

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground">Faltam</p>
            <p className="font-medium tabular-nums">{formatCurrency(p.remaining)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Data alvo</p>
            <p className="font-medium">{p.targetDate ? formatDate(p.targetDate) : "—"}</p>
          </div>
          <div className="col-span-2">
            <p className="text-muted-foreground">Previsão</p>
            <p className="font-medium">
              {p.estimatedCompletionDate
                ? `${formatDate(p.estimatedCompletionDate)} (${p.monthsToComplete} mês(es))`
                : (p.forecastMessage ?? "Meta atingida")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant="secondary" onClick={() => onOpen(p.goalId)}>
            Detalhes
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <Link to={ROUTES.PLANEJAMENTO}>Planejamento</Link>
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <Link to={ROUTES.MOVIMENTACOES}>Movimentações</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
