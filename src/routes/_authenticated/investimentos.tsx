import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FileSpreadsheet, Plus, TrendingUp, Wallet, PieChart as PieIcon, ArrowUp, ArrowDown, ArrowUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiWidget } from "@/components/dashboard/widgets";
import {
  AssetFormDialog,
  AssetDetailDialog,
  QuoteRefreshButton,
} from "@/components/assets";
import { useWorkspace } from "@/hooks/useWorkspace";
import { usePatrimony } from "@/hooks/usePatrimony";
import { ASSET_TYPE_LABELS } from "@/constants/enums";
import { formatCurrency } from "@/lib/format";
import type { Asset } from "@/models";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { InvestmentPortfolioSummary } from "@/components/assets/InvestmentPortfolioSummary";
import { InvestmentAnalysis } from "@/components/assets/InvestmentAnalysis";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { portfolioView, type InvestmentSortKey, type InvestmentSortDirection } from "@/services/InvestmentViewService";

export const Route = createFileRoute("/_authenticated/investimentos")({
  head: () => ({
    meta: [
      { title: "Investimentos — Finance OS" },
      {
        name: "description",
        content:
          "Acompanhe seus investimentos: quantidade, preço médio, valor atual e rentabilidade.",
      },
      { property: "og:title", content: "Investimentos — Finance OS" },
      { property: "og:description", content: "Carteira, retorno econômico por grupo e análise histórica dos investimentos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InvestimentosPage,
});

function InvestimentosPage() {
  const { data: ws } = useWorkspace();
  const wsId = ws?.id;
  const {
    investments,
    investmentTotals,
    movements,
    quotedById,
    hasQuotableAssets,
    isQuotesFetching,
    quotesUpdatedAt,
    quotesCooldownUntil,
    quotesNextAutoUpdate,
    refreshQuotes,
    refreshQuote,
    pendingQuoteTickers,
    isLoading,
  } = usePatrimony();
  const [detailId, setDetailId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);

  const [search, setSearch] = useState("");
  const [type, setType] = useState("ALL");
  const [sortKey, setSortKey] = useState<InvestmentSortKey | null>(null);
  const [direction, setDirection] = useState<InvestmentSortDirection>("asc");
  const types = [...new Set(investments.map((row) => row.asset.asset_type))];
  const displayed = useMemo(() => portfolioView(investments, { search, type, sortKey, direction }), [investments, search, type, sortKey, direction]);
  const sortHeader = (key: InvestmentSortKey, label: string, numeric = false) => (
    <TableHead className={numeric ? "text-right" : undefined} aria-sort={sortKey === key ? direction === "asc" ? "ascending" : "descending" : "none"}>
      <Button variant="ghost" size="sm" className={numeric ? "ml-auto whitespace-nowrap" : "whitespace-nowrap"} aria-label={`Ordenar por ${label}`} onClick={() => {
        setSortKey(key);
        setDirection(sortKey === key && direction === "asc" ? "desc" : "asc");
      }}>
        {label}{sortKey !== key ? <ArrowUpDown className="h-3 w-3" /> : direction === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      </Button>
    </TableHead>
  );

  return (
    <div className="min-w-0 w-full space-y-6 [contain:inline-size]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Investimentos</h1>
          <p className="text-sm text-muted-foreground">
            Ativos classificados como investimentos (renda fixa, ações, fundos, cripto…).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/investimentos/importar-b3">
              <FileSpreadsheet className="mr-1 h-4 w-4" /> Importar B3
            </Link>
          </Button>
          {hasQuotableAssets && (
            <QuoteRefreshButton
              isFetching={isQuotesFetching}
              updatedAt={quotesUpdatedAt}
              cooldownUntil={quotesCooldownUntil}
              nextAutoUpdate={quotesNextAutoUpdate}
              onRefresh={() => void refreshQuotes()}
            />
          )}
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            disabled={!wsId}
          >
            <Plus className="mr-1 h-4 w-4" /> Novo investimento
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <Tabs defaultValue="portfolio" className="space-y-6">
          <TabsList aria-label="Visões de investimentos">
            <TabsTrigger value="portfolio">Carteira</TabsTrigger>
            <TabsTrigger value="analysis">Análise</TabsTrigger>
          </TabsList>
          <TabsContent value="portfolio" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KpiWidget title="Investido" value={investmentTotals.invested} icon={Wallet} />
            <KpiWidget title="Valor atual" value={investmentTotals.current} icon={PieIcon} />
            <KpiWidget
              title="Lucro/Prejuízo"
              value={investmentTotals.profit}
              icon={TrendingUp}
              tone={investmentTotals.profit >= 0 ? "positive" : "negative"}
            />
            <KpiWidget
              title="Rentabilidade"
              value={Number(investmentTotals.profitPercent.toFixed(2))}
              icon={TrendingUp}
              tone={investmentTotals.profitPercent >= 0 ? "positive" : "negative"}
              suffix="%"
            />
          </div>

          <InvestmentPortfolioSummary rows={investments} />

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Carteira ({displayed.length}{displayed.length !== investments.length ? ` de ${investments.length}` : ""})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex flex-wrap gap-3">
                <div className="relative min-w-0 flex-1 basis-64">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input aria-label="Buscar por nome ou ticker" placeholder="Buscar por nome ou ticker" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                </div>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger aria-label="Tipo de investimento" className="w-full sm:w-56"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="ALL">Todos os tipos</SelectItem>{types.map((t) => <SelectItem key={t} value={t}>{ASSET_TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
                </Select>
                {(search || type !== "ALL" || sortKey) && <Button variant="outline" onClick={() => { setSearch(""); setType("ALL"); setSortKey(null); setDirection("asc"); }}>Limpar filtros</Button>}
              </div>
              {investments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Nenhum investimento cadastrado ainda.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {sortHeader("name", "Ativo")}
                        {sortHeader("ticker", "Código")}
                        {sortHeader("type", "Classe")}
                        {sortHeader("quantity", "Qtd.", true)}
                        {sortHeader("averagePrice", "PM", true)}
                        {sortHeader("quote", "Cotação", true)}
                        {sortHeader("invested", "Investido", true)}
                        {sortHeader("current", "Atual", true)}
                        {sortHeader("profitPercent", "Rentab.", true)}
                        {sortHeader("accumulatedIncome", "Proventos acumulados", true)}
                        {sortHeader("economicReturn", "Retorno econômico", true)}
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayed.length === 0 && <TableRow><TableCell colSpan={12} className="py-8 text-center text-muted-foreground">Nenhum investimento corresponde à busca e ao tipo selecionado.</TableCell></TableRow>}
                      {displayed.map((r) => {
                        const positive = r.profit >= 0;
                        const quoted = quotedById.get(r.asset.id);
                        return (
                          <TableRow key={r.asset.id}>
                            <TableCell className="font-medium">
                              <Button
                                variant="link"
                                className="h-auto whitespace-normal p-0 text-left text-foreground"
                                onClick={() => setDetailId(r.asset.id)}
                              >
                                {r.asset.name}
                              </Button>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {r.asset.ticker || "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {ASSET_TYPE_LABELS[r.asset.asset_type]}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {Number(r.asset.quantity).toLocaleString("pt-BR", {
                                maximumFractionDigits: 8,
                              })}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatCurrency(r.asset.unit_price, r.asset.currency)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {quoted?.quote ? (
                                formatCurrency(
                                  quoted.quote.price,
                                  quoted.quote.currency || r.asset.currency,
                                )
                              ) : quoted?.quotable ? (
                                <span className="text-xs text-muted-foreground">
                                  Cotação indisponível
                                </span>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatCurrency(r.invested, r.asset.currency)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatCurrency(r.current, r.asset.currency)}
                            </TableCell>
                            <TableCell
                              className={`text-right tabular-nums ${
                                positive ? "text-emerald-600" : "text-red-600"
                              }`}
                            >
                              {formatCurrency(r.profit, r.asset.currency)} (
                              {r.profitPercent.toFixed(2)}%)
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatCurrency(r.accumulatedIncome, r.asset.currency)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {r.economicReturn === null
                                ? "—"
                                : formatCurrency(r.economicReturn, r.asset.currency)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditing(r.asset);
                                  setFormOpen(true);
                                }}
                              >
                                Editar
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
          </TabsContent>
          <TabsContent value="analysis">
            <InvestmentAnalysis workspaceId={wsId} rows={investments} movements={movements} />
          </TabsContent>
        </Tabs>
      )}

      <AssetDetailDialog
        open={!!detailId}
        onOpenChange={(o) => !o && setDetailId(null)}
        asset={(detailId ? quotedById.get(detailId) : null) ?? null}
        movements={movements}
        onRefreshQuote={(t) => void refreshQuote(t)}
        quoteRefreshing={pendingQuoteTickers.has(
          ((detailId ? quotedById.get(detailId)?.ticker : null) ?? "").toUpperCase(),
        )}
      />

      {wsId && (
        <AssetFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          workspaceId={wsId}
          asset={editing}
        />
      )}
    </div>
  );
}
