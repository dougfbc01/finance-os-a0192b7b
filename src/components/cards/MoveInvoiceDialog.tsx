import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/format";
import type { CardInvoice } from "@/models/CardInvoice";
import type { InvoiceReconciliationItem } from "@/models/CardInvoiceReconciliation";

export function MoveInvoiceDialog({
  item,
  currentInvoice,
  invoices,
  cardName,
  pending,
  onClose,
  onConfirm,
}: {
  item: InvoiceReconciliationItem | null;
  currentInvoice: CardInvoice | null;
  invoices: CardInvoice[];
  cardName: string;
  pending: boolean;
  onClose: () => void;
  onConfirm: (targetInvoiceId: string, reason: string) => void;
}) {
  const [targetId, setTargetId] = useState("");
  const [reason, setReason] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const targets = useMemo(
    () => invoices.filter((invoice) => invoice.id !== currentInvoice?.id),
    [invoices, currentInvoice?.id],
  );
  const target = targets.find((invoice) => invoice.id === targetId) ?? null;

  useEffect(() => {
    if (!item) return;
    setTargetId("");
    setReason("");
    setReviewing(false);
  }, [item]);

  const movement = item?.movement ?? null;
  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Mover para outra fatura</DialogTitle>
          <DialogDescription>
            Escolha outra fatura do mesmo cartão e revise a alteração antes de confirmar.
          </DialogDescription>
        </DialogHeader>

        {currentInvoice && movement && (
          <div className="space-y-4 text-sm">
            <section className="space-y-1 rounded-md border p-3">
              <h3 className="font-medium">Fatura atual</h3>
              <p>{cardName} · competência {formatDate(currentInvoice.competence)}</p>
              <p className="text-muted-foreground">
                Fecha {formatDate(currentInvoice.closing_date)} · vence {formatDate(currentInvoice.due_date)} · {formatCurrency(currentInvoice.amount)}
              </p>
            </section>
            <section className="space-y-1 rounded-md border p-3">
              <h3 className="font-medium">Lançamento</h3>
              <p>{movement.description} · {formatCurrency(Number(movement.amount))}</p>
              <p className="text-muted-foreground">
                Data {formatDate(movement.transaction_date)} · competência {movement.competence_date ? formatDate(movement.competence_date) : "—"}
              </p>
            </section>

            {!reviewing ? (
              <>
                <div className="space-y-1">
                  <Label>Fatura destino</Label>
                  <Select value={targetId} onValueChange={setTargetId}>
                    <SelectTrigger><SelectValue placeholder="Selecione uma fatura" /></SelectTrigger>
                    <SelectContent>
                      {targets.map((invoice) => (
                        <SelectItem key={invoice.id} value={invoice.id}>
                          {formatDate(invoice.competence)} · {invoice.status} · {formatCurrency(invoice.amount)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {target && (
                    <p className="text-xs text-muted-foreground">
                      Fecha {formatDate(target.closing_date)} · vence {formatDate(target.due_date)}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="move-invoice-reason">Motivo</Label>
                  <Textarea id="move-invoice-reason" value={reason} onChange={(event) => setReason(event.target.value)} rows={2} />
                </div>
              </>
            ) : target ? (
              <section className="space-y-3 rounded-md border p-3">
                <h3 className="font-medium">Revisão</h3>
                <div><span className="text-muted-foreground">Antes: </span>{formatDate(currentInvoice.competence)} · {movement.description} · {formatCurrency(Number(movement.amount))}</div>
                <div className="flex items-center gap-2"><ArrowRight className="h-4 w-4" /><span><span className="text-muted-foreground">Depois: </span>{formatDate(target.competence)}</span></div>
                <p className="text-muted-foreground">O lançamento será movido da fatura atual para a fatura selecionada. Nenhum novo lançamento será criado.</p>
                <p><span className="text-muted-foreground">Motivo: </span>{reason.trim()}</p>
              </section>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={reviewing ? () => setReviewing(false) : onClose} disabled={pending}>
            {reviewing ? "Voltar" : "Cancelar"}
          </Button>
          {!reviewing ? (
            <Button onClick={() => setReviewing(true)} disabled={!targetId || !reason.trim()}>Revisar</Button>
          ) : (
            <Button onClick={() => target && onConfirm(target.id, reason.trim())} disabled={pending || !target}>Confirmar movimentação</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}