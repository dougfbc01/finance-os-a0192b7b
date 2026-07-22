import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountCard, AccountFormDialog } from "@/components/accounts";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAccounts, useToggleAccountActive } from "@/hooks/useAccounts";
import type { Account } from "@/models";

type Filter = "all" | "active" | "inactive";

export const Route = createFileRoute("/_authenticated/contas")({
  head: () => ({
    meta: [
      { title: "Contas — Finance OS" },
      { name: "description", content: "Gerencie suas contas financeiras no Finance OS." },
    ],
  }),
  component: ContasPage,
});

function ContasPage() {
  const { data: workspace, isLoading: loadingWs } = useWorkspace();
  const workspaceId = workspace?.id;
  const { data: accounts = [], isLoading } = useAccounts(workspaceId);
  const toggleMut = useToggleAccountActive();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return accounts.filter((a) => {
      if (filter === "active" && !a.is_active) return false;
      if (filter === "inactive" && a.is_active) return false;
      if (term && !a.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [accounts, search, filter]);

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (account: Account) => {
    setEditing(account);
    setDialogOpen(true);
  };
  const handleToggle = async (account: Account, next: boolean) => {
    try {
      await toggleMut.mutateAsync({ id: account.id, isActive: next });
      toast.success(next ? "Conta ativada" : "Conta desativada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contas</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie as contas financeiras do seu workspace.
          </p>
        </div>
        <Button onClick={openNew} disabled={!workspaceId}>
          <Plus className="mr-1 h-4 w-4" />
          Nova Conta
        </Button>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Pesquisar por nome…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="active">Ativas</TabsTrigger>
            <TabsTrigger value="inactive">Inativas</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading || loadingWs ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center rounded-lg border border-dashed text-center p-8">
          <p className="text-sm text-muted-foreground">
            {accounts.length === 0
              ? "Você ainda não tem contas cadastradas."
              : "Nenhuma conta encontrada com os filtros atuais."}
          </p>
          {accounts.length === 0 && (
            <Button onClick={openNew} className="mt-4" disabled={!workspaceId}>
              <Plus className="mr-1 h-4 w-4" />
              Criar primeira conta
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onEdit={openEdit}
              onToggleActive={handleToggle}
              toggling={toggleMut.isPending}
            />
          ))}
        </div>
      )}

      {workspaceId && (
        <AccountFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          workspaceId={workspaceId}
          account={editing}
        />
      )}
    </div>
  );
}
