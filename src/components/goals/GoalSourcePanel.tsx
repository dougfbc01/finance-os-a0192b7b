import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { formatCurrency } from "@/lib/format";
import { FinancialGoalService } from "@/services/FinancialGoalService";
import type { GoalProgress } from "@/models/FinancialGoal";

interface Props {
  progress: GoalProgress;
}

/**
 * "De onde vem o valor desta meta?" — mostra as contas reais vinculadas.
 * A meta nunca cria movimentação: ela apenas observa os saldos.
 */
export function GoalSourcePanel({ progress: p }: Props) {
  const link = FinancialGoalService.drillDown(p.accountIds);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          De onde vem o valor desta meta?
        </CardTitle>
        {p.accountIds.length > 0 && (
          <Button size="sm" variant="ghost" asChild>
            <Link to={link.to} search={link.search}>
              Ver movimentações
            </Link>
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {p.source === "PATRIMONY" && (
          <p className="text-sm text-muted-foreground">
            O valor vem do patrimônio líquido consolidado do sistema.
          </p>
        )}
        {p.source === "CONTRIBUTIONS" && (
          <p className="text-sm text-muted-foreground">
            O valor vem dos aportes registrados manualmente. Vincule contas à meta para
            acompanhar o saldo real automaticamente.
          </p>
        )}
        {p.source === "ACCOUNTS" && (
          <>
            <ul className="divide-y">
              {p.accounts.map((a) => (
                <li key={a.accountId} className="flex items-center justify-between py-2 text-sm">
                  <span className="truncate">{a.name}</span>
                  <span className="font-medium tabular-nums">{formatCurrency(a.balance)}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t pt-2 text-sm font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatCurrency(p.current)}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
