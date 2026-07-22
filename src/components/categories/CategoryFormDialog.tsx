import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CategoryType } from "@/constants/enums";
import {
  CATEGORY_TYPE_OPTIONS,
  CATEGORY_COLOR_OPTIONS,
  CATEGORY_ICON_OPTIONS,
} from "@/constants/categories";
import { useCreateCategory, useUpdateCategory } from "@/hooks/useCategories";
import type { Category, UUID } from "@/models";

const schema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(80),
  type: z.nativeEnum(CategoryType),
  color: z.string().min(1),
  icon: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: UUID;
  editing: Category | null;
}

export function CategoryFormDialog({ open, onOpenChange, workspaceId, editing }: Props) {
  const createMut = useCreateCategory();
  const updateMut = useUpdateCategory();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      type: CategoryType.EXPENSE,
      color: CATEGORY_COLOR_OPTIONS[0],
      icon: CATEGORY_ICON_OPTIONS[0],
    },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        editing
          ? {
              name: editing.name,
              type: editing.type,
              color: editing.color,
              icon: editing.icon,
            }
          : {
              name: "",
              type: CategoryType.EXPENSE,
              color: CATEGORY_COLOR_OPTIONS[0],
              icon: CATEGORY_ICON_OPTIONS[0],
            },
      );
    }
  }, [open, editing, form]);

  const onSubmit = async (values: FormValues) => {
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, input: values });
        toast.success("Categoria atualizada");
      } else {
        await createMut.mutateAsync({ workspace_id: workspaceId, ...values });
        toast.success("Categoria criada");
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    }
  };

  const values = form.watch();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select
              value={values.type}
              onValueChange={(v) => form.setValue("type", v as CategoryType)}
              disabled={!!editing?.is_system}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORY_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => form.setValue("color", c)}
                  className={`h-8 w-8 rounded-full border-2 transition ${
                    values.color === c ? "border-foreground" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Ícone</Label>
            <Select
              value={values.icon}
              onValueChange={(v) => form.setValue("icon", v)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORY_ICON_OPTIONS.map((i) => (
                  <SelectItem key={i} value={i}>{i}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
