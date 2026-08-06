import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Category, Subcategory, UUID } from "@/models";
import type { BudgetItemDraft, BudgetMode, MonthlyBudgetItem } from "@/models/MonthlyBudget";

interface Props {
  mode: BudgetMode;
  categories: Category[];
  subcategories: Subcategory[];
  items: MonthlyBudgetItem[];
  isPending: boolean;
  onSave: (items: BudgetItemDraft[]) => void;
}

interface Target {
  key: string;
  categoryId: UUID;
  subcategoryId: UUID | null;
  label: string;
  sublabel: string | null;
}

/** Editor dos valores PLANEJADOS. Não calcula realizado nem indicadores. */
export function BudgetItemsEditor({
  mode,
  categories,
  subcategories,
  items,
  isPending,
  onSave,
}: Props) {
  const targets = useMemo<Target[]>(() => {
    const active = categories.filter((c) => c.is_active && !c.deleted_at);
    if (mode === "SIMPLE") {
      return active.map((c) => ({
        key: `${c.id}:all`,
        categoryId: c.id,
        subcategoryId: null,
        label: c.name,
        sublabel: null,
      }));
    }
    return active.flatMap((c) => {
      const subs = subcategories.filter(
        (s) => s.category_id === c.id && s.is_active && !s.deleted_at,
      );
      return subs.map((s) => ({
        key: `${c.id}:${s.id}`,
        categoryId: c.id,
        subcategoryId: s.id,
        label: c.name,
        sublabel: s.name,
      }));
    });
  }, [mode, categories, subcategories]);

  const initial = useMemo(() => {
    const map: Record<string, string> = {};
    for (const i of items) {
      const key = `${i.category_id ?? "none"}:${
        mode === "ADVANCED" ? i.subcategory_id ?? "all" : "all"
      }`;
      map[key] = String(Number(i.planned_amount) || 0);
    }
    return map;
  }, [items, mode]);

  const [values, setValues] = useState<Record<string, string>>(initial);
  const [dirty, setDirty] = useState(false);

  const current = dirty ? values : initial;

  const handleChange = (key: string, value: string) => {
    setValues({ ...current, [key]: value });
    setDirty(true);
  };

  const handleSave = () => {
    const drafts: BudgetItemDraft[] = targets
      .map((t) => ({
        category_id: t.categoryId,
        subcategory_id: t.subcategoryId,
        planned_amount: Number(String(current[t.key] ?? "0").replace(",", ".")) || 0,
      }))
      .filter((d) => d.planned_amount > 0);
    onSave(drafts);
    setDirty(false);
  };

  return (
    <div className="space-y-4">
      <div className="max-h-[520px] overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Categoria</TableHead>
              {mode === "ADVANCED" && <TableHead>Subcategoria</TableHead>}
              <TableHead className="w-48 text-right">Planejado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {targets.map((t) => (
              <TableRow key={t.key}>
                <TableCell className="font-medium">{t.label}</TableCell>
                {mode === "ADVANCED" && (
                  <TableCell className="text-muted-foreground">{t.sublabel}</TableCell>
                )}
                <TableCell className="text-right">
                  <Input
                    inputMode="decimal"
                    className="text-right"
                    value={current[t.key] ?? ""}
                    placeholder="0,00"
                    onChange={(e) => handleChange(t.key, e.target.value)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex justify-end">
        <Button disabled={isPending} onClick={handleSave}>
          Salvar planejamento
        </Button>
      </div>
    </div>
  );
}
