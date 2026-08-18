import { useEffect, useState } from "react";
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
import {
  AssetType,
  ASSET_TYPE_OPTIONS,
  AssetValuationSource,
  ASSET_VALUATION_SOURCE_OPTIONS,
  assetTypeTraits,
} from "@/constants/enums";
import { CURRENCY_OPTIONS } from "@/constants";
import type { Asset } from "@/models";
import { useCreateAsset, useUpdateAsset } from "@/hooks/useAssets";
import { useAccounts } from "@/hooks/useAccounts";
import { useAllMovements, useCreateMovement } from "@/hooks/useMovements";
import {
  AssetHistoryService,
  type AssetAcquisitionEntry,
} from "@/services/AssetHistoryService";
import { AssetHistoryEditor } from "./AssetHistoryEditor";

const schema = z.object({
  name: z.string().trim().min(1, "Informe um nome").max(80),
  asset_type: z.nativeEnum(AssetType),
  institution: z.string().trim().max(80).optional().or(z.literal("")),
  ticker: z.string().trim().max(20).optional().or(z.literal("")),
  currency: z.string().min(1),
  quantity: z.union([z.string(), z.number()]).transform((v) =>
    typeof v === "string" ? Number(v.replace(",", ".")) : v,
  ),
  unit_price: z.union([z.string(), z.number()]).transform((v) =>
    typeof v === "string" ? Number(v.replace(",", ".")) : v,
  ),
  current_value: z.union([z.string(), z.number()]).transform((v) =>
    typeof v === "string" ? Number(v.replace(",", ".")) : v,
  ),
  acquisition_value: z.union([z.string(), z.number()]).transform((v) =>
    typeof v === "string" ? Number(v.replace(",", ".")) : v,
  ),
  acquisition_date: z.string().optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
  valuation_source: z.nativeEnum(AssetValuationSource),
  account_id: z.string().optional().or(z.literal("")),
  opening_value: z.union([z.string(), z.number()]).transform((v) =>
    typeof v === "string" ? Number(v.replace(",", ".")) : v,
  ),
}).refine(
  (v) => v.valuation_source !== AssetValuationSource.ACCOUNT || !!v.account_id,
  { message: "Selecione a conta espelhada", path: ["account_id"] },
);

type FormValues = z.input<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  asset?: Asset | null;
}

const defaults: FormValues = {
  name: "",
  asset_type: AssetType.CDB,
  institution: "",
  ticker: "",
  currency: "BRL",
  quantity: 0,
  unit_price: 0,
  current_value: 0,
  acquisition_value: 0,
  acquisition_date: "",
  notes: "",
  valuation_source: AssetValuationSource.MANUAL,
  account_id: "",
  opening_value: 0,
};

export function AssetFormDialog({ open, onOpenChange, workspaceId, asset }: Props) {
  const isEdit = !!asset;
  const createMut = useCreateAsset();
  const updateMut = useUpdateAsset();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults });
  const { data: accounts = [] } = useAccounts(workspaceId);
  const source = form.watch("valuation_source") as AssetValuationSource;
  const isManual = source === AssetValuationSource.MANUAL;
  const assetType = form.watch("asset_type") as AssetType;
  const traits = assetTypeTraits(assetType);
  // Sprint 4.8.1 — histórico de aquisições em lote (somente fonte MOVEMENTS).
  const [history, setHistory] = useState<AssetAcquisitionEntry[]>([]);
  const createMovement = useCreateMovement();
  const { data: allMovements = [] } = useAllMovements(workspaceId);

  useEffect(() => {
    if (!open) return;
    form.reset(
      asset
        ? {
            name: asset.name,
            asset_type: asset.asset_type,
            institution: asset.institution ?? "",
            ticker: asset.ticker ?? "",
            currency: asset.currency,
            quantity: Number(asset.quantity),
            unit_price: Number(asset.unit_price),
            current_value: Number(asset.current_value),
            acquisition_value: Number(asset.acquisition_value),
            acquisition_date: asset.acquisition_date ?? "",
            notes: asset.notes ?? "",
            valuation_source: asset.valuation_source ?? AssetValuationSource.MANUAL,
            account_id: asset.account_id ?? "",
            opening_value: Number(asset.opening_value ?? 0),
          }
        : defaults,
    );
    setHistory([]);
  }, [open, asset, form]);

  /**
   * Grava as aquisições históricas informadas em lote como movimentações
   * `is_historical` vinculadas ao ativo. Duplicadas são ignoradas.
   */
  const persistHistory = async (
    assetId: string,
    assetName: string,
    valuationSource: AssetValuationSource,
  ) => {
    if (valuationSource !== AssetValuationSource.MOVEMENTS || history.length === 0) return;
    const { inputs, duplicates, invalid } = AssetHistoryService.buildMovementInputs({
      workspaceId,
      assetId,
      assetName,
      entries: history,
      existingMovements: allMovements,
    });
    for (const input of inputs) {
      await createMovement.mutateAsync(input);
    }
    if (inputs.length > 0) toast.success(`${inputs.length} aquisição(ões) histórica(s) registrada(s)`);
    if (duplicates.length > 0) toast.info(`${duplicates.length} linha(s) já existente(s) ignorada(s)`);
    if (invalid.length > 0) toast.warning(`${invalid.length} linha(s) incompleta(s) ignorada(s)`);
  };

  const onSubmit = form.handleSubmit(async (raw) => {
    const v = schema.parse(raw);
    try {
      if (isEdit && asset) {
        await updateMut.mutateAsync({
          id: asset.id,
          input: {
            name: v.name,
            asset_type: v.asset_type,
            institution: v.institution || null,
            ticker: traits.hasTicker ? v.ticker || null : null,
            currency: v.currency,
            quantity: traits.hasQuantity ? v.quantity : 0,
            unit_price: traits.hasQuantity ? v.unit_price : 0,
            current_value: v.current_value,
            acquisition_value: v.acquisition_value,
            acquisition_date: v.acquisition_date || null,
            notes: v.notes || null,
            valuation_source: v.valuation_source,
            account_id:
              v.valuation_source === AssetValuationSource.ACCOUNT ? v.account_id || null : null,
            opening_value:
              v.valuation_source === AssetValuationSource.MOVEMENTS ? v.opening_value : 0,
          },
        });
        await persistHistory(asset.id, v.name, v.valuation_source);
        toast.success("Ativo atualizado");
      } else {
        const created = await createMut.mutateAsync({
          workspace_id: workspaceId,
          name: v.name,
          asset_type: v.asset_type,
          institution: v.institution || null,
          ticker: traits.hasTicker ? v.ticker || null : null,
          currency: v.currency,
          quantity: traits.hasQuantity ? v.quantity : 0,
          unit_price: traits.hasQuantity ? v.unit_price : 0,
          current_value: v.current_value,
          acquisition_value: v.acquisition_value,
          acquisition_date: v.acquisition_date || null,
          notes: v.notes || null,
          valuation_source: v.valuation_source,
          account_id:
            v.valuation_source === AssetValuationSource.ACCOUNT ? v.account_id || null : null,
          opening_value:
            v.valuation_source === AssetValuationSource.MOVEMENTS ? v.opening_value : 0,
        });
        await persistHistory(created.id, v.name, v.valuation_source);
        toast.success("Ativo criado");
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar ativo");
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar ativo" : "Novo ativo"}</DialogTitle>
          <DialogDescription>
            Cadastre ativos declarados: investimentos, caixinhas, previdência, etc.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Nome</Label>
              <Input {...form.register("name")} maxLength={80} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Classe</Label>
              <Select
                value={form.watch("asset_type")}
                onValueChange={(v) => form.setValue("asset_type", v as AssetType, { shouldDirty: true })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ASSET_TYPE_OPTIONS.map((o) => (
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
              <Label>Instituição</Label>
              <Input placeholder="Ex.: XP, Nubank, B3" {...form.register("institution")} maxLength={80} />
            </div>

            {traits.hasTicker && (
              <div className="space-y-1.5 md:col-span-2">
                <Label>Código / Ticker</Label>
                <Input placeholder="Ex.: PETR4, HGLG11" {...form.register("ticker")} maxLength={20} />
              </div>
            )}

            {traits.hasQuantity && (
              <>
                <div className="space-y-1.5">
                  <Label>Quantidade</Label>
                  <Input type="number" step="0.00000001" {...form.register("quantity")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Preço médio</Label>
                  <Input type="number" step="0.00000001" {...form.register("unit_price")} />
                </div>
              </>
            )}

            <div className="space-y-1.5 md:col-span-2">
              <Label>Origem do valor</Label>
              <Select
                value={source}
                onValueChange={(v) =>
                  form.setValue("valuation_source", v as AssetValuationSource, {
                    shouldDirty: true,
                  })
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ASSET_VALUATION_SOURCE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {source === AssetValuationSource.MOVEMENTS
                  ? "Aportes, resgates e rendimentos lançados neste ativo atualizam o valor automaticamente."
                  : source === AssetValuationSource.ACCOUNT
                    ? "O valor espelha o saldo da conta escolhida e não é somado novamente ao patrimônio."
                    : "Você mantém o valor atual manualmente."}
              </p>
            </div>

            {source === AssetValuationSource.ACCOUNT && (
              <div className="space-y-1.5 md:col-span-2">
                <Label>Conta espelhada</Label>
                <Select
                  value={(form.watch("account_id") as string) || ""}
                  onValueChange={(v) => form.setValue("account_id", v, { shouldDirty: true })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.account_id && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.account_id.message}
                  </p>
                )}
              </div>
            )}

            {source === AssetValuationSource.MOVEMENTS && (
              <div className="space-y-1.5 md:col-span-2">
                <Label>Valor inicial</Label>
                <Input type="number" step="0.01" {...form.register("opening_value")} />
                <p className="text-xs text-muted-foreground">
                  Saldo que o ativo já possuía antes das movimentações registradas aqui.
                </p>
              </div>
            )}

            {isManual && (
              <>
                <div className="space-y-1.5">
                  <Label>Valor atual</Label>
                  <Input type="number" step="0.01" {...form.register("current_value")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Valor de aquisição</Label>
                  <Input type="number" step="0.01" {...form.register("acquisition_value")} />
                </div>
              </>
            )}

            <div className="space-y-1.5 md:col-span-2">
              <Label>Data de aquisição</Label>
              <Input type="date" {...form.register("acquisition_date")} />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>Observações</Label>
              <Textarea rows={2} {...form.register("notes")} maxLength={500} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {isEdit ? "Salvar alterações" : "Criar ativo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
