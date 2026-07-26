import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { CARD_INVOICE_STATUS_LABELS } from "@/constants/enums";
import type { CardInvoice } from "@/models/CardInvoice";

interface Props {
  invoices: CardInvoice[];
}

export function LiabilitiesWidget({ invoices }: Props) {
  const open = invoices.filter((i) => i.status !== "PAID");
  const total = open.reduce((s, i) => s + Number(i.amount), 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Passivos — Faturas em aberto
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tabular-nums text-red-600">
          {formatCurrency(total)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {open.length} fatura(s) não paga(s)
        </p>
        {open.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs max-h-40 overflow-y-auto">
            {open.slice(0, 6).map((i) => (
              <li key={i.id} className="flex justify-between gap-2">
                <span className="truncate">
                  {new Date(`${i.competence}T00:00:00`).toLocaleDateString("pt-BR", {
                    month: "short",
                    year: "2-digit",
                  })}
                </span>
                <span className="flex items-center gap-2 tabular-nums">
                  <Badge variant="outline" className="text-[9px]">
                    {CARD_INVOICE_STATUS_LABELS[i.status]}
                  </Badge>
                  {formatCurrency(Number(i.amount))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
