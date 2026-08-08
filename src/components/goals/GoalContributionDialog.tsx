import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAddContribution } from "@/hooks/useFinancialGoals";
import { toISODate } from "@/lib/format";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  goalId: string;
}

/** Registro de aporte real da meta (histórico verdadeiro, sem movimentação artificial). */
export function GoalContributionDialog({ open, onOpenChange, workspaceId, goalId }: Props) {
  const mut = useAddContribution();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(toISODate(new Date()));
  const [notes, setNotes] = useState("");

  const submit = () => {
    const value = Number(amount.replace(",", "."));
    if (!value) return toast.error("Informe um valor");
    mut.mutate(
      {
        workspace_id: workspaceId,
        goal_id: goalId,
        amount: value,
        contribution_date: date,
        notes: notes.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success("Aporte registrado");
          setAmount("");
          setNotes("");
          onOpenChange(false);
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar aporte</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="c-amount">Valor</Label>
            <Input
              id="c-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="c-date">Data</Label>
            <Input
              id="c-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="c-notes">Observação</Label>
            <Input id="c-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={mut.isPending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
