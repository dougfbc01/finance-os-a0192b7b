import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { MONTH_LABELS, type ClosingSnapshot, type ClosingWarning } from "@/models/MonthlyClosing";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  month: number;
  preview: ClosingSnapshot | null;
  warnings: ClosingWarning[];
  isReclose: boolean;
  isPending: boolean;
  onConfirm: (notes: string) => void;
}

export function CloseMonthDialog({
  open,
  onOpenChange,
  year,
  month,
  preview,
  warnings,
  isReclose,
  isPending,
  onConfirm,
}: Props) {
  const [notes, setNotes] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isReclose ? "Refazer fechamento" : "Fechar"} {MONTH_LABELS[month - 1]} {year}
          </DialogTitle>
          <DialogDescription>
            Um snapshot auditável dos indicadores do período será gravado. O histórico
            anterior nunca é alterado.
          </DialogDescription>
        </DialogHeader>

        {preview && (
          <div className="grid grid-cols-2 gap-3 rounded-md border p-3 text-sm">
            <div>
              <p className="text-muted-foreground">Receitas</p>
              <p className="font-semibold tabular-nums">{formatCurrency(preview.totals.income)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Despesas</p>
              <p className="font-semibold tabular-nums">{formatCurrency(preview.totals.expense)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Resultado</p>
              <p className="font-semibold tabular-nums">{formatCurrency(preview.totals.result)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Patrimônio líquido</p>
              <p className="font-semibold tabular-nums">
                {formatCurrency(preview.totals.netWorth)}
              </p>
            </div>
          </div>
        )}

        {warnings.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Avisos (não bloqueiam o fechamento)</AlertTitle>
            <AlertDescription>
              <ul className="mt-1 list-disc pl-4">
                {warnings.map((w) => (
                  <li key={w.key}>
                    {w.label}: <strong>{w.count}</strong>
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="closing-notes">Observações (opcional)</Label>
          <Textarea
            id="closing-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Contexto do fechamento…"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={isPending || !preview} onClick={() => onConfirm(notes)}>
            {isPending ? "Fechando…" : "Confirmar fechamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
