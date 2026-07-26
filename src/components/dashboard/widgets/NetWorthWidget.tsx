import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { PatrimonySnapshot } from "@/services/PatrimonyService";

interface Props {
  snapshot: PatrimonySnapshot;
}

export function NetWorthWidget({ snapshot }: Props) {
  const positive = snapshot.netWorth >= 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Patrimônio Líquido
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className={`text-3xl font-bold tabular-nums ${
            positive ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {formatCurrency(snapshot.netWorth)}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
          <div>
            <p className="text-muted-foreground">Caixa</p>
            <p className="font-semibold tabular-nums">{formatCurrency(snapshot.cash)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Investimentos</p>
            <p className="font-semibold tabular-nums">{formatCurrency(snapshot.assets)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Passivo cartões</p>
            <p className="font-semibold tabular-nums text-red-600">
              -{formatCurrency(snapshot.liabilities)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
