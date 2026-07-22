import { useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AccountType,
  ACCOUNT_TYPE_OPTIONS,
  ACCOUNT_COLORS,
  ACCOUNT_ICONS,
  CURRENCY_OPTIONS,
} from "@/constants";
import { getAccountIcon } from "@/lib/account-icons";
import type { Account } from "@/models";
import { useCreateAccount, useUpdateAccount } from "@/hooks/useAccounts";
import { cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().trim().min(1, "Informe um nome").max(80),
  institution: z.string().trim().max(80).optional().or(z.literal("")),
  account_type: z.nativeEnum(AccountType),
  currency: z.string().min(1),
  initial_balance: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === "string" ? Number(v.replace(",", ".")) : v))
    .refine((v) => !Number.isNaN(v), "Valor inválido"),
  color: z.string().min(1),
  icon: z.string().min(1),
});

type FormValues = z.input<typeof schema>;

interface AccountFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  account?: Account | null;
}

export function AccountFormDialog({
  open,
  onOpenChange,
  workspaceId,
  account,
}: AccountFormDialogProps) {
  const isEdit = !!account;
  const createMut = useCreateAccount();
  const updateMut = useUpdateAccount();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      institution: "",
      account_type: AccountType.CHECKING,
      currency: "BRL",
      initial_balance: 0,
      color: ACCOUNT_COLORS[0].value,
      icon: "wallet",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        account
          ? {
              name: account.name,
              institution: account.institution ?? "",
              account_type: account.account_type,
              currency: account.currency,
              initial_balance: Number(account.initial_balance),
              color: account.color,
              icon: account.icon,
            }
          : {
              name: "",
              institution: "",
              account_type: AccountType.CHECKING,
              currency: "BRL",
              initial_balance: 0,
              color: ACCOUNT_COLORS[0].value,
              icon: "wallet",
            },
      );
    }
  }, [open, account, form]);

  const onSubmit = form.handleSubmit(async (raw) => {
    const values = schema.parse(raw);
    try {
      if (isEdit && account) {
        await updateMut.mutateAsync({
          id: account.id,
          input: {
            name: values.name,
            institution: values.institution || null,
            account_type: values.account_type,
            currency: values.currency,
            initial_balance: values.initial_balance,
            color: values.color,
            icon: values.icon,
          },
        });
        toast.success("Conta atualizada");
      } else {
        await createMut.mutateAsync({
          workspace_id: workspaceId,
          name: values.name,
          institution: values.institution || null,
          account_type: values.account_type,
          currency: values.currency,
          initial_balance: values.initial_balance,
          color: values.color,
          icon: values.icon,
        });
        toast.success("Conta criada");
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar conta");
    }
  });

  const color = form.watch("color");
  const icon = form.watch("icon");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar conta" : "Nova conta"}</DialogTitle>
          <DialogDescription>
            Cadastre uma conta financeira do seu workspace.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="acc-name">Nome</Label>
              <Input id="acc-name" {...form.register("name")} maxLength={80} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="acc-institution">Instituição</Label>
              <Input
                id="acc-institution"
                placeholder="Ex.: Nubank, Itaú, XP"
                {...form.register("institution")}
                maxLength={80}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                value={form.watch("account_type")}
                onValueChange={(v) =>
                  form.setValue("account_type", v as AccountType, { shouldDirty: true })
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Moeda</Label>
              <Select
                value={form.watch("currency")}
                onValueChange={(v) => form.setValue("currency", v, { shouldDirty: true })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="acc-balance">Saldo inicial</Label>
              <Input
                id="acc-balance"
                type="number"
                step="0.01"
                {...form.register("initial_balance")}
              />
              {form.formState.errors.initial_balance && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.initial_balance.message as string}
                </p>
              )}
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {ACCOUNT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => form.setValue("color", c.value, { shouldDirty: true })}
                    className={cn(
                      "h-7 w-7 rounded-full border-2 transition",
                      color === c.value ? "border-foreground scale-110" : "border-transparent",
                    )}
                    style={{ backgroundColor: c.value }}
                    aria-label={c.name}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>Ícone</Label>
              <div className="flex flex-wrap gap-2">
                {ACCOUNT_ICONS.map((name) => {
                  const Icon = getAccountIcon(name);
                  const active = icon === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => form.setValue("icon", name, { shouldDirty: true })}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-md border transition",
                        active
                          ? "border-foreground bg-accent"
                          : "border-border hover:bg-accent/50",
                      )}
                      aria-label={name}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {isEdit ? "Salvar alterações" : "Criar conta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
