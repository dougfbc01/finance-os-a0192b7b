// Sprint 4.14 — Conciliação DIAGNÓSTICA de fatura de cartão.
// Nenhuma ação desta tela cria, altera ou exclui movimentos ou faturas.
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FileUp, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InvoiceReconciliationDetailDialog } from "@/components/cards/InvoiceReconciliationDetailDialog";
import {
  useCardInvoice,
  useRunInvoiceReconciliation,
} from "@/hooks/useCardInvoiceReconciliation";
import { CardInvoiceReconciliationServiceImpl } from "@/services/CardInvoiceReconciliationService";
import { formatCurrency, formatDate } from "@/lib/format";
import { ROUTES } from "@/constants";
import {
  INVOICE_RECONCILIATION_STATUS_LABELS,
  type InvoiceReconciliationItem,
  type InvoiceReconciliationResult,
  type InvoiceReconciliationStatus,
  type OfficialInvoiceLine,
} from "@/models/CardInvoiceReconciliation";

export const Route = createFileRoute("/_authenticated/cartoes_/faturas/$invoiceId/conciliacao")({
  head: () => ({
    meta: [
      { title: "Conciliação de fatura — Finance OS" },
      {
        name: "description",
        content:
          "Diagnóstico explicável entre a fatura oficial do cartão e os lançamentos do Finance OS.",
      },
      { property: "og:title", content: "Conciliação de fatura — Finance OS" },
      {
        property: "og:description",
        content: "Onde exatamente está a diferença entre a fatura e o sistema.",
      },
    ],
  }),
  component: ConciliacaoFaturaPage,
});

const STATUS_VARIANT: Record<InvoiceReconciliationStatus, string> = {
  MATCHED: "bg-emerald-500/10 text-emerald-600",
  PARTIAL_MATCH: "bg-emerald-500/10 text-emerald-600",
  MISSING_IN_SYSTEM: "bg-destructive/10 text-destructive",
  MISSING_IN_INVOICE: "bg-destructive/10 text-destructive",
  AMOUNT_MISMATCH: "bg-amber-500/10 text-amber-600",
  DATE_MISMATCH: "bg-amber-500/10 text-amber-600",
  POSSIBLE_DUPLICATE: "bg-amber-500/10 text-amber-600",
  AMBIGUOUS_MATCH: "bg-amber-500/10 text-amber-600",
  REFUND_OR_REVERSAL: "bg-sky-500/10 text-sky-600",
  INTEREST_OR_FEE: "bg-sky-500/10 text-sky-600",
  UNCLASSIFIED: "bg-muted text-muted-foreground",
};

function ConciliacaoFaturaPage() {
  const { invoiceId } = Route.useParams();
  const { data: invoice } = useCardInvoice(invoiceId);
  const run = useRunInvoiceReconciliation();
  const [result, setResult] = useState<InvoiceReconciliationResult | null>(null);
  const [statusFilter, setStatusFilter] = useState<InvoiceReconciliationStatus | "all">("all");
  const [selected, setSelected] = useState<InvoiceReconciliationItem | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const items = useMemo(() => {
    const all = result?.items ?? [];
    return statusFilter === "all" ? all : all.filter((i) => i.status === statusFilter);
  }, [result, statusFilter]);

  async function execute(officialLines?: OfficialInvoiceLine[]) {
    const data = await run.mutateAsync({ invoiceId, officialLines });
    setResult(data);
    setSelected(null);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    const lines = CardInvoiceReconciliationServiceImpl.parseOfficialLines(text);
    await execute(lines);
    e.target.value = "";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to={ROUTES.CARTOES}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Cartões
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Conciliação de fatura</h1>
          <p className="text-sm text-muted-foreground">
            {invoice
              ? `Competência ${formatDate(invoice.competence)} · fecha ${formatDate(invoice.closing_date)} · vence ${formatDate(invoice.due_date)}`
              : "Carregando fatura…"}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <label className="cursor-pointer">
              <FileUp className="mr-2 h-4 w-4" />
              {fileName ?? "Carregar fatura oficial (CSV)"}
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
            </label>
          </Button>
          <Button size="sm" onClick={() => execute()} disabled={run.isPending}>
            <RefreshCw className={`mr-2 h-4 w-4 ${run.isPending ? "animate-spin" : ""}`} />
            Executar diagnóstico
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Este diagnóstico é somente leitura: nenhuma movimentação é criada, alterada ou
        excluída automaticamente.
      </p>

      {result && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label="Valor oficial" value={formatCurrency(result.official_invoice_total)} />
            <SummaryCard label="Encontrado no sistema" value={formatCurrency(result.matched_total)} />
            <SummaryCard
              label="Diferença"
              value={formatCurrency(result.difference)}
              tone={Math.abs(result.difference) > 0.02 ? "warn" : "ok"}
            />
            <SummaryCard
              label="Situação"
              value={result.is_reconciled ? "Conciliada" : "Divergente"}
              tone={result.is_reconciled ? "ok" : "warn"}
            />
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>Conciliados: {result.matched_count}</span>
            <span>· Faltando no sistema: {result.missing_in_system_count}</span>
            <span>· Faltando na fatura: {result.missing_in_invoice_count}</span>
            <span>· Valor divergente: {result.amount_mismatch_count}</span>
            <span>· Data divergente: {result.date_mismatch_count}</span>
            <span>· Possíveis duplicidades: {result.possible_duplicate_count}</span>
            <span>· Estornos: {result.refund_count}</span>
            <span>· Encargos: {result.fee_count}</span>
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as InvoiceReconciliationStatus | "all")}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Filtrar por situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as situações</SelectItem>
                {Object.entries(INVOICE_RECONCILIATION_STATUS_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">{items.length} item(ns)</span>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="p-3">Situação</th>
                      <th className="p-3">Fatura</th>
                      <th className="p-3">Sistema</th>
                      <th className="p-3 text-right">Valor</th>
                      <th className="p-3 text-right">Diferença</th>
                      <th className="p-3 text-right">Confiança</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr
                        key={item.key}
                        className="cursor-pointer border-b last:border-0 hover:bg-muted/40"
                        onClick={() => setSelected(item)}
                      >
                        <td className="p-3">
                          <Badge variant="outline" className={STATUS_VARIANT[item.status]}>
                            {INVOICE_RECONCILIATION_STATUS_LABELS[item.status]}
                          </Badge>
                        </td>
                        <td className="p-3">
                          {item.official ? (
                            <>
                              <div className="truncate">{item.official.description}</div>
                              <div className="text-xs text-muted-foreground">
                                {formatDate(item.official.date)}
                              </div>
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3">
                          {item.movement ? (
                            <>
                              <div className="truncate">{item.movement.description}</div>
                              <div className="text-xs text-muted-foreground">
                                {formatDate(item.movement.transaction_date)}
                              </div>
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3 text-right tabular-nums">
                          {formatCurrency(item.official_amount ?? item.system_amount ?? 0)}
                        </td>
                        <td className="p-3 text-right tabular-nums">
                          {item.amount_difference !== null
                            ? formatCurrency(item.amount_difference)
                            : "—"}
                        </td>
                        <td className="p-3 text-right tabular-nums">{item.confidence}%</td>
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr>
                        <td className="p-6 text-center text-muted-foreground" colSpan={6}>
                          Nenhum item para esta situação.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!result && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Execute o diagnóstico para comparar a fatura com os lançamentos. Para comparar
            linha a linha, carregue o arquivo oficial da fatura (CSV).
          </CardContent>
        </Card>
      )}

      <InvoiceReconciliationDetailDialog item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={`text-lg font-semibold tabular-nums ${
            tone === "warn" ? "text-amber-600" : tone === "ok" ? "text-emerald-600" : ""
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
