// Totalizador do conjunto FILTRADO de movimentações (Sprint 4.5.1).
// Nenhum cálculo aqui: delega ao MovementService sobre a lista já carregada.
import { MovementServiceImpl } from "@/services/MovementService";
import { formatCurrency } from "@/lib/format";
import type { Movement } from "@/models";

type Emphasis = "income" | "expense" | "all";

interface Props {
  movements: Movement[];
  emphasis?: Emphasis;
}

export function MovementTotalsBar({ movements, emphasis = "all" }: Props) {
  const totals = MovementServiceImpl.totals(movements);

  const item = (label: string, value: string, strong: boolean, tone?: string) => (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span
        className={`tabular-nums ${strong ? "text-base font-semibold" : "text-sm font-medium"} ${tone ?? ""}`}
      >
        {value}
      </span>
    </div>
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t bg-muted/40 px-3 py-3">
      <div className="flex flex-col">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Total filtrado
        </span>
        <span className="text-sm font-medium">{totals.count} lançamentos</span>
      </div>
      <div className="flex flex-wrap items-center gap-6">
        {emphasis !== "expense" &&
          item("Receitas", formatCurrency(totals.income), emphasis === "income", "text-emerald-600")}
        {emphasis !== "income" &&
          item("Despesas", formatCurrency(totals.expense), emphasis === "expense", "text-destructive")}
        {totals.transfers > 0 &&
          item("Transferências", formatCurrency(totals.transfers), false, "text-muted-foreground")}
        {emphasis === "all" &&
          item(
            "Saldo líquido",
            formatCurrency(totals.net),
            true,
            totals.net < 0 ? "text-destructive" : "text-emerald-600",
          )}
      </div>
    </div>
  );
}
