// Sprint 4.15A — Confirmação explícita de uma ação da conciliação de fatura.
// Dialog pequeno: mostra o antes/depois e exige confirmação do usuário.
import { useEffect, useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/format";
import type { InvoiceReconciliationItem } from "@/models/CardInvoiceReconciliation";
import {
  INVOICE_ACTION_LABELS,
  type ExecuteInvoiceActionInput,
  type InvoiceReconciliationActionType,
} from "@/models/CardInvoiceReconciliationAction";

export interface InvoiceActionPayload {
  movementId?: string | null;
  newAmount?: number;
  newDate?: string;
  newCompetence?: string;
  reason?: string | null;
}

export function InvoiceReconciliationActionDialog({
  item,
  action,
  pending,
  onClose,
  onConfirm,
}: {
  item: InvoiceReconciliationItem | null;
  action: InvoiceReconciliationActionType | null;
  pending?: boolean;
  onClose: () => void;
  onConfirm: (payload: InvoiceActionPayload) => void;
}) {
  const open = !!item && !!action;
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [competence, setCompetence] = useState("");
  const [reason, setReason] = useState("");
  const [candidateId, setCandidateId] = useState<string>("");

  useEffect(() => {
    if (!open || !item) return;
    setAmount(String(item.official_amount ?? item.system_amount ?? ""));
    setDate(item.official_date ?? item.system_date ?? "");
    setCompetence(item.official_date ?? item.system_date ?? "");
    setReason("");
    setCandidateId(item.candidates[0]?.movement_id ?? "");
  }, [open, item]);

  const description = useMemo(() => {
    switch (action) {
      case "CORRECT_AMOUNT":
        return "O valor do lançamento será ajustado para o valor da fatura oficial.";
      case "CORRECT_DATE":
        return "A data do lançamento será ajustada para a data da fatura oficial.";
      case "CORRECT_COMPETENCE":
        return "A competência do lançamento será ajustada.";
      case "LINK_EXISTING_MOVEMENT":
      case "SELECT_MATCH_CANDIDATE":
        return "O lançamento existente será vinculado a esta fatura. Nenhum lançamento novo é criado.";
      case "MARK_NOT_SAME_MOVEMENT":
        return "A sugestão será descartada permanentemente. Nenhum valor é alterado.";
      case "IGNORE_DIVERGENCE":
        return "A divergência deixa de ser pendência, mas continua registrada no histórico.";
      default:
        return "";
    }
  }, [action]);

  function confirm() {
    if (!action) return;
    const payload: InvoiceActionPayload = { reason: reason.trim() || null };
    if (action === "CORRECT_AMOUNT") payload.newAmount = Number(amount);
    if (action === "CORRECT_DATE") payload.newDate = date;
    if (action === "CORRECT_COMPETENCE") payload.newCompetence = competence;
    if (action === "LINK_EXISTING_MOVEMENT" || action === "SELECT_MATCH_CANDIDATE") {
      payload.movementId = candidateId;
    }
    onConfirm(payload);
  }

  const invalid =
    (action === "CORRECT_AMOUNT" && !(Number(amount) > 0)) ||
    (action === "CORRECT_DATE" && !date) ||
    (action === "CORRECT_COMPETENCE" && !competence) ||
    ((action === "LINK_EXISTING_MOVEMENT" || action === "SELECT_MATCH_CANDIDATE") &&
      !candidateId);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{action ? INVOICE_ACTION_LABELS[action] : ""}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {item && (
          <div className="space-y-4">
            <div className="rounded-md border p-3 text-sm">
              <p className="font-medium">
                {item.official?.description ?? item.movement?.description ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                Fatura: {item.official_amount !== null ? formatCurrency(item.official_amount) : "—"}
                {item.official_date ? ` · ${formatDate(item.official_date)}` : ""} · Sistema:{" "}
                {item.system_amount !== null ? formatCurrency(item.system_amount) : "—"}
                {item.system_date ? ` · ${formatDate(item.system_date)}` : ""}
              </p>
            </div>

            {action === "CORRECT_AMOUNT" && (
              <div className="space-y-1">
                <Label htmlFor="new-amount">Novo valor</Label>
                <Input
                  id="new-amount"
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            )}

            {action === "CORRECT_DATE" && (
              <div className="space-y-1">
                <Label htmlFor="new-date">Nova data</Label>
                <Input
                  id="new-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            )}

            {action === "CORRECT_COMPETENCE" && (
              <div className="space-y-1">
                <Label htmlFor="new-competence">Nova competência</Label>
                <Input
                  id="new-competence"
                  type="date"
                  value={competence}
                  onChange={(e) => setCompetence(e.target.value)}
                />
              </div>
            )}

            {(action === "LINK_EXISTING_MOVEMENT" ||
              action === "SELECT_MATCH_CANDIDATE") && (
              <div className="space-y-1">
                <Label>Lançamento correspondente</Label>
                <Select value={candidateId} onValueChange={setCandidateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o lançamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {item.candidates.map((c) => (
                      <SelectItem key={c.movement_id} value={c.movement_id}>
                        {c.description} · {formatCurrency(c.amount)} · {c.confidence}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="action-reason">Motivo (opcional)</Label>
              <Textarea
                id="action-reason"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Registrado na auditoria desta fatura"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={confirm} disabled={pending || invalid}>
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
