import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { History, Sparkles, Wallet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import type { Movement, UUID } from "@/models";
import { useCreateMovement, useUpdateMovement } from "@/hooks/useMovements";
import { useAccounts } from "@/hooks/useAccounts";
import { useCards } from "@/hooks/useCards";
import { useCategories, useSubcategories } from "@/hooks/useCategories";
import { useAssets } from "@/hooks/useAssets";
import {
  useRememberClassification,
  useBulkClassify,
} from "@/hooks/useClassificationRules";
import { toISODate } from "@/lib/format";
import { CardServiceImpl } from "@/services/CardService";
import { AssetFormDialog } from "@/components/assets/AssetFormDialog";

const INVESTMENT_OPERATIONS = [
  { value: "APORTE", label: "Aporte" },
  { value: "RESGATE", label: "Resgate" },
  { value: "RENDIMENTO", label: "Rendimento" },
  { value: "AJUSTE", label: "Ajuste" },
] as const;

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
    card_id: z.string().optional().or(z.literal("")),
    category_id: z.string().optional().or(z.literal("")),
    subcategory_id: z.string().optional().or(z.literal("")),
    asset_id: z.string().optional().or(z.literal("")),
    investment_operation: z.string().optional().or(z.literal("")),
    is_historical: z.boolean().optional(),
    quantity: z
      .union([z.string(), z.number()])
      .optional()
      .transform((v) =>
        v === undefined || v === "" ? null : typeof v === "string" ? Number(v.replace(",", ".")) : v,
      ),
    unit_price: z
      .union([z.string(), z.number()])
      .optional()
      .transform((v) =>
        v === undefined || v === "" ? null : typeof v === "string" ? Number(v.replace(",", ".")) : v,
      ),
  })
  .refine((v) => !v.is_historical || !!v.asset_id, {
    message: "Selecione o ativo da operação histórica",
    path: ["asset_id"],
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
  .refine(
    (v) => v.is_historical || v.type === MovementType.TRANSFER || !!v.account_id || !!v.card_id,
    { message: "Selecione uma conta ou um cartão", path: ["account_id"] },
  );

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
  const rememberMut = useRememberClassification();
  const bulkClassifyMut = useBulkClassify();

  const { data: accounts = [] } = useAccounts(workspaceId);
  const { data: cards = [] } = useCards(workspaceId);
  const { data: categories = [] } = useCategories(workspaceId);
  const { data: subcategories = [] } = useSubcategories(workspaceId);
  const { data: assets = [] } = useAssets(workspaceId);

  const [assetDialogOpen, setAssetDialogOpen] = useState(false);

  // Rastreia edição manual de competência/vencimento — uma vez editados
  // manualmente, nunca mais são recalculados automaticamente.
  const manualCompetence = useRef(false);
  const manualDue = useRef(false);

  const [rememberPrompt, setRememberPrompt] = useState<{
    description: string;
    categoryId: string;
    subcategoryId: string | null;
  } | null>(null);

  const [scanPrompt, setScanPrompt] = useState<{
    ids: UUID[];
    categoryId: string;
    subcategoryId: string | null;
  } | null>(null);

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
      card_id: "",
      category_id: "",
      subcategory_id: "",
      asset_id: "",
      investment_operation: "APORTE",
      is_historical: false,
      quantity: "",
      unit_price: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    // Extrai operação de investimento das tags no formato "op:APORTE".
    const opTag = movement?.tags?.find((t) => t.startsWith("op:"));
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
            card_id: movement.card_id ?? "",
            category_id: movement.category_id ?? "",
            subcategory_id: movement.subcategory_id ?? "",
            asset_id: movement.asset_id ?? "",
            investment_operation: opTag ? opTag.slice(3) : "APORTE",
            is_historical: !!movement.is_historical,
            quantity: movement.quantity ?? "",
            unit_price: movement.unit_price ?? "",
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
            card_id: "",
            category_id: "",
            subcategory_id: "",
            asset_id: "",
            investment_operation: "APORTE",
            is_historical: false,
            quantity: "",
            unit_price: "",
          },
    );
    // Ao reabrir, o rastreio de edição manual recomeça:
    // datas já gravadas na movimentação contam como definidas pelo usuário.
    manualCompetence.current = !!movement?.competence_date;
    manualDue.current = !!movement?.due_date;
  }, [open, movement, accounts, form]);

  const type = form.watch("type");
  const categoryId = form.watch("category_id");
  const cardId = form.watch("card_id");
  const transactionDate = form.watch("transaction_date");

  /**
   * Sprint 4.0.1 — Competência e Vencimento automáticos.
   * Conta: competência = vencimento = data.
   * Cartão: competência = data da compra; vencimento = due_date da fatura
   * (CardService.computeInvoicePeriod). Edições manuais nunca são sobrescritas.
   */
  useEffect(() => {
    if (!open || !transactionDate) return;
    const usingCard = !!cardId && type !== MovementType.TRANSFER;
    const card = usingCard ? cards.find((c) => c.id === cardId) : undefined;

    if (!manualCompetence.current) {
      form.setValue("competence_date", transactionDate, { shouldDirty: true });
    }
    if (!manualDue.current) {
      const due = card
        ? CardServiceImpl.computeInvoicePeriod(card, transactionDate).due_date
        : transactionDate;
      form.setValue("due_date", due, { shouldDirty: true });
    }
  }, [open, transactionDate, cardId, type, cards, form]);

  const canUseCard =
    type === MovementType.EXPENSE ||
    type === MovementType.REFUND ||
    type === MovementType.FEE;

  const filteredCategories = useMemo(() => {
    if (type === MovementType.TRANSFER) return [];
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

  const isInvestmentCategory = useMemo(() => {
    if (!categoryId) return false;
    const cat = categories.find((c) => c.id === categoryId);
    return cat?.type === CategoryType.INVESTMENT;
  }, [categoryId, categories]);

  const showInvestmentStep =
    isInvestmentCategory ||
    type === MovementType.INVESTMENT ||
    type === MovementType.DIVIDEND ||
    type === MovementType.INTEREST;

  const activeAssets = useMemo(() => assets.filter((a) => a.is_active), [assets]);

  /** Sprint 4.7 — operação anterior ao início do controle: não movimenta caixa. */
  const historical = !!form.watch("is_historical") && showInvestmentStep;

  const onSubmit = form.handleSubmit(async (raw) => {
    const values = schema.parse(raw);
    const isHistorical = showInvestmentStep && !!values.is_historical;
    const isTransfer = !isHistorical && values.type === MovementType.TRANSFER;
    const usingCard = !isHistorical && !isTransfer && !!values.card_id && canUseCard;

    if (showInvestmentStep && !values.asset_id) {
      toast.error("Selecione o destino do investimento (ativo).");
      return;
    }

    // Preserva outras tags e insere/atualiza a operação
    const baseTags = (movement?.tags ?? []).filter((t) => !t.startsWith("op:"));
    const tags = showInvestmentStep && values.investment_operation
      ? [...baseTags, `op:${values.investment_operation}`]
      : baseTags;

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
      account_id: isHistorical
        ? null
        : isTransfer
          ? values.account_id || null
          : usingCard
            ? null
            : values.account_id || null,
      transfer_account_id: isTransfer ? values.transfer_account_id || null : null,
      card_id: usingCard ? values.card_id : null,
      category_id: isTransfer ? null : values.category_id || null,
      subcategory_id: isTransfer ? null : values.subcategory_id || null,
      asset_id: showInvestmentStep ? values.asset_id || null : null,
      is_historical: isHistorical,
      quantity: values.quantity ?? null,
      unit_price: values.unit_price ?? null,
      tags,
    };

    try {
      if (isEdit && movement) {
        await updateMut.mutateAsync({ id: movement.id, input: payload });
        toast.success("Movimentação atualizada");
      } else {
        await createMut.mutateAsync(payload);
        toast.success("Movimentação registrada");
      }

      const changedCategory =
        !isTransfer &&
        values.category_id &&
        (payload.description || "").trim().length > 0 &&
        (!isEdit ||
          movement?.category_id !== values.category_id ||
          movement?.subcategory_id !== (values.subcategory_id || null));

      if (changedCategory) {
        setRememberPrompt({
          description: (payload.description || "").trim(),
          categoryId: values.category_id!,
          subcategoryId: values.subcategory_id || null,
        });
      } else {
        onOpenChange(false);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    }
  });

  const handleRememberConfirm = async () => {
    if (!rememberPrompt) return;
    try {
      const result = await rememberMut.mutateAsync({
        workspaceId,
        description: rememberPrompt.description,
        categoryId: rememberPrompt.categoryId,
        subcategoryId: rememberPrompt.subcategoryId,
      });
      toast.success("Regra memorizada");
      // Sprint 3.1 - Parte 4: scan automático de compatíveis.
      if (result.matchIds.length > 0) {
        setScanPrompt({
          ids: result.matchIds,
          categoryId: rememberPrompt.categoryId,
          subcategoryId: rememberPrompt.subcategoryId,
        });
        setRememberPrompt(null);
        return;
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar regra");
    }
    setRememberPrompt(null);
    onOpenChange(false);
  };

  const handleScanConfirm = async () => {
    if (!scanPrompt) return;
    try {
      const n = await bulkClassifyMut.mutateAsync({
        ids: scanPrompt.ids,
        categoryId: scanPrompt.categoryId,
        subcategoryId: scanPrompt.subcategoryId,
      });
      toast.success(`${n} movimentações classificadas`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao classificar em massa");
    } finally {
      setScanPrompt(null);
      onOpenChange(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                  onValueChange={(v) => {
                    form.setValue("type", v as MovementType, { shouldDirty: true });
                    if (v === MovementType.TRANSFER) form.setValue("card_id", "");
                  }}
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
                <Input
                  type="date"
                  {...form.register("competence_date")}
                  onChange={(e) => {
                    manualCompetence.current = true;
                    form.setValue("competence_date", e.target.value, { shouldDirty: true });
                  }}
                />
                <p className="text-[10px] text-muted-foreground">Preenchida automaticamente pela data da movimentação.</p>
              </div>

              <div className="space-y-1.5">
                <Label>Vencimento</Label>
                <Input
                  type="date"
                  {...form.register("due_date")}
                  onChange={(e) => {
                    manualDue.current = true;
                    form.setValue("due_date", e.target.value, { shouldDirty: true });
                  }}
                />
                <p className="text-[10px] text-muted-foreground">Preenchido automaticamente (conta = data; cartão = vencimento da fatura).</p>
              </div>

              {canUseCard && (
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Cartão (opcional)</Label>
                  <Select
                    value={form.watch("card_id") || NONE}
                    onValueChange={(v) => {
                      const val = v === NONE ? "" : v;
                      form.setValue("card_id", val, { shouldDirty: true });
                      if (val) form.setValue("account_id", "");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Nenhum (débito em conta)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Nenhum (débito em conta)</SelectItem>
                      {cards
                        .filter((c) => c.is_active)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Compras em cartão vinculam-se à fatura da competência e não reduzem o saldo bancário.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>{type === MovementType.TRANSFER ? "Conta origem" : "Conta"}</Label>
                <Select
                  value={form.watch("account_id") || undefined}
                  onValueChange={(v) => form.setValue("account_id", v, { shouldDirty: true })}
                  disabled={historical || (canUseCard && !!cardId)}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        historical
                          ? "— (operação histórica, sem conta)"
                          : canUseCard && cardId
                            ? "— (compra no cartão)"
                            : "Selecione…"
                      }
                    />
                  </SelectTrigger>
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

              {showInvestmentStep && (
                <div className="md:col-span-2 rounded-md border border-dashed p-3 space-y-3 bg-muted/30">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Wallet className="h-4 w-4 text-primary" />
                    Destino do investimento
                  </div>

                  <div className="flex items-start justify-between gap-3 rounded-md border bg-background p-3">
                    <div className="space-y-0.5">
                      <Label className="flex items-center gap-2">
                        <History className="h-4 w-4 text-muted-foreground" />
                        Operação histórica
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        {historical
                          ? "Anterior ao início do controle: atualiza a posição do ativo e NÃO altera o saldo de nenhuma conta."
                          : "Operação financeira atual: sai da conta selecionada e entra no ativo."}
                      </p>
                    </div>
                    <Switch
                      checked={historical}
                      onCheckedChange={(v) => {
                        form.setValue("is_historical", v, { shouldDirty: true });
                        if (v) {
                          form.setValue("account_id", "", { shouldDirty: true });
                          form.setValue("card_id", "", { shouldDirty: true });
                        }
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Quantidade (opcional)</Label>
                      <Input type="number" step="0.00000001" {...form.register("quantity")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Preço unitário (opcional)</Label>
                      <Input type="number" step="0.000001" {...form.register("unit_price")} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Ativo</Label>
                      <div className="flex gap-2">
                        <Select
                          value={form.watch("asset_id") || undefined}
                          onValueChange={(v) => form.setValue("asset_id", v, { shouldDirty: true })}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Selecione um ativo…" />
                          </SelectTrigger>
                          <SelectContent>
                            {activeAssets.length === 0 && (
                              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                Nenhum ativo cadastrado
                              </div>
                            )}
                            {activeAssets.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setAssetDialogOpen(true)}
                        >
                          Novo ativo
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Operação</Label>
                      <Select
                        value={form.watch("investment_operation") || "APORTE"}
                        onValueChange={(v) => form.setValue("investment_operation", v, { shouldDirty: true })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {INVESTMENT_OPERATIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    O ativo escolhido receberá o valor via PatrimonyService — nenhuma movimentação adicional é criada.
                  </p>
                </div>
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

      <AssetFormDialog
        open={assetDialogOpen}
        onOpenChange={setAssetDialogOpen}
        workspaceId={workspaceId}
      />

      <AlertDialog open={!!rememberPrompt} onOpenChange={(o) => !o && (setRememberPrompt(null), onOpenChange(false))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Memorizar classificação?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Deseja memorizar categoria e subcategoria para futuras importações com a descrição
              {rememberPrompt ? ` "${rememberPrompt.description}"` : ""}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setRememberPrompt(null); onOpenChange(false); }}>
              Não, obrigado
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleRememberConfirm}>Memorizar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!scanPrompt} onOpenChange={(o) => !o && (setScanPrompt(null), onOpenChange(false))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Classificar compatíveis?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {scanPrompt
                ? `Foram encontradas ${scanPrompt.ids.length} movimentações compatíveis. Deseja classificá-las automaticamente?`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setScanPrompt(null); onOpenChange(false); }}>
              Agora não
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleScanConfirm}>Classificar todas</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
