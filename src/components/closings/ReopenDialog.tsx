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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  onConfirm: (reason: string) => void;
}

export function ReopenDialog({ open, onOpenChange, isPending, onConfirm }: Props) {
  const [reason, setReason] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reabrir fechamento</DialogTitle>
          <DialogDescription>
            Informe o motivo. A reabertura fica registrada na auditoria e o snapshot
            gravado permanece inalterado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="reopen-reason">Motivo</Label>
          <Textarea
            id="reopen-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex.: lançamentos de cartão importados após o fechamento."
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={isPending || reason.trim().length < 3} onClick={() => onConfirm(reason.trim())}>
            {isPending ? "Reabrindo…" : "Reabrir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
