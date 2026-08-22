// Cadastro/edição de compromisso. Nenhum cálculo vive aqui: o cronograma e o
// valor de cada parcela são sempre projetados pelo CommitmentService.
import { useEffect, useMemo, useState } from "react";
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
import { useAccounts } from "@/hooks/useAccounts";
import { useCards } from "@/hooks/useCards";
import { useCategories, useSubcategories } from "@/hooks/useCategories";
import { useCreateCommitment, useUpdateCommitment } from "@/hooks/useCommitments";
import { CommitmentServiceImpl } from "@/services/CommitmentService";
import { formatCurrency, formatDate, toISODate } from "@/lib/format";
import {
  COMMITMENT_TYPE_LABELS,
  type Commitment,
  type CommitmentType,
} from "@/models/Commitment";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  commitment?: Commitment | null;
}

const NONE = "__none__";
const TYPES = Object.keys(COMMITMENT_TYPE_LABELS) as CommitmentType[];

export function CommitmentFormDialog({ open, onOpenChange, workspaceId, commitment }: Props) {
  const createMut = useCreateCommitment();
  const updateMut = useUpdateCommitment();
  const { data: accounts = [] } = useAccounts(workspaceId);
  const { data: cards = [] } = useCards(workspaceId);
  const { data: categories = [] } = useCategories(workspaceId);
  const { data: subcategories = [] } = useSubcategories(workspaceId);

  const [name, setName] = useState("");
  const [type, setType] = useState<CommitmentType>("INSTALLMENT");
  const [total, setTotal] = useState("");
  const [count, setCount] = useState("1");
  const [startDate, setStartDate] = useState(toISODate(new Date()));
  const [dueDay, setDueDay] = useState("");
  const [categoryId, setCategoryId] = useState(NONE);
  const [subcategoryId, setSubcategoryId] = useState(NONE);
  const [accountId, setAccountId] = useState(NONE);
  const [cardId, setCardId] = useState(NONE);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(commitment?.name ?? "");
    setType(commitment?.commitment_type ?? "INSTALLMENT");
    setTotal(commitment ? String(commitment.total_amount) : "");
    setCount(String(commitment?.installments_count ?? 1));
    setStartDate(commitment?.start_date ?? toISODate(new Date()));
    setDueDay(commitment?.due_day ? String(commitment.due_day) : "");
    setCategoryId(commitment?.category_id ?? NONE);
    setSubcategoryId(commitment?.subcategory_id ?? NONE);
    setAccountId(commitment?.account_id ?? NONE);
    setCardId(commitment?.card_id ?? NONE);
    setNotes(commitment?.notes ?? "");
  }, [open, commitment]);

  const subsOfCategory = useMemo(
    () => subcategories.filter((s) => s.category_id === categoryId),
    [subcategories, categoryId],
  );

  // Prévia do cronograma — mesma função usada na gravação.
  const preview = useMemo(() => {
    const amount = Number(total.replace(",", "."));
    const n = Number(count);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(n) || n < 1) return null;
    try {
      return CommitmentServiceImpl.schedule({
        total_amount: amount,
        installments_count: Math.floor(n),
        start_date: startDate,
        due_day: dueDay ? Number(dueDay) : null,
      });
    } catch {
      return null;
    }
  }, [total, count, startDate, dueDay]);

  const isEdit = !!commitment;
  const saving = createMut.isPending || updateMut.isPending;

  const handleSave = async () => {
    const payload = {
      name,
      description: null,
      commitment_type: type,
      total_amount: Number(total.replace(",", ".")),
      installments_count: Math.floor(Number(count)),
      start_date: startDate,
      due_day: dueDay ? Number(dueDay) : null,
      category_id: categoryId === NONE ? null : categoryId,
      subcategory_id: subcategoryId === NONE ? null : subcategoryId,
      account_id: accountId === NONE ? null : accountId,
      card_id: cardId === NONE ? null : cardId,
      notes: notes.trim() || null,
    };

    try {
      CommitmentServiceImpl.validate(payload);
      if (isEdit) {
        await updateMut.mutateAsync({ id: commitment!.id, input: payload });
        toast.success("Compromisso atualizado. Parcelas pagas foram preservadas.");
      } else {
        await createMut.mutateAsync({ workspace_id: workspaceId, ...payload });
        toast.success("Compromisso criado. Nenhuma movimentação foi lançada.");
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar o compromisso.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar compromisso" : "Novo compromisso"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="c-name">Descrição</Label>
            <Input
              id="c-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Financiamento do carro"
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as CommitmentType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {COMMITMENT_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="c-total">Valor total</Label>
            <Input
              id="c-total"
              inputMode="decimal"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              placeholder="66898.08"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="c-count">Quantidade de parcelas</Label>
            <Input
              id="c-count"
              type="number"
              min={1}
              value={count}
              onChange={(e) => setCount(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="c-start">Data da primeira parcela</Label>
            <Input
              id="c-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="c-dueday">Dia de vencimento (opcional)</Label>
            <Input
              id="c-dueday"
              type="number"
              min={1}
              max={31}
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
              placeholder="10"
            />
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select
              value={categoryId}
              onValueChange={(v) => {
                setCategoryId(v);
                setSubcategoryId(NONE);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sem categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem categoria</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Subcategoria</Label>
            <Select
              value={subcategoryId}
              onValueChange={setSubcategoryId}
              disabled={categoryId === NONE}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sem subcategoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem subcategoria</SelectItem>
                {subsOfCategory.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Conta relacionada</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Nenhuma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Nenhuma</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Cartão relacionado</Label>
            <Select value={cardId} onValueChange={setCardId}>
              <SelectTrigger>
                <SelectValue placeholder="Nenhum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Nenhum</SelectItem>
                {cards.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="c-notes">Observação</Label>
            <Textarea
              id="c-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {preview && (
            <div className="sm:col-span-2 rounded-md border bg-muted/30 p-3 text-sm">
              <p className="font-medium">
                {preview.length}x de {formatCurrency(preview[0]!.amount)}
                {preview.length > 1 &&
                  preview[preview.length - 1]!.amount !== preview[0]!.amount && (
                    <span className="text-muted-foreground">
                      {" "}
                      (última: {formatCurrency(preview[preview.length - 1]!.amount)})
                    </span>
                  )}
              </p>
              <p className="text-muted-foreground">
                1ª em {formatDate(preview[0]!.due_date)} · última em{" "}
                {formatDate(preview[preview.length - 1]!.due_date)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                As parcelas são previsões: nenhuma movimentação financeira é criada.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
