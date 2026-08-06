import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BUDGET_MODE_LABELS,
  BUDGET_SUGGESTION_LABELS,
  MONTH_LABELS_FALLBACK,
  type BudgetMode,
  type BudgetSuggestionSource,
} from "./labels";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  month: number;
  mode: BudgetMode;
  source: BudgetSuggestionSource;
  suggestedCount: number;
  suggestedTotal: number;
  isPending: boolean;
  onModeChange: (mode: BudgetMode) => void;
  onSourceChange: (source: BudgetSuggestionSource) => void;
  onConfirm: (name: string) => void;
}

/** Diálogo de criação de orçamento. Nenhum cálculo aqui. */
export function BudgetFormDialog({
  open,
  onOpenChange,
  year,
  month,
  mode,
  source,
  suggestedCount,
  suggestedTotal,
  isPending,
  onModeChange,
  onSourceChange,
  onConfirm,
}: Props) {
  const [name, setName] = useState("Planejamento");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Novo planejamento — {MONTH_LABELS_FALLBACK[month - 1]} {year}
          </DialogTitle>
          <DialogDescription>
            O orçamento guarda apenas o valor planejado; o realizado é sempre calculado a
            partir das suas movimentações.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="budget-name">Nome</Label>
            <Input
              id="budget-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Planejamento"
            />
          </div>

          <div className="space-y-2">
            <Label>Modo de planejamento</Label>
            <Select value={mode} onValueChange={(v) => onModeChange(v as BudgetMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(BUDGET_MODE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Base do orçamento</Label>
            <Select
              value={source}
              onValueChange={(v) => onSourceChange(v as BudgetSuggestionSource)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(BUDGET_SUGGESTION_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {suggestedCount} item(ns) sugerido(s) ·{" "}
              {suggestedTotal.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={isPending} onClick={() => onConfirm(name)}>
            Criar planejamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
