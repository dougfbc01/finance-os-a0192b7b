import type { GoalStatusLevel } from "@/models/FinancialGoal";

const BAR: Record<GoalStatusLevel, string> = {
  ON_TRACK: "bg-emerald-500",
  ATTENTION: "bg-amber-500",
  LATE: "bg-destructive",
  DONE: "bg-primary",
  INACTIVE: "bg-muted-foreground",
};

interface Props {
  percent: number | null;
  level: GoalStatusLevel;
  showLabel?: boolean;
}

/** Barra de progresso da meta (percentual já calculado no Service). */
export function GoalProgressBar({ percent, level, showLabel = true }: Props) {
  if (percent === null) {
    return <span className="text-xs text-muted-foreground">Sem valor alvo</span>;
  }
  const width = Math.min(Math.max(percent, 0), 100);
  return (
    <div className="space-y-1">
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`h-full rounded-full ${BAR[level]}`} style={{ width: `${width}%` }} />
      </div>
      {showLabel && (
        <span className="text-xs text-muted-foreground">
          {percent.toFixed(1).replace(".", ",")}% atingido
        </span>
      )}
    </div>
  );
}
