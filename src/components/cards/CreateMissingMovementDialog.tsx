// Sprint 4.15B — Criação MANUAL do lançamento que consta na fatura e não existe
// no sistema. Nada é criado automaticamente: o usuário revisa os dados e depois
// confirma explicitamente numa segunda etapa.
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate } from "@/lib/format";
import type { InvoiceReconciliationItem } from "@/models/CardInvoiceReconciliation";
import type { CreateMissingMovementPayload } from "@/models/CardInvoiceReconciliationAction";

export function CreateMissingMovementDialog({
  item,
  cardId,
  cardName,
  competence,
  pending,
  onClose,
  onConfirm,
}: {
  item: InvoiceReconciliationItem | null;
  cardId: string | null;
  cardName: string;
  competence: string | null;
  pending?: boolean;
  onClose: () => void;
  onConfirm: (payload: CreateMissingMovementPayload, reason: string | null) => void;
}) {
  const open = !!item && !!cardId;
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [competenceDate, setCompetenceDate] = useState("");
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open || !item) return;
    setStep("form");
    setDescription(item.official?.description ?? "");
    setAmount(String(Math.abs(Number(item.official_amount ?? 0)) || ""));
    setDate(item.official_date ?? "");
    setCompetenceDate(competence ?? item.official_date ?? "");
    setNotes("");
    setReason("");
  }, [open, item, competence]);

  const installmentLabel =
    item?.installment && item?.installments_total
      ? `${item.installment}/${item.installments_total}`
      : null;

  const invalid = !description.trim() || !(Number(amount) > 0) || !date;

  function confirm() {
    if (!cardId || invalid) return;
    onConfirm(
      {
        cardId,
        description: description.trim(),
        amount: Number(amount),
        transactionDate: date,
        competenceDate: competenceDate || null,
        installment: item?.installment ?? null,
        installmentsTotal: item?.installments_total ?? null,
        notes: notes.trim() || null,
      },
      reason.trim() || null,
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === "form" ? "Criar lançamento" : "Criar lançamento?"}
          </DialogTitle>
          <DialogDescription>
            {step === "form"
              ? "Os dados vêm da fatura e podem ser revisados antes de salvar."
              : "Confira os dados. O lançamento será criado e vinculado a esta fatura."}
          </DialogDescription>
        </DialogHeader>

        {step === "form" ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="cm-description">Descrição</Label>
              <Input
                id="cm-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="cm-amount">Valor</Label>
                <Input
                  id="cm-amount"
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cm-date">Data</Label>
                <Input
                  id="cm-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="cm-competence">Competência</Label>
              <Input
                id="cm-competence"
                type="date"
                value={competenceDate}
                onChange={(e) => setCompetenceDate(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Cartão: {cardName}
              {installmentLabel ? ` · Parcela: ${installmentLabel}` : ""}
            </p>
            <div className="space-y-1">
              <Label htmlFor="cm-notes">Observações (opcional)</Label>
              <Textarea
                id="cm-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cm-reason">Motivo (opcional)</Label>
              <Textarea
                id="cm-reason"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex.: estava na fatura, mas não havia sido importado"
              />
            </div>
          </div>
        ) : (
          <dl className="space-y-2 rounded-md border p-3 text-sm">
            <Row label="Descrição" value={description} />
            <Row label="Data" value={date ? formatDate(date) : "—"} />
            <Row label="Valor" value={formatCurrency(Number(amount) || 0)} />
            <Row label="Cartão" value={cardName} />
            {installmentLabel && <Row label="Parcela" value={installmentLabel} />}
            {reason.trim() && <Row label="Motivo" value={reason.trim()} />}
          </dl>
        )}

        <DialogFooter>
          {step === "form" ? (
            <>
              <Button variant="ghost" onClick={onClose} disabled={pending}>
                Cancelar
              </Button>
              <Button onClick={() => setStep("confirm")} disabled={invalid || pending}>
                Continuar
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setStep("form")} disabled={pending}>
                Cancelar
              </Button>
              <Button onClick={confirm} disabled={pending}>
                Confirmar criação
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
