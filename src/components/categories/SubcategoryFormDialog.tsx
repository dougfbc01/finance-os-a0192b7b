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
import { toast } from "sonner";
import { useCreateSubcategory, useUpdateSubcategory } from "@/hooks/useCategories";
import type { Subcategory, UUID } from "@/models";

const schema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(80),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: UUID;
  categoryId: UUID;
  editing: Subcategory | null;
}

export function SubcategoryFormDialog({
  open, onOpenChange, workspaceId, categoryId, editing,
}: Props) {
  const createMut = useCreateSubcategory();
  const updateMut = useUpdateSubcategory();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  });

  useEffect(() => {
    if (open) form.reset({ name: editing?.name ?? "" });
  }, [open, editing, form]);

  const onSubmit = async (values: FormValues) => {
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, input: values });
        toast.success("Subcategoria atualizada");
      } else {
        await createMut.mutateAsync({
          category_id: categoryId,
          workspace_id: workspaceId,
          name: values.name,
        });
        toast.success("Subcategoria criada");
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Subcategoria" : "Nova Subcategoria"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sub-name">Nome</Label>
            <Input id="sub-name" {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
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
