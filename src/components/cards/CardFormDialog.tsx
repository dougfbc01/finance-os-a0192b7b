import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
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
import { useCreateCard, useUpdateCard } from "@/hooks/useCards";
import { CardBrand } from "@/constants/enums";
import type { Account, Card, UUID } from "@/models";

const schema = z.object({
  name: z.string().min(1, "Informe o nome"),
  brand: z.string().optional(),
  last_digits: z
    .string()
    .max(4)
    .regex(/^\d{0,4}$/, "Somente dígitos")
    .optional()
    .or(z.literal("")),
  holder_name: z.string().optional(),
  credit_limit: z.coerce.number().min(0, "Limite não pode ser negativo"),
  closing_day: z.coerce.number().int().min(1).max(31),
  due_day: z.coerce.number().int().min(1).max(31),
  account_id: z.string().nullable().optional(),
  color: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: UUID;
  accounts: Account[];
  card?: Card | null;
}

export function CardFormDialog({ open, onOpenChange, workspaceId, accounts, card }: Props) {
  const create = useCreateCard();
  const update = useUpdateCard();
  const isEdit = !!card;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      brand: "",
      last_digits: "",
      holder_name: "",
      credit_limit: 0,
      closing_day: 1,
      due_day: 10,
      account_id: null,
      color: "#6366F1",
      notes: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: card?.name ?? "",
        brand: card?.brand ?? "",
        last_digits: card?.last_digits ?? "",
        holder_name: card?.holder_name ?? "",
        credit_limit: Number(card?.credit_limit ?? 0),
        closing_day: card?.closing_day ?? 1,
        due_day: card?.due_day ?? 10,
        account_id: card?.account_id ?? null,
        color: card?.color ?? "#6366F1",
        notes: card?.notes ?? "",
      });
    }
  }, [open, card, form]);

  const onSubmit = async (values: FormValues) => {
    try {
      if (isEdit && card) {
        await update.mutateAsync({
          id: card.id,
          input: {
            name: values.name,
            brand: values.brand || null,
            last_digits: values.last_digits || null,
            holder_name: values.holder_name || null,
            credit_limit: values.credit_limit,
            closing_day: values.closing_day,
            due_day: values.due_day,
            account_id: values.account_id || null,
            color: values.color ?? "#6366F1",
            notes: values.notes || null,
          },
        });
        toast.success("Cartão atualizado.");
      } else {
        await create.mutateAsync({
          workspace_id: workspaceId,
          account_id: values.account_id || null,
          name: values.name,
          brand: values.brand || null,
          last_digits: values.last_digits || null,
          holder_name: values.holder_name || null,
          credit_limit: values.credit_limit,
          closing_day: values.closing_day,
          due_day: values.due_day,
          color: values.color ?? "#6366F1",
          notes: values.notes || null,
        });
        toast.success("Cartão criado.");
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar cartão");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar cartão" : "Novo cartão"}</DialogTitle>
          <DialogDescription>
            Cadastre limite, dia de fechamento e vencimento para gerar faturas automaticamente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-red-500 mt-1">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div>
              <Label>Bandeira</Label>
              <Select
                value={form.watch("brand") ?? ""}
                onValueChange={(v) => form.setValue("brand", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(CardBrand).map((b) => (
                    <SelectItem key={b} value={b}>
                      {b.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="last_digits">Últimos 4 dígitos</Label>
              <Input id="last_digits" maxLength={4} {...form.register("last_digits")} />
            </div>
            <div className="col-span-2">
              <Label htmlFor="holder_name">Titular</Label>
              <Input id="holder_name" {...form.register("holder_name")} />
            </div>
            <div>
              <Label htmlFor="credit_limit">Limite (R$)</Label>
              <Input
                id="credit_limit"
                type="number"
                step="0.01"
                {...form.register("credit_limit")}
              />
            </div>
            <div>
              <Label>Conta de pagamento</Label>
              <Select
                value={form.watch("account_id") ?? ""}
                onValueChange={(v) => form.setValue("account_id", v || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="closing_day">Dia fechamento</Label>
              <Input
                id="closing_day"
                type="number"
                min={1}
                max={31}
                {...form.register("closing_day")}
              />
            </div>
            <div>
              <Label htmlFor="due_day">Dia vencimento</Label>
              <Input id="due_day" type="number" min={1} max={31} {...form.register("due_day")} />
            </div>
            <div className="col-span-2">
              <Label htmlFor="color">Cor</Label>
              <Input id="color" type="color" {...form.register("color")} />
            </div>
            <div className="col-span-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea id="notes" rows={2} {...form.register("notes")} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {isEdit ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
