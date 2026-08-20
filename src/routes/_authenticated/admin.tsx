import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { ShieldAlert, Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { AdminAuditTable, AdminMetricsCards, AdminUsersTable } from "@/components/admin";
import {
  useAdminAudit,
  useAdminUsers,
  useBlockAccess,
  useGrantAccess,
  useIsAdmin,
  useSetAdminRole,
} from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { AdminService } from "@/services/AdminService";
import type { AdminUserRow, UserAccessStatus } from "@/models/Admin";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administração — Finance OS" },
      {
        name: "description",
        content:
          "Área administrativa do Finance OS: usuários, liberação de acesso e auditoria administrativa.",
      },
      { property: "og:title", content: "Administração — Finance OS" },
      {
        property: "og:description",
        content: "Gestão de identidade, acesso e preparação de assinaturas do Finance OS.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

type PendingAction =
  | { kind: "GRANT" | "BLOCK"; row: AdminUserRow }
  | { kind: "ROLE"; row: AdminUserRow };

function AdminPage() {
  const { user } = useAuth();
  const { isAdmin, isLoading: loadingRole } = useIsAdmin();
  const { data: users = [], isLoading } = useAdminUsers(isAdmin);
  const { data: audit = [] } = useAdminAudit(isAdmin);

  const grant = useGrantAccess();
  const block = useBlockAccess();
  const setRole = useSetAdminRole();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<UserAccessStatus | "ALL">("ALL");
  const [pending, setPending] = useState<PendingAction | null>(null);

  const filtered = useMemo(
    () => AdminService.filterUsers(users, { search, status }),
    [users, search, status],
  );
  const overview = useMemo(() => AdminService.overview(users), [users]);

  if (loadingRole) {
    return <p className="text-sm text-muted-foreground">Verificando permissões…</p>;
  }

  if (!isAdmin) {
    return (
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            Acesso restrito
          </CardTitle>
          <CardDescription>
            Esta área é exclusiva para administradores do Finance OS. O bloqueio também é
            aplicado no servidor: sem permissão administrativa, nenhum dado de outros usuários é
            retornado.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const confirmLabel =
    pending?.kind === "GRANT"
      ? "Liberar acesso"
      : pending?.kind === "BLOCK"
        ? "Bloquear acesso"
        : pending?.row.is_admin
          ? "Remover administrador"
          : "Tornar administrador";

  const runPending = async () => {
    if (!pending) return;
    try {
      if (pending.kind === "GRANT") {
        await grant.mutateAsync({ userId: pending.row.id });
        toast.success("Acesso liberado.");
      } else if (pending.kind === "BLOCK") {
        await block.mutateAsync({ userId: pending.row.id });
        toast.success("Acesso bloqueado. Nenhum dado foi excluído.");
      } else {
        await setRole.mutateAsync({
          userId: pending.row.id,
          isAdmin: !pending.row.is_admin,
        });
        toast.success("Permissão administrativa atualizada.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha na ação administrativa.");
    } finally {
      setPending(null);
    }
  };

  const busy = grant.isPending || block.isPending || setRole.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Administração</h1>
        <p className="text-sm text-muted-foreground">
          Gestão de identidade e acesso ao produto. Dados financeiros dos usuários não são
          acessíveis por aqui.
        </p>
      </div>

      <AdminMetricsCards overview={overview} />

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="audit">Auditoria</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader className="gap-3">
              <CardTitle>Usuários</CardTitle>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder="Buscar por nome ou e-mail"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as UserAccessStatus | "ALL")}
                >
                  <SelectTrigger className="sm:w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos os status</SelectItem>
                    <SelectItem value="ACTIVE">Ativos</SelectItem>
                    <SelectItem value="BLOCKED">Bloqueados</SelectItem>
                    <SelectItem value="PENDING">Pendentes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Carregando usuários…</p>
              ) : (
                <AdminUsersTable
                  rows={filtered}
                  currentUserId={user?.id}
                  busy={busy}
                  onGrant={(row) => setPending({ kind: "GRANT", row })}
                  onBlock={(row) => setPending({ kind: "BLOCK", row })}
                  onToggleAdmin={(row) => setPending({ kind: "ROLE", row })}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Auditoria administrativa</CardTitle>
              <CardDescription>
                Registro de liberações, bloqueios e alterações de permissão. Nenhum dado
                financeiro é registrado.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AdminAuditTable logs={audit} users={users} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmLabel}</AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.kind === "BLOCK"
                ? `O usuário ${pending.row.email ?? pending.row.name ?? ""} perderá o acesso ao sistema. Nenhum dado ou histórico será excluído.`
                : `Confirmar a ação para ${pending?.row.email ?? pending?.row.name ?? ""}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={runPending}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
