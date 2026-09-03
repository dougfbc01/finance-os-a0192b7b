// Sprint 4.14 — Detalhe auditável de um item da conciliação.
// Header/footer fixos, corpo rolável (padrão scrollable-dialog).
import { Dialog, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  DialogSection,
  ScrollableDialogBody,
  ScrollableDialogContent,
  ScrollableDialogFooter,
  ScrollableDialogHeader,
} from "@/components/ui/scrollable-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  INVOICE_RECONCILIATION_STATUS_LABELS,
  type InvoiceReconciliationItem,
} from "@/models/CardInvoiceReconciliation";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium tabular-nums">{value ?? "—"}</span>
    </div>
  );
}

export function InvoiceReconciliationDetailDialog({
  item,
  onClose,
}: {
  item: InvoiceReconciliationItem | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <ScrollableDialogContent className="sm:max-w-xl">
        <ScrollableDialogHeader>
          <DialogTitle>Detalhe da divergência</DialogTitle>
          <DialogDescription>
            {item ? INVOICE_RECONCILIATION_STATUS_LABELS[item.status] : ""} · diagnóstico
            somente leitura
          </DialogDescription>
        </ScrollableDialogHeader>

        <ScrollableDialogBody>
          {item && (
            <>
              <DialogSection title="Dados da fatura">
                {item.official ? (
                  <>
                    <Row label="Descrição" value={item.official.description} />
                    <Row label="Data" value={formatDate(item.official.date)} />
                    <Row label="Valor" value={formatCurrency(item.official.amount)} />
                    <Row
                      label="Parcela"
                      value={
                        item.installment
                          ? `${item.installment}/${item.installments_total}`
                          : "—"
                      }
                    />
                    <Row label="Identificador" value={item.official.external_ref ?? "—"} />
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Não há linha correspondente na fatura oficial.
                  </p>
                )}
              </DialogSection>

              <DialogSection title="Dados do Finance OS">
                {item.movement ? (
                  <>
                    <Row label="Descrição" value={item.movement.description} />
                    <Row label="Data" value={formatDate(item.movement.transaction_date)} />
                    <Row label="Valor" value={formatCurrency(Number(item.movement.amount))} />
                    <Row label="Tipo" value={item.movement.type} />
                    <Row label="Status" value={item.movement.status} />
                    <Row
                      label="Importação"
                      value={item.movement.import_id ? "Importada" : "Manual"}
                    />
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhum movimento foi vinculado a esta linha.
                  </p>
                )}
              </DialogSection>

              <DialogSection title="Diferenças">
                <Row
                  label="Valor (fatura x sistema)"
                  value={
                    item.official_amount !== null && item.system_amount !== null
                      ? `${formatCurrency(item.official_amount)} x ${formatCurrency(item.system_amount)} = ${formatCurrency(item.amount_difference ?? 0)}`
                      : "—"
                  }
                />
                <Row
                  label="Data (fatura x sistema)"
                  value={
                    item.official_date && item.system_date
                      ? `${formatDate(item.official_date)} x ${formatDate(item.system_date)} (${item.date_diff_days ?? 0} dia(s))`
                      : "—"
                  }
                />
              </DialogSection>

              <DialogSection title="Diagnóstico">
                <p className="text-sm">{item.diagnosis}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Confiança: {item.confidence}%
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {item.matching_signals.map((s, i) => (
                    <li key={i}>
                      <span
                        className={
                          s.kind === "POSITIVE"
                            ? "text-emerald-600"
                            : s.kind === "WARNING"
                              ? "text-amber-600"
                              : "text-destructive"
                        }
                      >
                        {s.kind === "POSITIVE" ? "✓" : s.kind === "WARNING" ? "⚠" : "✕"}
                      </span>{" "}
                      {s.label}
                    </li>
                  ))}
                </ul>
              </DialogSection>

              {item.candidates.length > 0 && (
                <DialogSection title="Candidatos encontrados">
                  <ul className="space-y-2">
                    {item.candidates.map((c) => (
                      <li key={c.movement_id} className="rounded-md border p-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">{c.description}</span>
                          <Badge variant="outline">{c.confidence}%</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(c.transaction_date)} · {formatCurrency(c.amount)} ·{" "}
                          {c.reasons.join(", ")}
                        </p>
                      </li>
                    ))}
                  </ul>
                </DialogSection>
              )}
            </>
          )}
        </ScrollableDialogBody>

        <ScrollableDialogFooter>
          <p className="mr-auto self-center text-xs text-muted-foreground">
            Diagnóstico não altera nenhum dado financeiro.
          </p>
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </ScrollableDialogFooter>
      </ScrollableDialogContent>
    </Dialog>
  );
}
