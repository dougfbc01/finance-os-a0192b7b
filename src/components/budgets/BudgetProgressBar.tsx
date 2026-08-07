import type { BudgetStatusLevel } from "@/models/MonthlyBudget";

const BAR: Record<BudgetStatusLevel, string> = {
  OK: "bg-emerald-500",
  WARNING: "bg-amber-500",
  OVER: "bg-destructive",
};

interface Props {
  percent: number | null;
  status: BudgetStatusLevel;
  showLabel?: boolean;
}

/** Barra percentual com faixas de cor (0–80 verde, 80–100 amarelo, >100 vermelho). */
export function BudgetProgressBar({ percent, status, showLabel = true }: Props) {
  if (percent === null) {
    return <span className="text-xs text-muted-foreground">Sem planejamento</span>;
  }
  const width = Math.min(Math.max(percent, 0), 100);
  return (
    <div className="space-y-1">
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`h-full rounded-full ${BAR[status]}`} style={{ width: `${width}%` }} />
      </div>
      {showLabel && (
        <span className="text-xs text-muted-foreground">{percent.toFixed(0)}% consumido</span>
      )}
    </div>
  );
}
