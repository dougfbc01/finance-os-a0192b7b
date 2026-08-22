// Obrigações previstas da competência dentro do Planejamento.
// Anti-duplicidade: parcelas cuja categoria já possui item planejado aparecem
// marcadas como "já orçado" e NÃO entram no total adicional.
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROUTES } from "@/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import type { CommitmentForecast } from "@/models/Commitment";

interface Props {
  forecast: CommitmentForecast;
}

export function CommitmentForecastPanel({ forecast }: Props) {
  if (!forecast.lines.length) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Nenhuma parcela prevista nesta competência.{" "}
          <Link to={ROUTES.COMPROMISSOS} className="underline">
            Cadastrar compromisso
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Previsto em compromissos</p>
            <p className="text-xl font-semibold">{formatCurrency(forecast.forecastTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">
              Ainda fora do orçamento (não somado em dobro)
            </p>
            <p className="text-xl font-semibold">{formatCurrency(forecast.uncoveredTotal)}</p>
          </CardContent>
        </Card>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Compromisso</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead>Situação no orçamento</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {forecast.lines.map((l) => (
            <TableRow key={l.installment_id}>
              <TableCell>{l.name}</TableCell>
              <TableCell>{formatDate(l.due_date)}</TableCell>
              <TableCell className="text-right">{formatCurrency(l.amount)}</TableCell>
              <TableCell>
                {l.alreadyBudgeted ? (
                  <Badge variant="secondary">Já orçado</Badge>
                ) : (
                  <Badge variant="outline">Fora do orçamento</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <p className="text-xs text-muted-foreground">
        Valores previstos não são movimentações: eles não alteram o realizado do mês nem o
        saldo das contas.
      </p>
    </div>
  );
}
