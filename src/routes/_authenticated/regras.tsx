import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { RuleFormDialog } from "@/components/rules/RuleFormDialog";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useCategories, useSubcategories } from "@/hooks/useCategories";
import {
  useClassificationRules,
  useDeleteClassificationRule,
  useUpdateClassificationRule,
} from "@/hooks/useClassificationRules";
import type { ClassificationRule } from "@/models";

export const Route = createFileRoute("/_authenticated/regras")({
  head: () => ({
    meta: [
      { title: "Regras de Classificação — Finance OS" },
      {
        name: "description",
        content: "Regras que classificam automaticamente movimentações importadas.",
      },
    ],
  }),
  component: RegrasPage,
});

function RegrasPage() {
  const { data: ws } = useWorkspace();
  const wsId = ws?.id as string | undefined;
  const { data: rules = [], isLoading } = useClassificationRules(wsId);
  const { data: categories = [] } = useCategories(wsId);
  const { data: subcategories = [] } = useSubcategories(wsId);
  const updateMut = useUpdateClassificationRule();
  const deleteMut = useDeleteClassificationRule();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClassificationRule | null>(null);

  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));
  const subMap = Object.fromEntries(subcategories.map((s) => [s.id, s]));

  const handleToggle = async (r: ClassificationRule, next: boolean) => {
    try {
      await updateMut.mutateAsync({ id: r.id, input: { enabled: next } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };
  const handleDelete = async (r: ClassificationRule) => {
    if (!confirm("Excluir regra?")) return;
    try {
      await deleteMut.mutateAsync(r.id);
      toast.success("Regra excluída");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Regras de Classificação</h1>
          <p className="text-sm text-muted-foreground">
            Padrões de texto que classificam automaticamente movimentações importadas.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          disabled={!wsId}
        >
          <Plus className="mr-1 h-4 w-4" /> Nova Regra
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : rules.length === 0 ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma regra cadastrada. Elas são criadas automaticamente quando você
            reclassifica uma movimentação.
          </p>
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Padrão</th>
                <th className="px-3 py-2 text-left font-medium">Categoria</th>
                <th className="px-3 py-2 text-left font-medium">Subcategoria</th>
                <th className="px-3 py-2 text-right font-medium">Prioridade</th>
                <th className="px-3 py-2 text-right font-medium">Uso</th>
                <th className="px-3 py-2 text-center font-medium">Ativa</th>
                <th className="px-3 py-2 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => {
                const c = r.category_id ? catMap[r.category_id] : null;
                const s = r.subcategory_id ? subMap[r.subcategory_id] : null;
                return (
                  <tr key={r.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs">{r.text_pattern}</td>
                    <td className="px-3 py-2">
                      {c ? (
                        <Badge variant="secondary" style={{ backgroundColor: c.color, color: "#fff" }}>
                          {c.name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{s?.name ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.priority}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.match_count}</td>
                    <td className="px-3 py-2 text-center">
                      <Switch
                        checked={r.enabled}
                        onCheckedChange={(v) => handleToggle(r, v)}
                      />
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditing(r);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(r)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {wsId && (
        <RuleFormDialog
          open={open}
          onOpenChange={setOpen}
          workspaceId={wsId}
          rule={editing}
        />
      )}
    </div>
  );
}
