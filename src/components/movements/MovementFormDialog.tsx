import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import {
  MovementType,
  MovementStatus,
  MOVEMENT_TYPE_OPTIONS,
  MOVEMENT_STATUS_OPTIONS,
  CategoryType,
} from "@/constants/enums";
import type { Movement } from "@/models";
import { useCreateMovement, useUpdateMovement } from "@/hooks/useMovements";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories, useSubcategories } from "@/hooks/useCategories";
import { toISODate } from "@/lib/format";

const schema = z
  .object({
    type: z.nativeEnum(MovementType),
    status: z.nativeEnum(MovementStatus),
    description: z.string().trim().max(200).optional().or(z.literal("")),
    notes: z.string().trim().max(500).optional().or(z.literal("")),
    amount: z
      .union([z.string(), z.number()])
      .transform((v) => (typeof v === "string" ? Number(v.replace(",", ".")) : v))
      .refine((v) => !Number.isNaN(v) && v > 0, "Valor deve ser maior que zero"),
    transaction_date: z.string().min(1, "Informe a data"),
    competence_date: z.string().optional().or(z.literal("")),
    due_date: z.string().optional().or(z.literal("")),
    account_id: z.string().optional().or(z.literal("")),
    transfer_account_id: z.string().optional().or(z.literal("")),
    category_id: z.string().optional().or(z.literal("")),
    subcategory_id: z.string().optional().or(z.literal("")),
  })
  .refine((v) => v.type !== MovementType.TRANSFER || !!v.account_id, {
    message: "Origem obrigatória",
    path: ["account_id"],
  })
  .refine((v) => v.type !== MovementType.TRANSFER || !!v.transfer_account_id, {
    message: "Destino obrigatório",
    path: ["transfer_account_id"],
  })
  .refine(
    (v) => v.type !== MovementType.TRANSFER || v.account_id !== v.transfer_account_id,
    { message: "Origem e destino devem ser diferentes", path: ["transfer_account_id"] },
  )
  .refine((v) => v.type === MovementType.TRANSFER || !!v.account_id, {
    message: "Selecione uma conta",
    path: ["account_id"],
  });

type FormValues = z.input<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  workspaceId: string;
  movement?: Movement | null;
}

const NONE = "__none__";

export function MovementFormDialog({ open, onOpenChange, workspaceId, movement }: Props) {
  const isEdit = !!movement;
  const createMut = useCreateMovement();
  const updateMut = useUpdateMovement();

  const { data: accounts = [] } = useAccounts(workspaceId);
  const { data: categories = [] } = useCategories(workspaceId);
  const { data: subcategories = [] } = useSubcategories(workspaceId);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: MovementType.EXPENSE,
      status: MovementStatus.CLEARED,
      description: "",
      notes: "",
      amount: 0,
      transaction_date: toISODate(new Date()),
      competence_date: "",
      due_date: "",
      account_id: "",
      transfer_account_id: "",
      category_id: "",
      subcategory_id: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      movement
        ? {
            type: movement.type,
            status: movement.status,
            description: movement.description ?? "",
            notes: movement.notes ?? "",
            amount: Number(movement.amount),
            transaction_date: movement.transaction_date,
            competence_date: movement.competence_date ?? "",
            due_date: movement.due_date ?? "",
            account_id: movement.account_id ?? "",
            transfer_account_id: movement.transfer_account_id ?? "",
            category_id: movement.category_id ?? "",
            subcategory_id: movement.subcategory_id ?? "",
          }
        : {
            type: MovementType.EXPENSE,
            status: MovementStatus.CLEARED,
            description: "",
            notes: "",
            amount: 0,
            transaction_date: toISODate(new Date()),
            competence_date: "",
            due_date: "",
            account_id: accounts[0]?.id ?? "",
            transfer_account_id: "",
            category_id: "",
            subcategory_id: "",
          },
    );
  }, [open, movement, accounts, form]);

  const type = form.watch("type");
  const categoryId = form.watch("category_id");

  const filteredCategories = useMemo(() => {
    if (type === MovementType.TRANSFER) return [];
    // Mapear tipo de movimentação para tipos de categoria compatíveis.
    if (
      type === MovementType.INCOME ||
      type === MovementType.DIVIDEND ||
      type === MovementType.INTEREST ||
      type === MovementType.REFUND
    ) {
      return categories.filter((c) => c.type === CategoryType.INCOME && c.is_active);
    }
    if (type === MovementType.INVESTMENT) {
      return categories.filter((c) => c.type === CategoryType.INVESTMENT && c.is_active);
    }
    return categories.filter((c) => c.type === CategoryType.EXPENSE && c.is_active);
  }, [categories, type]);

  const filteredSubcategories = useMemo(
    () => subcategories.filter((s) => s.category_id === categoryId && s.is_active),
    [subcategories, categoryId],
  );

  const onSubmit = form.handleSubmit(async (raw) => {
    const values = schema.parse(raw);
    const payload = {
      workspace_id: workspaceId,
      type: values.type,
      status: values.status,
      description: values.description || "",
      notes: values.notes || null,
      amount: values.amount,
      transaction_date: values.transaction_date,
      competence_date: values.competence_date || null,
      due_date: values.due_date || null,
      account_id: values.account_id || null,
      transfer_account_id:
        values.type === MovementType.TRANSFER ? values.transfer_account_id || null : null,
      category_id:
        values.type === MovementType.TRANSFER ? null : values.category_id || null,
      subcategory_id:
        values.type === MovementType.TRANSFER ? null : values.subcategory_id || null,
    };
    try {
      if (isEdit && movement) {
        await updateMut.mutateAsync({ id: movement.id, input: payload });
        toast.success("Movimentação atualizada");
      } else {
        await createMut.mutateAsync(payload);
        toast.success("Movimentação registrada");
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar movimentação" : "Nova movimentação"}</DialogTitle>
          <DialogDescription>
            Registre uma movimentação financeira do seu workspace.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                value={form.watch("type")}
                onValueChange={(v) => form.setValue("type", v as MovementType, { shouldDirty: true })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MOVEMENT_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.watch("status")}
                onValueChange={(v) => form.setValue("status", v as MovementStatus, { shouldDirty: true })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MOVEMENT_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="mov-desc">Descrição</Label>
              <Input id="mov-desc" {...form.register("description")} maxLength={200} />
            </div>

            <div className="space-y-1.5">
              <Label>Valor</Label>
              <Input type="number" step="0.01" {...form.register("amount")} />
              {form.formState.errors.amount && (
                <p className="text-xs text-destructive">{form.formState.errors.amount.message as string}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" {...form.register("transaction_date")} />
            </div>

            <div className="space-y-1.5">
              <Label>Competência</Label>
              <Input type="date" {...form.register("competence_date")} />
            </div>

            <div className="space-y-1.5">
              <Label>Vencimento</Label>
              <Input type="date" {...form.register("due_date")} />
            </div>

            <div className="space-y-1.5">
              <Label>{type === MovementType.TRANSFER ? "Conta origem" : "Conta"}</Label>
              <Select
                value={form.watch("account_id") || undefined}
                onValueChange={(v) => form.setValue("account_id", v, { shouldDirty: true })}
              >
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.account_id && (
                <p className="text-xs text-destructive">{form.formState.errors.account_id.message as string}</p>
              )}
            </div>

            {type === MovementType.TRANSFER ? (
              <div className="space-y-1.5">
                <Label>Conta destino</Label>
                <Select
                  value={form.watch("transfer_account_id") || undefined}
                  onValueChange={(v) => form.setValue("transfer_account_id", v, { shouldDirty: true })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.transfer_account_id && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.transfer_account_id.message as string}
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>Categoria</Label>
                  <Select
                    value={form.watch("category_id") || NONE}
                    onValueChange={(v) => {
                      form.setValue("category_id", v === NONE ? "" : v, { shouldDirty: true });
                      form.setValue("subcategory_id", "", { shouldDirty: true });
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Sem categoria</SelectItem>
                      {filteredCategories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Subcategoria</Label>
                  <Select
                    value={form.watch("subcategory_id") || NONE}
                    onValueChange={(v) => form.setValue("subcategory_id", v === NONE ? "" : v, { shouldDirty: true })}
                    disabled={!categoryId}
                  >
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>—</SelectItem>
                      {filteredSubcategories.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="space-y-1.5 md:col-span-2">
              <Label>Observações</Label>
              <Textarea rows={3} {...form.register("notes")} maxLength={500} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
              {isEdit ? "Salvar" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
