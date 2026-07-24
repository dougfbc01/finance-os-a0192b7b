import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { CategoryFormDialog, SubcategoryFormDialog } from "@/components/categories";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  useCategories, useSubcategories,
  useToggleCategoryActive, useToggleSubcategoryActive,
} from "@/hooks/useCategories";
import { CategoryType } from "@/constants/enums";
import { CATEGORY_TYPE_LABELS } from "@/constants/categories";
import type { Category, Subcategory } from "@/models";

type Filter = "all" | CategoryType;

export const Route = createFileRoute("/_authenticated/categorias")({
  head: () => ({
    meta: [
      { title: "Categorias — Finance OS" },
      { name: "description", content: "Plano de categorias e subcategorias do Finance OS." },
    ],
  }),
  component: CategoriasPage,
});

function CategoriasPage() {
  const { data: workspace, isLoading: loadingWs } = useWorkspace();
  const workspaceId = workspace?.id;
  const { data: categories = [], isLoading: loadingCats } = useCategories(workspaceId);
  const { data: subcategories = [], isLoading: loadingSubs } = useSubcategories(workspaceId);
  const toggleCat = useToggleCategoryActive();
  const toggleSub = useToggleSubcategoryActive();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [catDialog, setCatDialog] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [subDialog, setSubDialog] = useState(false);
  const [editingSub, setEditingSub] = useState<Subcategory | null>(null);
  const [subCategoryId, setSubCategoryId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return categories.filter((c) => {
      if (filter !== "all" && c.type !== filter) return false;
      if (!term) return true;
      if (c.name.toLowerCase().includes(term)) return true;
      // Também casa se qualquer subcategoria contiver o termo.
      const subs = subcategories.filter((s) => s.category_id === c.id);
      return subs.some((s) => s.name.toLowerCase().includes(term));
    });
  }, [categories, subcategories, search, filter]);

  const subsByCategory = useMemo(() => {
    const map = new Map<string, Subcategory[]>();
    for (const s of subcategories) {
      const list = map.get(s.category_id) ?? [];
      list.push(s);
      map.set(s.category_id, list);
    }
    return map;
  }, [subcategories]);

  const openNewCategory = () => { setEditingCat(null); setCatDialog(true); };
  const openEditCategory = (c: Category) => { setEditingCat(c); setCatDialog(true); };
  const openNewSubcategory = (categoryId: string) => {
    setEditingSub(null);
    setSubCategoryId(categoryId);
    setSubDialog(true);
  };
  const openEditSubcategory = (s: Subcategory) => {
    setEditingSub(s);
    setSubCategoryId(s.category_id);
    setSubDialog(true);
  };

  const handleToggleCat = async (c: Category, next: boolean) => {
    try {
      await toggleCat.mutateAsync({ id: c.id, isActive: next });
      toast.success(next ? "Categoria ativada" : "Categoria desativada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar");
    }
  };
  const handleToggleSub = async (s: Subcategory, next: boolean) => {
    try {
      await toggleSub.mutateAsync({ id: s.id, isActive: next });
      toast.success(next ? "Subcategoria ativada" : "Subcategoria desativada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar");
    }
  };

  const loading = loadingWs || loadingCats || loadingSubs;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Categorias</h1>
          <p className="text-sm text-muted-foreground">
            Organize seu plano de categorias e subcategorias.
          </p>
        </div>
        <Button onClick={openNewCategory} disabled={!workspaceId}>
          <Plus className="h-4 w-4 mr-1" /> Nova Categoria
        </Button>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Pesquisar categorias..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value={CategoryType.INCOME}>Receitas</TabsTrigger>
            <TabsTrigger value={CategoryType.EXPENSE}>Despesas</TabsTrigger>
            <TabsTrigger value={CategoryType.INVESTMENT}>Investimentos</TabsTrigger>
            <TabsTrigger value={CategoryType.TRANSFER}>Transferências</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma categoria encontrada.</p>
      ) : (
        <Accordion type="multiple" className="w-full">
          {filtered.map((c) => {
            const subs = subsByCategory.get(c.id) ?? [];
            return (
              <AccordionItem key={c.id} value={c.id}>
                <div className="flex items-center gap-2">
                  <AccordionTrigger className="flex-1 hover:no-underline">
                    <div className="flex items-center gap-3">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: c.color }}
                      />
                      <span className={`font-medium ${!c.is_active ? "opacity-50 line-through" : ""}`}>
                        {c.name}
                      </span>
                      <Badge variant="secondary">{CATEGORY_TYPE_LABELS[c.type]}</Badge>
                      {c.is_system && <Badge variant="outline">Padrão</Badge>}
                      <span className="text-xs text-muted-foreground">
                        {subs.length} subcategoria{subs.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <div className="flex items-center gap-2 px-2">
                    <Switch
                      checked={c.is_active}
                      onCheckedChange={(v) => handleToggleCat(c, v)}
                      aria-label="Ativar/desativar"
                    />
                    <Button variant="ghost" size="icon" onClick={() => openEditCategory(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <AccordionContent>
                  <div className="pl-6 space-y-2">
                    <div className="flex justify-end">
                      <Button size="sm" variant="outline" onClick={() => openNewSubcategory(c.id)}>
                        <Plus className="h-3 w-3 mr-1" /> Nova Subcategoria
                      </Button>
                    </div>
                    {subs.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Nenhuma subcategoria.
                      </p>
                    ) : (
                      <ul className="divide-y rounded-md border">
                        {subs.map((s) => (
                          <li key={s.id} className="flex items-center justify-between px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span className={!s.is_active ? "opacity-50 line-through" : ""}>
                                {s.name}
                              </span>
                              {s.is_system && <Badge variant="outline">Padrão</Badge>}
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={s.is_active}
                                onCheckedChange={(v) => handleToggleSub(s, v)}
                                aria-label="Ativar/desativar"
                              />
                              <Button variant="ghost" size="icon" onClick={() => openEditSubcategory(s)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {workspaceId && (
        <>
          <CategoryFormDialog
            open={catDialog}
            onOpenChange={setCatDialog}
            workspaceId={workspaceId}
            editing={editingCat}
          />
          {subCategoryId && (
            <SubcategoryFormDialog
              open={subDialog}
              onOpenChange={setSubDialog}
              workspaceId={workspaceId}
              categoryId={subCategoryId}
              editing={editingSub}
            />
          )}
        </>
      )}
    </div>
  );
}
