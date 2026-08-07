import { Badge } from "@/components/ui/badge";
import {
  BUDGET_STATUS_LEVEL_ICONS,
  BUDGET_STATUS_LEVEL_LABELS,
  type BudgetStatusLevel,
} from "@/models/MonthlyBudget";

const VARIANT: Record<BudgetStatusLevel, "secondary" | "outline" | "destructive"> = {
  OK: "secondary",
  WARNING: "outline",
  OVER: "destructive",
};

interface Props {
  status: BudgetStatusLevel;
  /** Quando não há valor planejado o status não se aplica. */
  muted?: boolean;
}

/** Indicador visual reutilizável (Planejamento, Dashboard e Insights). */
export function BudgetStatusBadge({ status, muted = false }: Props) {
  if (muted) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <Badge variant={VARIANT[status]} className="whitespace-nowrap text-[11px]">
      <span aria-hidden className="mr-1">
        {BUDGET_STATUS_LEVEL_ICONS[status]}
      </span>
      {BUDGET_STATUS_LEVEL_LABELS[status]}
    </Badge>
  );
}
