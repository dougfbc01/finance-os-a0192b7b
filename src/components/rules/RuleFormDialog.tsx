import { useEffect, useMemo } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCategories, useSubcategories } from "@/hooks/useCategories";
import {
  useCreateClassificationRule,
  useUpdateClassificationRule,
} from "@/hooks/useClassificationRules";
import { MOVEMENT_TYPE_OPTIONS, type MovementType } from "@/constants/enums";
import type { ClassificationRule, RuleDirection } from "@/models";

const schema = z.object({
  text_pattern: z.string().trim().min(2, "Padrão muito curto").max(200),
  counterparty_pattern: z.string().trim().max(200).optional().or(z.literal("")),
  movement_type: z.string().optional().or(z.literal("")),
  direction: z.string().optional().or(z.literal("")),
  category_id: z.string().optional().or(z.literal("")),
  subcategory_id: z.string().optional().or(z.literal("")),
  priority: z.coerce.number().int().min(0).max(1000),
  enabled: z.boolean(),
});
type Values = z.input<typeof schema>;

const NONE = "__none__";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  workspaceId: string;
  rule?: ClassificationRule | null;
}

export function RuleFormDialog({ open, onOpenChange, workspaceId, rule }: Props) {
  const isEdit = !!rule;
  const createMut = useCreateClassificationRule();
  const updateMut = useUpdateClassificationRule();
  const { data: categories = [] } = useCategories(workspaceId);
  const { data: subcategories = [] } = useSubcategories(workspaceId);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      text_pattern: "",
      counterparty_pattern: "",
      movement_type: "",
      direction: "",
      category_id: "",
      subcategory_id: "",
      priority: 100,
      enabled: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      rule
        ? {
            text_pattern: rule.text_pattern,
            counterparty_pattern: rule.counterparty_pattern ?? "",
            movement_type: rule.movement_type ?? "",
            direction: rule.direction ?? "",
            category_id: rule.category_id ?? "",
            subcategory_id: rule.subcategory_id ?? "",
            priority: rule.priority,
            enabled: rule.enabled,
          }
        : {
            text_pattern: "",
            counterparty_pattern: "",
            movement_type: "",
            direction: "",
            category_id: "",
            subcategory_id: "",
            priority: 100,
            enabled: true,
          },
    );
  }, [open, rule, form]);

  const categoryId = form.watch("category_id");
  const filteredSubs = useMemo(
    () => subcategories.filter((s) => s.category_id === categoryId && s.is_active),
    [subcategories, categoryId],
  );

  const onSubmit = form.handleSubmit(async (raw) => {
    const values = schema.parse(raw);
    try {
      if (isEdit && rule) {
        await updateMut.mutateAsync({
          id: rule.id,
          input: {
            text_pattern: values.text_pattern,
            counterparty_pattern: values.counterparty_pattern || null,
            movement_type: (values.movement_type || null) as MovementType | null,
            direction: (values.direction || null) as RuleDirection | null,
            category_id: values.category_id || null,
            subcategory_id: values.subcategory_id || null,
            priority: values.priority,
            enabled: values.enabled,
          },
        });
        toast.success("Regra atualizada");
      } else {
        await createMut.mutateAsync({
          workspace_id: workspaceId,
          text_pattern: values.text_pattern,
          counterparty_pattern: values.counterparty_pattern || null,
          movement_type: (values.movement_type || null) as MovementType | null,
          direction: (values.direction || null) as RuleDirection | null,
          category_id: values.category_id || null,
          subcategory_id: values.subcategory_id || null,
          priority: values.priority,
          enabled: values.enabled,
        });
        toast.success("Regra criada");
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Regra" : "Nova Regra"}</DialogTitle>
          <DialogDescription>
            Aplicada em novas importações e sugerida na reclassificação manual.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Padrão (texto contido na descrição)</Label>
            <Input {...form.register("text_pattern")} placeholder="ex.: uber, ifood, netflix" />
            {form.formState.errors.text_pattern && (
              <p className="text-xs text-destructive">
                {form.formState.errors.text_pattern.message as string}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Contraparte (opcional)</Label>
            <Input
              {...form.register("counterparty_pattern")}
              placeholder="ex.: Stephanie, Comunidade da Graça"
            />
            <p className="text-xs text-muted-foreground">
              Torna a regra específica: vence regras genéricas com o mesmo texto.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo (opcional)</Label>
              <Select
                value={form.watch("movement_type") || NONE}
                onValueChange={(v) => form.setValue("movement_type", v === NONE ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {MOVEMENT_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Direção (opcional)</Label>
              <Select
                value={form.watch("direction") || NONE}
                onValueChange={(v) => form.setValue("direction", v === NONE ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  <SelectItem value="IN">Entrada (recebido)</SelectItem>
                  <SelectItem value="OUT">Saída (enviado)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select
                value={form.watch("category_id") || NONE}
                onValueChange={(v) => {
                  form.setValue("category_id", v === NONE ? "" : v);
                  form.setValue("subcategory_id", "");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Subcategoria</Label>
              <Select
                value={form.watch("subcategory_id") || NONE}
                onValueChange={(v) => form.setValue("subcategory_id", v === NONE ? "" : v)}
                disabled={!categoryId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {filteredSubs.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Input type="number" {...form.register("priority")} />
            </div>
            <div className="space-y-1.5 flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.watch("enabled")}
                  onChange={(e) => form.setValue("enabled", e.target.checked)}
                />
                Ativa
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
              {isEdit ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
