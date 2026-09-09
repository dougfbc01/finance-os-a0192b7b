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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { InvoiceReconciliationDetailDialog } from "@/components/cards/InvoiceReconciliationDetailDialog";
import {
  InvoiceReconciliationActionDialog,
  type InvoiceActionPayload,
} from "@/components/cards/InvoiceReconciliationActionDialog";
import { InvoiceReconciliationHistory } from "@/components/cards/InvoiceReconciliationHistory";
import { CreateMissingMovementDialog } from "@/components/cards/CreateMissingMovementDialog";
import { useCards } from "@/hooks/useCards";
import type { CreateMissingMovementPayload } from "@/models/CardInvoiceReconciliationAction";
import {
  useCardInvoice,
  useRunInvoiceReconciliation,
} from "@/hooks/useCardInvoiceReconciliation";
import {
  useExecuteInvoiceAction,
  useInvoiceReconciliationActions,
  useUndoInvoiceAction,
} from "@/hooks/useInvoiceReconciliationActions";
import { CardInvoiceReconciliationServiceImpl } from "@/services/CardInvoiceReconciliationService";
import { CardInvoiceReconciliationActionServiceImpl } from "@/services/CardInvoiceReconciliationActionService";
import {
  INVOICE_ACTION_LABELS,
  type InvoiceReconciliationActionType,
} from "@/models/CardInvoiceReconciliationAction";
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
  // Sprint 4.15C — a fatura da rota é o alvo fixo de toda a conciliação.
  const selectedInvoiceId = invoiceId;
  const { data: invoice } = useCardInvoice(selectedInvoiceId);

  const run = useRunInvoiceReconciliation();
  const { data: actions = [] } = useInvoiceReconciliationActions(invoiceId);
  const executeAction = useExecuteInvoiceAction(invoiceId);
  const undoAction = useUndoInvoiceAction(invoiceId);
  const [rawResult, setRawResult] = useState<InvoiceReconciliationResult | null>(null);
  const [lastLines, setLastLines] = useState<OfficialInvoiceLine[] | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<InvoiceReconciliationStatus | "all">("all");
  const [selected, setSelected] = useState<InvoiceReconciliationItem | null>(null);
  const [actionItem, setActionItem] = useState<InvoiceReconciliationItem | null>(null);
  const [actionType, setActionType] = useState<InvoiceReconciliationActionType | null>(null);
  const [createItem, setCreateItem] = useState<InvoiceReconciliationItem | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  // Sprint 4.15C — correção de data que mudaria o lançamento de fatura.
  const [movePending, setMovePending] = useState<InvoiceActionPayload | null>(null);

  const { data: cards = [] } = useCards(invoice?.workspace_id);
  const card = cards.find((c) => c.id === invoice?.card_id) ?? null;

  // Decisões humanas persistidas são reaplicadas sobre o diagnóstico puro.
  const result = useMemo(
    () =>
      rawResult
        ? CardInvoiceReconciliationActionServiceImpl.applyDecisions(rawResult, actions)
        : null,
    [rawResult, actions],
  );

  const items = useMemo(() => {
    const all = result?.items ?? [];
    return statusFilter === "all" ? all : all.filter((i) => i.status === statusFilter);
  }, [result, statusFilter]);

  async function execute(officialLines?: OfficialInvoiceLine[]) {
    const data = await run.mutateAsync({ invoiceId, officialLines });
    setLastLines(officialLines);
    setRawResult(data);
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

  async function runAction(payload: InvoiceActionPayload, allowInvoiceChange = false) {
    if (!actionItem || !actionType || !invoice) return;
    const movementId = payload.movementId ?? actionItem.movement?.id ?? null;
    try {
      await executeAction.mutateAsync({
        workspaceId: invoice.workspace_id,
        // A fatura da rota é o alvo obrigatório durante todo o fluxo.
        invoiceId: selectedInvoiceId,
        itemKey: actionItem.key,
        action: actionType,
        movementId,
        relatedMovementId: actionItem.candidates[0]?.movement_id ?? null,
        expectedSignature: CardInvoiceReconciliationActionServiceImpl.signature(
          actionItem.movement,
        ),
        newAmount: payload.newAmount,
        newDate: payload.newDate,
        newCompetence: payload.newCompetence,
        reason: payload.reason,
        allowInvoiceChange,
      });
      toast.success(`${INVOICE_ACTION_LABELS[actionType]} aplicada.`);
      setActionItem(null);
      setActionType(null);
      setMovePending(null);
      // Recalcula o diagnóstico DESTA fatura, sem recarregar a página.
      await execute(lastLines);
    } catch (err) {
      if (err instanceof InvoiceChangeRequiresConfirmationError) {
        setMovePending(payload);
        return;
      }
      toast.error(err instanceof Error ? err.message : "Não foi possível aplicar a ação.");
    }
  }

  async function confirmAction(payload: InvoiceActionPayload) {
    await runAction(payload, false);
  }


  // Sprint 4.15B — criação manual do lançamento faltante.
  async function confirmCreate(
    payload: CreateMissingMovementPayload,
    reason: string | null,
  ) {
    if (!createItem || !invoice) return;
    try {
      await executeAction.mutateAsync({
        workspaceId: invoice.workspace_id,
        invoiceId,
        itemKey: createItem.key,
        action: "CREATE_MISSING_MOVEMENT",
        createPayload: payload,
        reason,
      });
      toast.success("Lançamento criado e vinculado à fatura.");
      setCreateItem(null);
      await execute(lastLines);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível criar o lançamento.");
      setCreateItem(null);
      await execute(lastLines);
    }
  }

  async function undo(id: string) {
    try {
      await undoAction.mutateAsync(id);
      toast.success("Ação desfeita.");
      await execute(lastLines);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível desfazer.");
    }
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
                      <th className="p-3 text-right">Ações</th>
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
                        <td
                          className="p-3 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {item.decided ? (
                            <Badge variant="secondary">Decidido</Badge>
                          ) : (
                            <ItemActionsMenu
                              item={item}
                               onPick={(a) => {
                                 if (a === "CREATE_MISSING_MOVEMENT") {
                                   setCreateItem(item);
                                   return;
                                 }
                                 setActionItem(item);
                                 setActionType(a);
                               }}
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr>
                        <td className="p-6 text-center text-muted-foreground" colSpan={7}>
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

      <InvoiceReconciliationHistory
        actions={actions}
        pending={undoAction.isPending}
        onUndo={undo}
      />

      <InvoiceReconciliationDetailDialog item={selected} onClose={() => setSelected(null)} />

      <InvoiceReconciliationActionDialog
        item={actionItem}
        action={actionType}
        pending={executeAction.isPending}
        onClose={() => {
          setActionItem(null);
          setActionType(null);
        }}
        onConfirm={confirmAction}
      />

      <CreateMissingMovementDialog
        item={createItem}
        cardId={invoice?.card_id ?? null}
        cardName={card?.name ?? "Cartão"}
        competence={invoice?.competence ?? null}
        pending={executeAction.isPending}
        onClose={() => setCreateItem(null)}
        onConfirm={confirmCreate}
      />
    </div>
  );
}

function ItemActionsMenu({
  item,
  onPick,
}: {
  item: InvoiceReconciliationItem;
  onPick: (action: InvoiceReconciliationActionType) => void;
}) {
  const available = CardInvoiceReconciliationActionServiceImpl.availableActions(item);
  if (available.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          Resolver
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {available.map((a) => (
          <DropdownMenuItem key={a} onSelect={() => onPick(a)}>
            {INVOICE_ACTION_LABELS[a]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
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
