// Sprint 4.9.2 — Extrato individual por conta.
// Reutiliza MovementService (listagem/filtros), useMovementFilters,
// MovementTotalsBar e MovementFormDialog. O saldo corrido é derivado por
// AccountStatementService a partir de MovementServiceImpl.impactOnAccount.
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Pencil, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MovementFormDialog, MovementTotalsBar } from "@/components/movements";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAccounts } from "@/hooks/useAccounts";
import { useAssets } from "@/hooks/useAssets";
import { useCategories, useSubcategories } from "@/hooks/useCategories";
import { useMovementFilters } from "@/hooks/useMovementFilters";
import { useAllMovements, useMovements } from "@/hooks/useMovements";
import { AccountStatementService } from "@/services/AccountStatementService";
import {
  ACCOUNT_TYPE_LABELS,
  MOVEMENT_TYPE_LABELS,
  MOVEMENT_STATUS_LABELS,
  MOVEMENT_TYPE_OPTIONS,
  MOVEMENT_STATUS_OPTIONS,
  ROUTES,
} from "@/constants";
import { getAccountIcon } from "@/lib/account-icons";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Movement, MovementGroup } from "@/models";

interface StatementSearch {
  from?: string;
  to?: string;
}

export const Route = createFileRoute("/_authenticated/contas_/$accountId")({
  validateSearch: (s: Record<string, unknown>): StatementSearch => ({
    from: typeof s.from === "string" ? s.from : undefined,
    to: typeof s.to === "string" ? s.to : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Extrato da conta — Finance OS" },
      {
        name: "description",
        content: "Extrato individual com saldo corrido, filtros e totalizador da conta.",
      },
    ],
  }),
  component: ExtratoContaPage,
});

const ALL = "all";

function ExtratoContaPage() {
  const { accountId } = Route.useParams();
  const searchParams = Route.useSearch();
  const { data: workspace, isLoading: loadingWs } = useWorkspace();
  const workspaceId = workspace?.id as string | undefined;

  const { data: accounts = [], isLoading: loadingAccounts } = useAccounts(workspaceId);
  const { data: assets = [] } = useAssets(workspaceId);
  const { data: categories = [] } = useCategories(workspaceId);
  const { data: subcategories = [] } = useSubcategories(workspaceId);

  const account = accounts.find((a) => a.id === accountId);

  const {
    from,
    setFrom,
    to,
    setTo,
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
  } = useMovementFilters({ from: searchParams.from, to: searchParams.to });

  // A conta é sempre implícita: nunca depende de filtro frágil da URL.
  const accountFilters = useMemo(
    () => ({ ...filters, accountId, cardId: undefined }),
    [filters, accountId],
  );

  const { data: movements = [], isLoading } = useMovements(workspaceId, accountFilters);
  // Já em cache (mesma query usada pelos saldos do Dashboard/Contas).
  const { data: allMovements = [] } = useAllMovements(workspaceId);

  const accountMovements = useMemo(
    () => AccountStatementService.forAccount(allMovements, accountId),
    [allMovements, accountId],
  );

  const currentBalance = account
    ? AccountStatementService.currentBalance(account, accountMovements)
    : 0;

  const statement = useMemo(() => {
    if (!account) return null;
    const opening = AccountStatementService.openingBalance(account, accountMovements, from);
    return AccountStatementService.build(accountId, movements, opening);
  }, [account, accountMovements, from, movements, accountId]);

  const categoryMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories],
  );
  const subMap = useMemo(
    () => Object.fromEntries(subcategories.map((s) => [s.id, s])),
    [subcategories],
  );
  const subOptions = useMemo(
    () =>
      categoryId === ALL || categoryId === "none"
        ? subcategories
        : subcategories.filter((s) => s.category_id === categoryId),
    [subcategories, categoryId],
  );

  const linkedAsset = assets.find((a) => a.account_id === accountId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Movement | null>(null);
  const openEdit = (m: Movement) => {
    setEditing(m);
    setDialogOpen(true);
  };

  if (loadingWs || loadingAccounts) {
    return <div className="text-sm text-muted-foreground">Carregando…</div>;
  }

  if (!account) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Conta não encontrada ou você não tem acesso a ela.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to={ROUTES.CONTAS}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Voltar para Contas
          </Link>
        </Button>
      </div>
    );
  }

  const Icon = getAccountIcon(account.icon);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" aria-label="Voltar para Contas">
            <Link to={ROUTES.CONTAS}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-primary-foreground"
            style={{ backgroundColor: account.color }}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{account.name}</h1>
            <p className="text-sm text-muted-foreground">
              {ACCOUNT_TYPE_LABELS[account.account_type]}
              {account.institution ? ` · ${account.institution}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={account.is_active ? "secondary" : "outline"}>
            {account.is_active ? "Ativa" : "Inativa"}
          </Badge>
          {linkedAsset && (
            <Badge variant="outline">Espelha o ativo “{linkedAsset.name}”</Badge>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Saldo atual</p>
            <p className="text-xl font-semibold tabular-nums">
              {formatCurrency(currentBalance, account.currency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Saldo anterior ao período</p>
            <p className="text-xl font-semibold tabular-nums">
              {formatCurrency(statement?.openingBalance ?? 0, account.currency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Saldo ao fim do período</p>
            <p className="text-xl font-semibold tabular-nums">
              {formatCurrency(statement?.closingBalance ?? 0, account.currency)}
            </p>
          </CardContent>
        </Card>
      </div>

      {!account.is_active && (
        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Esta conta está inativa. O extrato é exibido apenas para consulta.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar descrição…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Input
          type="date"
          className="w-[150px]"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          aria-label="Data inicial"
        />
        <Input
          type="date"
          className="w-[150px]"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          aria-label="Data final"
        />
        <Select value={group} onValueChange={(v) => setGroup(v as MovementGroup)}>
          <SelectTrigger className="w-[150px]" aria-label="Entradas ou saídas">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Entradas e saídas</SelectItem>
            <SelectItem value="income">Somente entradas</SelectItem>
            <SelectItem value="expense">Somente saídas</SelectItem>
            <SelectItem value="transfer">Transferências</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="w-[170px]" aria-label="Categoria">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            <SelectItem value="none">Sem categoria</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={subcategoryId} onValueChange={setSubcategoryId}>
          <SelectTrigger className="w-[170px]" aria-label="Subcategoria">
            <SelectValue placeholder="Subcategoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as subcategorias</SelectItem>
            <SelectItem value="none">Sem subcategoria</SelectItem>
            {subOptions.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-[150px]" aria-label="Tipo">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {MOVEMENT_TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[150px]" aria-label="Status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {MOVEMENT_STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button variant="outline" onClick={clearFilters}>
            <X className="mr-1 h-4 w-4" />
            Limpar filtros
          </Button>
        )}
      </div>

      <div className="rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Data</th>
                <th className="px-3 py-2 text-left">Descrição</th>
                <th className="px-3 py-2 text-left">Tipo</th>
                <th className="px-3 py-2 text-left">Categoria</th>
                <th className="px-3 py-2 text-left">Subcategoria</th>
                <th className="px-3 py-2 text-right">Entrada</th>
                <th className="px-3 py-2 text-right">Saída</th>
                <th className="px-3 py-2 text-right">Saldo</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              <tr className="border-t bg-muted/20">
                <td className="px-3 py-2 text-muted-foreground" colSpan={7}>
                  Saldo anterior
                </td>
                <td className="px-3 py-2 text-right font-medium tabular-nums">
                  {formatCurrency(statement?.openingBalance ?? 0, account.currency)}
                </td>
                <td />
              </tr>
              {isLoading ? (
                <tr>
                  <td className="px-3 py-8 text-center text-muted-foreground" colSpan={9}>
                    Carregando…
                  </td>
                </tr>
              ) : (statement?.rows.length ?? 0) === 0 ? (
                <tr>
                  <td className="px-3 py-8 text-center text-muted-foreground" colSpan={9}>
                    {accountMovements.length === 0
                      ? "Esta conta ainda não possui movimentações."
                      : "Nenhuma movimentação no período/filtros selecionados."}
                  </td>
                </tr>
              ) : (
                statement!.rows.map((row) => {
                  const m = row.movement;
                  return (
                    <tr key={m.id} className="border-t hover:bg-muted/30">
                      <td className="whitespace-nowrap px-3 py-2">
                        {formatDate(m.transaction_date)}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="text-left hover:underline"
                          onClick={() => openEdit(m)}
                        >
                          {m.description || "—"}
                        </button>
                        <div className="text-xs text-muted-foreground">
                          {MOVEMENT_STATUS_LABELS[m.status]}
                          {m.is_historical ? " · histórico" : ""}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {MOVEMENT_TYPE_LABELS[m.type]}
                      </td>
                      <td className="px-3 py-2">
                        {(m.category_id && categoryMap[m.category_id]?.name) || "—"}
                      </td>
                      <td className="px-3 py-2">
                        {(m.subcategory_id && subMap[m.subcategory_id]?.name) || "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-600">
                        {row.inflow > 0 ? formatCurrency(row.inflow, account.currency) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-destructive">
                        {row.outflow > 0 ? formatCurrency(row.outflow, account.currency) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {formatCurrency(row.balance, account.currency)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Editar movimentação"
                          onClick={() => openEdit(m)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <MovementTotalsBar movements={movements} />
      </div>

      {workspaceId && (
        <MovementFormDialog
          open={dialogOpen}
          onOpenChange={(o) => {
            setDialogOpen(o);
            if (!o) setEditing(null);
          }}
          workspaceId={workspaceId}
          movement={editing}
        />
      )}
    </div>
  );
}
