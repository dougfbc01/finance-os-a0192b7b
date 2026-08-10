import { Link } from "@tanstack/react-router";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { ROUTES } from "@/constants";
import type { GoalBudgetRelation } from "@/models/FinancialGoal";

interface Props {
  relations: GoalBudgetRelation[];
}

/**
 * Relação analítica entre as metas ativas e a sobra planejada do mês.
 * Todos os números vêm do FinancialGoalService.budgetRelation.
 */
export function BudgetGoalsTable({ relations }: Props) {
  if (relations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma meta ativa com valor pendente neste período.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Meta</TableHead>
          <TableHead className="text-right">Necessário / mês</TableHead>
          <TableHead className="text-right">Sobra planejada</TableHead>
          <TableHead className="text-right">Diferença</TableHead>
          <TableHead>Viabilidade</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {relations.map((r) => (
          <TableRow key={r.goalId}>
            <TableCell>
              <Link
                to={ROUTES.METAS}
                search={{ goal: r.goalId }}
                className="hover:underline"
              >
                {r.name}
              </Link>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {r.requiredMonthly === null ? "—" : formatCurrency(r.requiredMonthly)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatCurrency(r.plannedAvailable)}
            </TableCell>
            <TableCell
              className={`text-right tabular-nums ${
                (r.difference ?? 0) < 0 ? "text-destructive" : ""
              }`}
            >
              {r.difference === null ? "—" : formatCurrency(r.difference)}
            </TableCell>
            <TableCell>
              {r.feasible === null ? (
                <Badge variant="outline">Sem prazo</Badge>
              ) : r.feasible ? (
                <Badge variant="secondary">Cabe no orçamento</Badge>
              ) : (
                <Badge variant="destructive">Planejamento insuficiente</Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
