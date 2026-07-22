import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, ArrowLeftRight, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MovementFormDialog } from "@/components/movements";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { useDeleteMovement, useMovements } from "@/hooks/useMovements";
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
import type { Movement, MovementFilters } from "@/models";
import { formatCurrency, formatDate, firstDayOfMonth, lastDayOfMonth, toISODate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/movimentacoes")({
  head: () => ({
    meta: [
      { title: "Movimentações — Finance OS" },
      { name: "description", content: "Extrato completo de movimentações financeiras." },
    ],
  }),
  component: MovimentacoesPage,
});

const ALL = "all";

function MovimentacoesPage() {
  const { data: workspace } = useWorkspace();
  const workspaceId = workspace?.id as string | undefined;

  const { data: accounts = [] } = useAccounts(workspaceId);
  const { data: categories = [] } = useCategories(workspaceId);

  const [from, setFrom] = useState(toISODate(firstDayOfMonth()));
  const [to, setTo] = useState(toISODate(lastDayOfMonth()));
  const [accountId, setAccountId] = useState<string>(ALL);
  const [categoryId, setCategoryId] = useState<string>(ALL);
  const [type, setType] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [search, setSearch] = useState("");

  const filters: MovementFilters = useMemo(
    () => ({
      from,
      to,
      accountId: accountId === ALL ? undefined : accountId,
      categoryId: categoryId === ALL ? undefined : categoryId,
      type: type === ALL ? undefined : (type as MovementType),
      status: status === ALL ? undefined : (status as MovementStatus),
      search: search.trim() || undefined,
    }),
    [from, to, accountId, categoryId, type, status, search],
  );

  const { data: movements = [], isLoading } = useMovements(workspaceId, filters);
  const deleteMut = useDeleteMovement();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Movement | null>(null);

  const accountMap = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a])), [accounts]);
  const categoryMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  const handleDelete = async (m: Movement) => {
    if (!confirm("Excluir esta movimentação?")) return;
    try {
      await deleteMut.mutateAsync(m.id);
      toast.success("Movimentação excluída");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
    }
  };

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
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
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

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : movements.length === 0 ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center rounded-lg border border-dashed text-center p-8">
          <p className="text-sm text-muted-foreground">Nenhuma movimentação encontrada.</p>
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Data</th>
                <th className="px-3 py-2 text-left font-medium">Descrição</th>
                <th className="px-3 py-2 text-left font-medium">Conta</th>
                <th className="px-3 py-2 text-left font-medium">Categoria</th>
                <th className="px-3 py-2 text-left font-medium">Tipo</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Valor</th>
                <th className="px-3 py-2 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => {
                const isIncome = INCOME_TYPES.includes(m.type);
                const isExpense = EXPENSE_TYPES.includes(m.type);
                const isTransfer = m.type === MovementType.TRANSFER;
                const acc = m.account_id ? accountMap[m.account_id] : null;
                const accTo = m.transfer_account_id ? accountMap[m.transfer_account_id] : null;
                const cat = m.category_id ? categoryMap[m.category_id] : null;
                return (
                  <tr key={m.id} className="border-t hover:bg-muted/30">
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
                    <td className="px-3 py-2 whitespace-nowrap">{cat?.name ?? "—"}</td>
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
    </div>
  );
}
