import { useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateGoal, useUpdateGoal } from "@/hooks/useFinancialGoals";
import {
  GOAL_TYPE_LABELS,
  type FinancialGoal,
  type FinancialGoalType,
} from "@/models/FinancialGoal";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  goal?: FinancialGoal | null;
}

const TYPES = Object.keys(GOAL_TYPE_LABELS) as FinancialGoalType[];

export function GoalFormDialog({ open, onOpenChange, workspaceId, goal }: Props) {
  const createMut = useCreateGoal();
  const updateMut = useUpdateGoal();

  const [name, setName] = useState("");
  const [type, setType] = useState<FinancialGoalType>("EMERGENCY_RESERVE");
  const [target, setTarget] = useState("");
  const [initial, setInitial] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(goal?.name ?? "");
    setType(goal?.goal_type ?? "EMERGENCY_RESERVE");
    setTarget(goal ? String(goal.target_amount) : "");
    setInitial(goal ? String(goal.initial_amount) : "");
    setTargetDate(goal?.target_date ?? "");
    setDescription(goal?.description ?? "");
  }, [open, goal]);

  const submit = () => {
    const targetAmount = Number(target.replace(",", "."));
    if (!name.trim()) return toast.error("Informe o nome da meta");
    if (!targetAmount || targetAmount <= 0) return toast.error("Informe um valor alvo válido");

    const payload = {
      name: name.trim(),
      goal_type: type,
      target_amount: targetAmount,
      initial_amount: Number(initial.replace(",", ".")) || 0,
      target_date: targetDate || null,
      description: description.trim() || null,
    };

    const done = () => {
      toast.success(goal ? "Meta atualizada" : "Meta criada");
      onOpenChange(false);
    };
    const fail = (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro");

    if (goal) {
      updateMut.mutate({ id: goal.id, input: payload }, { onSuccess: done, onError: fail });
    } else {
      createMut.mutate(
        { workspace_id: workspaceId, ...payload },
        { onSuccess: done, onError: fail },
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{goal ? "Editar meta" : "Nova meta financeira"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="goal-name">Nome</Label>
            <Input
              id="goal-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Reserva de Emergência"
            />
          </div>

          <div className="grid gap-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as FinancialGoalType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {GOAL_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {type === "PATRIMONY" && (
              <p className="text-xs text-muted-foreground">
                Metas de Patrimônio acompanham automaticamente o patrimônio líquido já
                consolidado no sistema.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="goal-target">Valor alvo</Label>
              <Input
                id="goal-target"
                inputMode="decimal"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="50000"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="goal-initial">Valor inicial</Label>
              <Input
                id="goal-initial"
                inputMode="decimal"
                value={initial}
                onChange={(e) => setInitial(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="goal-date">Prazo desejado</Label>
            <Input
              id="goal-date"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="goal-desc">Descrição</Label>
            <Textarea
              id="goal-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={createMut.isPending || updateMut.isPending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
