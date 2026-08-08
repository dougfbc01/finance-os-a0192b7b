import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GoalEvolutionChart } from "./GoalEvolutionChart";
import { GoalProgressBar } from "./GoalProgressBar";
import { GoalStatusBadge } from "./GoalStatusBadge";
import { formatCurrency, formatDate } from "@/lib/format";
import { GOAL_TYPE_ICONS, GOAL_TYPE_LABELS } from "@/models/FinancialGoal";
import type { GoalContribution, GoalProgress } from "@/models/FinancialGoal";

interface Props {
  progress: GoalProgress;
  contributions: GoalContribution[];
  onAddContribution: () => void;
  onEdit: () => void;
  onDeleteContribution: (id: string) => void;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

/** Detalhamento completo da meta — apenas exibição dos cálculos do Service. */
export function GoalDetailPanel({
  progress: p,
  contributions,
  onAddContribution,
  onEdit,
  onDeleteContribution,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">
            <span aria-hidden className="mr-1">
              {GOAL_TYPE_ICONS[p.type]}
            </span>
            {p.name}
          </h3>
          <p className="text-xs text-muted-foreground">{GOAL_TYPE_LABELS[p.type]}</p>
        </div>
        <div className="flex items-center gap-2">
          <GoalStatusBadge level={p.level} />
          <Button size="sm" variant="secondary" onClick={onEdit}>
            Editar
          </Button>
          <Button size="sm" onClick={onAddContribution} disabled={p.type === "PATRIMONY"}>
            Registrar aporte
          </Button>
        </div>
      </div>

      <GoalProgressBar percent={p.percent} level={p.level} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Valor atual" value={formatCurrency(p.current)} />
        <Stat label="Valor alvo" value={formatCurrency(p.target)} />
        <Stat label="Falta" value={formatCurrency(p.remaining)} />
        <Stat
          label="Ritmo médio/mês"
          value={p.monthlyPace === null ? "—" : formatCurrency(p.monthlyPace)}
        />
        <Stat
          label="Aporte necessário/mês"
          value={p.requiredMonthly === null ? "—" : formatCurrency(p.requiredMonthly)}
        />
        <Stat label="Data alvo" value={p.targetDate ? formatDate(p.targetDate) : "—"} />
        <Stat
          label="Previsão de conclusão"
          value={
            p.estimatedCompletionDate
              ? formatDate(p.estimatedCompletionDate)
              : (p.forecastMessage ?? "Meta atingida")
          }
        />
        <Stat
          label="Último aporte"
          value={
            p.daysSinceLastContribution === null
              ? "Nenhum"
              : `há ${p.daysSinceLastContribution} dia(s)`
          }
        />
      </div>

      <GoalEvolutionChart history={p.history} target={p.target} />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Histórico de aportes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {contributions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum aporte registrado.</p>
          ) : (
            <ul className="divide-y">
              {contributions
                .slice()
                .reverse()
                .map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                    <span>{formatDate(c.contribution_date)}</span>
                    <span className="flex items-center gap-3">
                      <span className="font-medium tabular-nums">
                        {formatCurrency(Number(c.amount))}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDeleteContribution(c.id)}
                      >
                        Remover
                      </Button>
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
