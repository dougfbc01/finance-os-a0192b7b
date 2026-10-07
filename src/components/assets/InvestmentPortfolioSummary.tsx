import { summarizeInvestments } from "@/services/InvestmentAnalysisService";
import { InvestmentServiceImpl, type InvestmentRow } from "@/services/InvestmentService";
import { formatCurrency } from "@/lib/format";
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell, TableFooter } from "@/components/ui/table";
import { TrendingUp } from "lucide-react";

export function InvestmentPortfolioSummary({ rows }: { rows: InvestmentRow[] }) {
  const groups = summarizeInvestments(rows);
  const currencies = [...new Set(groups.map((g) => g.currency))];
  return <section className="space-y-5" aria-label="Resumo da carteira">
    <div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /><h2 className="text-lg font-semibold">Resumo da carteira</h2></div>
    {currencies.map((currency) => {
      const currencyRows = rows.filter((r) => r.asset.currency === currency);
      const currencyGroups = groups.filter((g) => g.currency === currency);
      const totals = currencyGroups.reduce((s, g) => ({ invested: s.invested + g.invested, current: s.current + g.current, profit: s.profit + g.profit, economicReturn: s.economicReturn + (g.economicReturn ?? 0), available: s.available + (g.economicReturn !== null ? 1 : 0), unavailable: s.unavailable + g.unavailableReturns }), { invested: 0, current: 0, profit: 0, economicReturn: 0, available: 0, unavailable: 0 });
      // Aggregate profitability is delegated to the same service used by the portfolio.
      const totalGroup = InvestmentServiceImpl.totals(currencyRows.map((r) => r.asset));
      return <div key={currency} className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-l-4 border-primary bg-muted/40 px-5 py-4">
          <div><p className="text-sm text-muted-foreground">Retorno Econômico Total · {currency}</p><p className="mt-1 text-3xl font-semibold tabular-nums">{totals.available ? formatCurrency(totals.economicReturn, currency) : "—"}</p></div>
          <span className="text-sm text-muted-foreground">{totals.unavailable > 0 ? `${totals.unavailable} ativo(s) com retorno indisponível · total parcial` : `${currencyRows.length} ativos`}</span>
        </div>
        <div className="overflow-x-auto rounded-md border">
          <Table><TableHeader><TableRow><TableHead>Grupo</TableHead><TableHead className="text-right">Investido</TableHead><TableHead className="text-right">Valor atual</TableHead><TableHead className="text-right">Resultado econômico</TableHead><TableHead className="text-right">Rentabilidade</TableHead><TableHead className="text-right">Participação</TableHead></TableRow></TableHeader>
            <TableBody>{currencyGroups.map((g) => <TableRow key={g.key}><TableCell className="font-medium">{g.label} <span className="text-xs text-muted-foreground">({g.count})</span></TableCell><TableCell className="text-right tabular-nums">{formatCurrency(g.invested, currency)}</TableCell><TableCell className="text-right tabular-nums">{formatCurrency(g.current, currency)}</TableCell><TableCell className="text-right tabular-nums">{g.economicReturn === null ? "—" : formatCurrency(g.economicReturn, currency)}{g.unavailableReturns > 0 && g.economicReturn !== null ? " *" : ""}</TableCell><TableCell className="text-right tabular-nums">{g.profitPercent.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</TableCell><TableCell className="text-right tabular-nums">{g.participation.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</TableCell></TableRow>)}</TableBody>
            <TableFooter><TableRow><TableCell>Total · {currency}</TableCell><TableCell className="text-right">{formatCurrency(totals.invested, currency)}</TableCell><TableCell className="text-right">{formatCurrency(totals.current, currency)}</TableCell><TableCell className="text-right">{totals.available ? formatCurrency(totals.economicReturn, currency) : "—"}</TableCell><TableCell className="text-right">{(totalGroup?.profitPercent ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</TableCell><TableCell className="text-right">{totals.current > 0 ? "100%" : "—"}</TableCell></TableRow></TableFooter>
          </Table>
        </div>
      </div>;
    })}
    {groups.length === 0 && <p className="text-sm text-muted-foreground">Nenhum investimento cadastrado ainda.</p>}
  </section>;
}