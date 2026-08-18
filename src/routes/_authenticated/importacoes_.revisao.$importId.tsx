import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Pencil,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MovementFormDialog } from "@/components/movements";
import { useImportReview } from "@/hooks/useImportReview";
import { useSetImportReviewed } from "@/hooks/useImports";
import { useBulkUpdateMovements } from "@/hooks/useMovements";
import { useCategories, useSubcategories } from "@/hooks/useCategories";
import { useAuth } from "@/hooks/useAuth";
import { IMPORT_REVIEW_FLAG_LABELS } from "@/services/ImportReviewService";
import type { ImportReviewRow } from "@/services/ImportReviewService";
import { MOVEMENT_STATUS_OPTIONS, MOVEMENT_TYPE_LABELS, MovementStatus } from "@/constants/enums";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Movement, UUID } from "@/models";

export const Route = createFileRoute("/_authenticated/importacoes_/revisao/$importId")({
  head: () => ({
    meta: [
      { title: "Revisão da Importação — Finance OS" },
      {
        name: "description",
        content:
          "Confira apenas os lançamentos novos da importação, valide a classificação automática e conclua a revisão.",
      },
      { property: "og:title", content: "Revisão da Importação — Finance OS" },
      {
        property: "og:description",
        content: "Homologue os lançamentos recém-importados antes de misturá-los ao histórico.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ImportReviewPage,
});

function ImportReviewPage() {
  const { importId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { workspaceId, importRecord, rows, summary, isLoading } = useImportReview(importId);
  const { data: categories = [] } = useCategories(workspaceId);
  const { data: subcategories = [] } = useSubcategories(workspaceId);
  const bulk = useBulkUpdateMovements();
  const setReviewed = useSetImportReviewed();

  const [selected, setSelected] = useState<Set<UUID>>(new Set());
  const [editing, setEditing] = useState<Movement | null>(null);
  const [onlyAttention, setOnlyAttention] = useState(false);

  const categoryMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.name])),
    [categories],
  );
  const subMap = useMemo(
    () => Object.fromEntries(subcategories.map((s) => [s.id, s.name])),
    [subcategories],
  );

  const visible = onlyAttention ? rows.filter((r) => r.flags.length > 0) : rows;
  const allSelected = visible.length > 0 && visible.every((r) => selected.has(r.movement.id));

  const toggleAll = (v: boolean) =>
    setSelected(v ? new Set(visible.map((r) => r.movement.id)) : new Set());
  const toggleOne = (id: UUID, v: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (v) next.add(id);
      else next.delete(id);
      return next;
    });

  const applyBulk = async (patch: { category_id?: UUID | null; status?: MovementStatus }) => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    try {
      await bulk.mutateAsync({ ids, patch });
      toast.success(`${ids.length} lançamento(s) atualizado(s).`);
      setSelected(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar.");
    }
  };

  const finishReview = async () => {
    try {
      await setReviewed.mutateAsync({ id: importId, reviewed: true, userId: user?.id ?? null });
      toast.success("Revisão concluída.");
      navigate({ to: "/movimentacoes" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao concluir revisão.");
    }
  };

  const reopenReview = async () => {
    try {
      await setReviewed.mutateAsync({ id: importId, reviewed: false });
      toast.success("Revisão reaberta.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao reabrir revisão.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
            <Link to="/importacoes">
              <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Importações
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Revisão da Importação</h1>
          <p className="text-sm text-muted-foreground">
            {importRecord ? (
              <>
                {importRecord.file_name} ·{" "}
                {new Date(importRecord.imported_at).toLocaleString("pt-BR")}
              </>
            ) : (
              "Somente os lançamentos efetivamente novos desta importação."
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {importRecord?.reviewed_at ? (
            <>
              <Badge className="bg-emerald-600 text-primary-foreground">Revisão concluída</Badge>
              <Button variant="outline" onClick={reopenReview} disabled={setReviewed.isPending}>
                Reabrir revisão
              </Button>
            </>
          ) : (
            <Button onClick={finishReview} disabled={setReviewed.isPending || isLoading}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Concluir revisão
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link to="/movimentacoes">Ir para Movimentações</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Novos" value={String(summary.total)} />
        <Stat label="Classificados" value={String(summary.autoClassified)} tone="positive" />
        <Stat label="Sem categoria" value={String(summary.withoutCategory)} tone="warn" />
        <Stat label="Exigem atenção" value={String(summary.needsAttention)} tone="danger" />
        <Stat label="Saldo líquido" value={formatCurrency(summary.net)} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={onlyAttention} onCheckedChange={(v) => setOnlyAttention(!!v)} />
          Mostrar somente os que exigem atenção
        </label>
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
            <span className="text-sm">{selected.size} selecionado(s)</span>
            <Select onValueChange={(v) => applyBulk({ category_id: v as UUID })}>
              <SelectTrigger className="w-[190px]">
                <SelectValue placeholder="Definir categoria…" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select onValueChange={(v) => applyBulk({ status: v as MovementStatus })}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Alterar status…" />
              </SelectTrigger>
              <SelectContent>
                {MOVEMENT_STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Limpar seleção
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : visible.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhum lançamento novo para revisar nesta importação.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="w-[36px] px-3 py-2">
                  <Checkbox checked={allSelected} onCheckedChange={(v) => toggleAll(!!v)} />
                </th>
                <th className="px-3 py-2 text-left font-medium">Data</th>
                <th className="px-3 py-2 text-left font-medium">Descrição</th>
                <th className="px-3 py-2 text-left font-medium">Classificação</th>
                <th className="px-3 py-2 text-left font-medium">Tipo</th>
                <th className="px-3 py-2 text-right font-medium">Valor</th>
                <th className="px-3 py-2 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <ReviewRow
                  key={row.movement.id}
                  row={row}
                  categoryMap={categoryMap}
                  subMap={subMap}
                  checked={selected.has(row.movement.id)}
                  onCheck={(v) => toggleOne(row.movement.id, v)}
                  onEdit={() => setEditing(row.movement)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {workspaceId && editing && (
        <MovementFormDialog
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          workspaceId={workspaceId}
          movement={editing}
        />
      )}
    </div>
  );
}

function ReviewRow({
  row,
  categoryMap,
  subMap,
  checked,
  onCheck,
  onEdit,
}: {
  row: ImportReviewRow;
  categoryMap: Record<string, string>;
  subMap: Record<string, string>;
  checked: boolean;
  onCheck: (v: boolean) => void;
  onEdit: () => void;
}) {
  const m = row.movement;
  const cat = m.category_id ? categoryMap[m.category_id] : null;
  const sub = m.subcategory_id ? subMap[m.subcategory_id] : null;
  const sim = row.simulation;

  return (
    <tr className="border-t align-top hover:bg-muted/30">
      <td className="px-3 py-2">
        <Checkbox checked={checked} onCheckedChange={(v) => onCheck(!!v)} />
      </td>
      <td className="whitespace-nowrap px-3 py-2">{formatDate(m.transaction_date)}</td>
      <td className="px-3 py-2">
        <div className="font-medium">{m.description || "—"}</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {row.flags.map((f) => (
            <Badge key={f} variant="outline" className="gap-1 text-xs">
              {f === "POSSIBLE_DUPLICATE" ? (
                <Copy className="h-3 w-3" />
              ) : (
                <AlertTriangle className="h-3 w-3" />
              )}
              {IMPORT_REVIEW_FLAG_LABELS[f]}
              {f === "POSSIBLE_DUPLICATE" && row.duplicateOf
                ? ` (${row.duplicateOf.confidence}%)`
                : ""}
            </Badge>
          ))}
        </div>
      </td>
      <td className="px-3 py-2">
        {cat ? (
          <div>
            <div>
              {cat}
              {sub ? ` / ${sub}` : ""}
            </div>
            {row.autoClassified && sim?.rule && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="mt-1 inline-flex cursor-help items-center gap-1 text-xs text-muted-foreground">
                      <Sparkles className="h-3 w-3" />
                      Automática · “{sim.rule.text_pattern}” ·{" "}
                      {sim.specificityLabel ?? "—"}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p className="text-xs">{sim.reason}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Prioridade {sim.priority ?? 0} · especificidade {sim.specificity} ·{" "}
                      {sim.candidates.length} candidata(s)
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">Sem categoria</span>
        )}
      </td>
      <td className="px-3 py-2">{MOVEMENT_TYPE_LABELS[m.type]}</td>
      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(Number(m.amount))}</td>
      <td className="px-3 py-2 text-right">
        <Button variant="ghost" size="icon" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "warn" | "danger";
}) {
  const cls =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "warn"
        ? "text-amber-600"
        : tone === "danger"
          ? "text-red-600"
          : "";
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-xl font-semibold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}
