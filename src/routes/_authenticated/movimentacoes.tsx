import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  ArrowLeftRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { MovementFormDialog, MovementTotalsBar } from "@/components/movements";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAccounts } from "@/hooks/useAccounts";
import { useCards } from "@/hooks/useCards";
import { useCategories, useSubcategories } from "@/hooks/useCategories";
import { useMovementFilters } from "@/hooks/useMovementFilters";
import {
  useBulkDeleteMovements,
  useBulkUpdateMovements,
  useDeleteMovement,
  useMovements,
  useUpdateMovement,
} from "@/hooks/useMovements";

import { useRememberClassification } from "@/hooks/useClassificationRules";
import {
  MovementType,
  MovementStatus,
  MOVEMENT_TYPE_LABELS,
  MOVEMENT_STATUS_LABELS,
  MOVEMENT_TYPE_OPTIONS,
  MOVEMENT_STATUS_OPTIONS,
  INCOME_TYPES,
  EXPENSE_TYPES,
} from "@/constants/enums";
import type { Movement, MovementFilters, MovementGroup } from "@/models";
import { formatCurrency, formatDate, firstDayOfMonth, lastDayOfMonth, toISODate } from "@/lib/format";

type SortKey = "date" | "amount" | "account" | "category" | "subcategory" | "description";
type SortDir = "asc" | "desc";

interface Search {
  account?: string;
  category?: string;
  subcategory?: string;
  from?: string;
  to?: string;
}

export const Route = createFileRoute("/_authenticated/movimentacoes")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    account: typeof s.account === "string" ? s.account : undefined,
    category: typeof s.category === "string" ? s.category : undefined,
    subcategory: typeof s.subcategory === "string" ? s.subcategory : undefined,
    from: typeof s.from === "string" ? s.from : undefined,
    to: typeof s.to === "string" ? s.to : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Movimentações — Finance OS" },
      { name: "description", content: "Extrato completo de movimentações financeiras." },
    ],
  }),
  component: MovimentacoesPage,
});

const ALL = "all";
const NO_CATEGORY = "none";
const DEFAULT_GROUP: MovementGroup = "all";

function MovimentacoesPage() {
  const { data: workspace } = useWorkspace();
  const workspaceId = workspace?.id as string | undefined;
  const searchParams = Route.useSearch();

  const { data: accounts = [] } = useAccounts(workspaceId);
  const { data: cards = [] } = useCards(workspaceId);
  const { data: categories = [] } = useCategories(workspaceId);
  const { data: subcategories = [] } = useSubcategories(workspaceId);

  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const {
    from,
    setFrom,
    to,
    setTo,
    accountId,
    setAccountId,
    cardId,
    setCardId,
    categoryId,
    setCategoryId,
    subcategoryId,
    setSubcategoryId,
    type,
    setType,
    status,
    setStatus,
    group,
    setGroup,
    search,
    setSearch,
    filters,
    hasActiveFilters,
    clearFilters,
  } = useMovementFilters(searchParams);



  const { data: movements = [], isLoading } = useMovements(workspaceId, filters);

  // Destaque do totalizador conforme o filtro aplicado (receitas x despesas).
  const totalsEmphasis: "income" | "expense" | "all" = useMemo(() => {
    if (group === "income" || (type !== ALL && INCOME_TYPES.includes(type as MovementType)))
      return "income";
    if (group === "expense" || (type !== ALL && EXPENSE_TYPES.includes(type as MovementType)))
      return "expense";
    return "all";
  }, [group, type]);
  const deleteMut = useDeleteMovement();
  const bulkDelMut = useBulkDeleteMovements();
  const bulkUpdMut = useBulkUpdateMovements();
  const updateMut = useUpdateMovement();
  const rememberMut = useRememberClassification();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Movement | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rememberPrompt, setRememberPrompt] = useState<{
    movement: Movement;
    categoryId: string | null;
    subcategoryId: string | null;
  } | null>(null);

  const accountMap = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a])), [accounts]);
  const cardMap = useMemo(() => Object.fromEntries(cards.map((c) => [c.id, c])), [cards]);
  const categoryMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const subMap = useMemo(() => Object.fromEntries(subcategories.map((s) => [s.id, s])), [subcategories]);


  const sorted = useMemo(() => {
    const arr = [...movements];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      switch (sortKey) {
        case "date":
          av = a.transaction_date;
          bv = b.transaction_date;
          break;
        case "amount":
          av = a.amount;
          bv = b.amount;
          break;
        case "account":
          av = (a.account_id && accountMap[a.account_id]?.name) || "";
          bv = (b.account_id && accountMap[b.account_id]?.name) || "";
          break;
        case "category":
          av = (a.category_id && categoryMap[a.category_id]?.name) || "";
          bv = (b.category_id && categoryMap[b.category_id]?.name) || "";
          break;
        case "subcategory":
          av = (a.subcategory_id && subMap[a.subcategory_id]?.name) || "";
          bv = (b.subcategory_id && subMap[b.subcategory_id]?.name) || "";
          break;
        case "description":
          av = a.description || "";
          bv = b.description || "";
          break;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return arr;
  }, [movements, sortKey, sortDir, accountMap, categoryMap, subMap]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "date" || key === "amount" ? "desc" : "asc");
    }
  };

  const allSelected = sorted.length > 0 && selected.size === sorted.length;
  const toggleAll = (checked: boolean) => {
    if (checked) setSelected(new Set(sorted.map((m) => m.id)));
    else setSelected(new Set());
  };
  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleDelete = async (m: Movement) => {
    if (!confirm("Excluir esta movimentação?")) return;
    try {
      await deleteMut.mutateAsync(m.id);
      toast.success("Movimentação excluída");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
    }
  };

  const handleQuickCategoryChange = async (m: Movement, newCategoryId: string) => {
    const target = newCategoryId === ALL ? null : newCategoryId;
    try {
      await updateMut.mutateAsync({
        id: m.id,
        input: { category_id: target, subcategory_id: null },
      });
      if (target && m.description) {
        setRememberPrompt({
          movement: m,
          categoryId: target,
          subcategoryId: null,
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar");
    }
  };

  const handleRememberConfirm = async () => {
    if (!rememberPrompt || !workspaceId) return;
    try {
      await rememberMut.mutateAsync({
        workspaceId,
        description: rememberPrompt.movement.description,
        categoryId: rememberPrompt.categoryId,
        subcategoryId: rememberPrompt.subcategoryId,
      });
      toast.success("Regra memorizada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar regra");
    } finally {
      setRememberPrompt(null);
    }
  };

  const handleBulkCategory = async (value: string) => {
    if (!selected.size) return;
    const target = value === ALL ? null : value;
    try {
      await bulkUpdMut.mutateAsync({
        ids: Array.from(selected),
        patch: { category_id: target, subcategory_id: null },
      });
      toast.success(`${selected.size} movimentação(ões) atualizada(s)`);
      setSelected(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const handleBulkStatus = async (value: string) => {
    if (!selected.size) return;
    try {
      await bulkUpdMut.mutateAsync({
        ids: Array.from(selected),
        patch: { status: value as MovementStatus },
      });
      toast.success(`${selected.size} movimentação(ões) atualizada(s)`);
      setSelected(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const handleBulkDelete = async () => {
    try {
      await bulkDelMut.mutateAsync(Array.from(selected));
      toast.success(`${selected.size} movimentação(ões) excluída(s)`);
      setSelected(new Set());
      setConfirmDelete(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey !== k ? (
      <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-40" />
    ) : sortDir === "asc" ? (
      <ArrowUp className="ml-1 inline h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 inline h-3 w-3" />
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Movimentações</h1>
          <p className="text-sm text-muted-foreground">Extrato completo do workspace.</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }} disabled={!workspaceId}>
          <Plus className="mr-1 h-4 w-4" />
          Nova movimentação
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { v: "all", l: "Todos" },
            { v: "account", l: "Conta bancária" },
            { v: "card", l: "Cartão" },
            { v: "transfer", l: "Transferências" },
            { v: "income", l: "Receitas" },
            { v: "expense", l: "Despesas" },
            { v: "investment", l: "Investimentos" },
          ] as { v: MovementGroup; l: string }[]
        ).map((g) => (
          <Button
            key={g.v}
            size="sm"
            variant={group === g.v ? "default" : "outline"}
            onClick={() => setGroup(g.v)}
          >
            {g.l}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">

        <div className="col-span-2 md:col-span-2">
          <label className="text-xs text-muted-foreground">Pesquisar</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Descrição…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">De</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Até</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Conta</label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Categoria</label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas</SelectItem>
              <SelectItem value={NO_CATEGORY}>Sem categoria</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Subcategoria</label>
          <Select value={subcategoryId} onValueChange={setSubcategoryId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas</SelectItem>
              {subcategories
                .filter((sc) => categoryId === ALL || sc.category_id === categoryId)
                .map((sc) => (
                  <SelectItem key={sc.id} value={sc.id}>{sc.name}</SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Tipo</label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos</SelectItem>
              {MOVEMENT_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Status</label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos</SelectItem>
              {MOVEMENT_STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={clearFilters}
          disabled={!hasActiveFilters}
          aria-label="Limpar filtros"
        >
          <X className="mr-1 h-4 w-4" />
          Limpar filtros
        </Button>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between rounded-md border bg-muted/40 p-3">
          <div className="text-sm">
            <strong>{selected.size}</strong> selecionada(s)
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select onValueChange={handleBulkCategory}>
              <SelectTrigger className="w-[190px]"><SelectValue placeholder="Alterar categoria…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Sem categoria</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select onValueChange={handleBulkStatus}>
              <SelectTrigger className="w-[170px]"><SelectValue placeholder="Alterar status…" /></SelectTrigger>
              <SelectContent>
                {MOVEMENT_STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Excluir
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Limpar seleção
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : sorted.length === 0 ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center rounded-lg border border-dashed text-center p-8">
          <p className="text-sm text-muted-foreground">Nenhuma movimentação encontrada.</p>
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 w-[36px]">
                  <Checkbox checked={allSelected} onCheckedChange={(v) => toggleAll(!!v)} />
                </th>
                <th className="px-3 py-2 text-left font-medium cursor-pointer select-none" onClick={() => toggleSort("date")}>
                  Data <SortIcon k="date" />
                </th>
                <th className="px-3 py-2 text-left font-medium cursor-pointer select-none" onClick={() => toggleSort("description")}>
                  Descrição <SortIcon k="description" />
                </th>
                <th className="px-3 py-2 text-left font-medium cursor-pointer select-none" onClick={() => toggleSort("account")}>
                  Conta <SortIcon k="account" />
                </th>
                <th className="px-3 py-2 text-left font-medium">Cartão</th>

                <th className="px-3 py-2 text-left font-medium cursor-pointer select-none" onClick={() => toggleSort("category")}>
                  Categoria <SortIcon k="category" />
                </th>
                <th className="px-3 py-2 text-left font-medium cursor-pointer select-none" onClick={() => toggleSort("subcategory")}>
                  Subcategoria <SortIcon k="subcategory" />
                </th>
                <th className="px-3 py-2 text-left font-medium">Tipo</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium cursor-pointer select-none" onClick={() => toggleSort("amount")}>
                  Valor <SortIcon k="amount" />
                </th>
                <th className="px-3 py-2 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((m) => {
                const isIncome = INCOME_TYPES.includes(m.type);
                const isExpense = EXPENSE_TYPES.includes(m.type);
                const isTransfer = m.type === MovementType.TRANSFER;
                const acc = m.account_id ? accountMap[m.account_id] : null;
                const accTo = m.transfer_account_id ? accountMap[m.transfer_account_id] : null;
                const cat = m.category_id ? categoryMap[m.category_id] : null;
                const sub = m.subcategory_id ? subMap[m.subcategory_id] : null;
                return (
                  <tr key={m.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <Checkbox
                        checked={selected.has(m.id)}
                        onCheckedChange={(v) => toggleOne(m.id, !!v)}
                      />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(m.transaction_date)}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{m.description || <span className="text-muted-foreground">—</span>}</div>
                      {isTransfer && acc && accTo && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          {acc.name} <ArrowLeftRight className="h-3 w-3" /> {accTo.name}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{acc?.name ?? "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {m.card_id ? (
                        <Badge variant="outline" style={{ borderColor: cardMap[m.card_id]?.color }}>
                          {cardMap[m.card_id]?.name ?? "Cartão"}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    <td className="px-3 py-2 whitespace-nowrap">
                      {isTransfer ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <Select
                          value={m.category_id ?? ALL}
                          onValueChange={(v) => handleQuickCategoryChange(m, v)}
                        >
                          <SelectTrigger className="h-8 w-[160px]">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={ALL}>—</SelectItem>
                            {categories.map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{sub?.name ?? "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Badge variant="secondary">{MOVEMENT_TYPE_LABELS[m.type]}</Badge>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Badge variant="outline">{MOVEMENT_STATUS_LABELS[m.status]}</Badge>
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums font-medium ${isIncome ? "text-emerald-600" : isExpense ? "text-red-600" : ""}`}>
                      <span className="inline-flex items-center gap-1">
                        {isIncome && <ArrowUp className="h-3 w-3" />}
                        {isExpense && <ArrowDown className="h-3 w-3" />}
                        {formatCurrency(m.amount, acc?.currency ?? "BRL")}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" onClick={() => { setEditing(m); setDialogOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(m)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <MovementTotalsBar movements={sorted} emphasis={totalsEmphasis} />
        </div>
      )}

      {workspaceId && (
        <MovementFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          workspaceId={workspaceId}
          movement={editing}
        />
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir movimentações?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a excluir {selected.size} movimentação(ões).
              Elas serão marcadas como removidas (soft delete) e sairão do extrato.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!rememberPrompt} onOpenChange={(o) => !o && setRememberPrompt(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Memorizar classificação?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Deseja memorizar esta classificação para futuras importações? Uma
              regra automática será criada com base na descrição
              {rememberPrompt ? ` "${rememberPrompt.movement.description}"` : ""}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não, obrigado</AlertDialogCancel>
            <AlertDialogAction onClick={handleRememberConfirm}>Memorizar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
