import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format";
import type { InvestmentMonthlyRow, MonthlyPositionStatus } from "@/services/InvestmentAnalysisService";

const statuses: Record<MonthlyPositionStatus, string> = {
  OK: "Cotação no mês", STALE_PRICE: "Preço desatualizado", CLOSED: "Posição zerada",
  NO_PRICE: "Sem cotação anterior", NO_HISTORY: "Posição histórica indisponível", NO_VALUATION: "Sem avaliação histórica",
};
const dateLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("pt-BR");

export function InvestmentMonthlyTable({ rows }: { rows: InvestmentMonthlyRow[] }) {
  const months = [...new Set(rows.map((r) => r.month))].sort().reverse();
  const [selection, setSelection] = useState("");
  const month = months.includes(selection) ? selection : months[0] ?? "";
  const displayed = rows.filter((r) => r.month === month);
  return <details className="space-y-4 border-t pt-5">
    <summary className="cursor-pointer font-semibold">Base histórica mensal por ativo ({rows.length} registros)</summary>
    {months.length === 0 ? <p className="text-sm text-muted-foreground">Sem registros mensais no período.</p> : <>
      <div className="flex items-center gap-3 pt-3"><Label>Mês de referência</Label><Select value={month} onValueChange={setSelection}><SelectTrigger className="w-40" aria-label="Mês da base histórica"><SelectValue /></SelectTrigger><SelectContent>{months.map((m) => <SelectItem value={m} key={m}>{new Date(`${m}-01T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</SelectItem>)}</SelectContent></Select></div>
      <p className="text-xs text-muted-foreground">Última cotação salva de cada ativo dentro do mês (no mês corrente, a mais recente). Sem cotação no mês, a referência é o fim do mês e usa a última cotação anterior, com sua data real. O consolidado mensal reúne essas referências individuais.</p>
      <Table aria-label="Base histórica mensal de investimentos"><TableHeader><TableRow>
        <TableHead>Ticker / ativo</TableHead><TableHead>Data de referência</TableHead><TableHead className="text-right">Quantidade histórica</TableHead><TableHead className="text-right">Cotação unitária</TableHead><TableHead>Data real da cotação</TableHead><TableHead className="text-right">Valor total</TableHead><TableHead>Status</TableHead>
      </TableRow></TableHeader><TableBody>{displayed.map((r) => <TableRow key={`${r.assetId}:${r.month}`}>
        <TableCell className="font-medium" title={r.name}>{r.ticker ?? r.name}</TableCell><TableCell className="whitespace-nowrap">{dateLabel(r.referenceDate)}</TableCell>
        <TableCell className="text-right tabular-nums">{r.quantity === null ? "—" : r.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 8 })}</TableCell>
        <TableCell className="whitespace-nowrap text-right tabular-nums">{r.unitQuote === null ? "—" : formatCurrency(r.unitQuote, r.currency)}</TableCell>
        <TableCell className="whitespace-nowrap">{r.quoteDate ? dateLabel(r.quoteDate) : "—"}</TableCell>
        <TableCell className="whitespace-nowrap text-right tabular-nums">{r.totalValue === null ? "—" : formatCurrency(r.totalValue, r.currency)}</TableCell>
        <TableCell className={r.status === "STALE_PRICE" || r.totalValue === null ? "text-muted-foreground" : "text-foreground"}>{statuses[r.status]}{r.projection.limitations.some((l) => l.reason === "UNKNOWN_COST") && <span className="block text-xs text-muted-foreground">Custo indeterminado</span>}</TableCell>
      </TableRow>)}</TableBody></Table>
    </>}
  </details>;
}