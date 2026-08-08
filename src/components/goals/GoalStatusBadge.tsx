import { Badge } from "@/components/ui/badge";
import {
  GOAL_STATUS_LEVEL_ICONS,
  GOAL_STATUS_LEVEL_LABELS,
  type GoalStatusLevel,
} from "@/models/FinancialGoal";

const VARIANT: Record<GoalStatusLevel, "secondary" | "outline" | "destructive" | "default"> = {
  ON_TRACK: "secondary",
  ATTENTION: "outline",
  LATE: "destructive",
  DONE: "default",
  INACTIVE: "outline",
};

/** Semáforo da meta — o nível vem pronto do FinancialGoalService. */
export function GoalStatusBadge({ level }: { level: GoalStatusLevel }) {
  return (
    <Badge variant={VARIANT[level]} className="whitespace-nowrap text-[11px]">
      <span aria-hidden className="mr-1">
        {GOAL_STATUS_LEVEL_ICONS[level]}
      </span>
      {GOAL_STATUS_LEVEL_LABELS[level]}
    </Badge>
  );
}
