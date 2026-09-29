import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  useCommitmentMovementCandidates,
  useReconcileCommitmentInstallment,
} from "@/hooks/useCommitments";
import type { UUID } from "@/models";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  installmentId: UUID | null;
  installmentLabel: string;
  amount: number;
}

export function CommitmentMovementDialog({
  open,
  onOpenChange,
  installmentId,
  installmentLabel,
  amount,
}: Props) {
  const { data: candidates = [], isLoading } = useCommitmentMovementCandidates(
    open ? installmentId ?? undefined : undefined,
  );
  const reconcile = useReconcileCommitmentInstallment();
  const [selected, setSelected] = useState<UUID | null>(null);

  useEffect(() => setSelected(null), [installmentId, open]);

  const handleConfirm = async () => {
    if (!installmentId || !selected) return;
    try {
      await reconcile.mutateAsync({ installmentId, movementId: selected });
      toast.success("Parcela conciliada com a movimentação real.");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível conciliar a parcela.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Conciliar parcela {installmentLabel}</DialogTitle>
          <DialogDescription>
            Valor esperado: {formatCurrency(amount)}. Selecione um lançamento bancário real.
            Nenhum novo lançamento será criado.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="py-6 text-sm text-muted-foreground">Procurando lançamentos compatíveis…</p>
        ) : candidates.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            Nenhuma despesa compatível encontrada na conta/cartão vinculado, até 7 dias do vencimento.
          </p>
        ) : (
          <div className="max-h-[50vh] space-y-2 overflow-y-auto">
            {candidates.map((candidate) => {
              const m = candidate.movement;
              const active = selected === m.id;
              return (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setSelected(m.id)}
                  className="w-full text-left"
                >
                  <Card className={active ? "border-primary ring-1 ring-primary" : ""}>
                    <CardContent className="flex items-center justify-between gap-4 p-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{m.description || "Sem descrição"}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(m.transaction_date)} · {candidate.dayDiff} dia(s) do vencimento
                        </p>
                      </div>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <span className="font-semibold">{formatCurrency(Math.abs(m.amount))}</span>
                        {active && <CheckCircle2 className="h-4 w-4 text-primary" />}
                      </div>
                    </CardContent>
                  </Card>
                </button>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!selected || reconcile.isPending}>
            {reconcile.isPending ? "Conciliando…" : "Confirmar conciliação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
