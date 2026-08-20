import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShieldCheck, ShieldOff, Check, Ban } from "lucide-react";
import { ACCESS_STATUS_LABEL, type AdminUserRow } from "@/models/Admin";

const DATE = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

function fmt(value: string | null): string {
  return value ? DATE.format(new Date(value)) : "—";
}

interface Props {
  rows: AdminUserRow[];
  currentUserId?: string;
  onGrant: (row: AdminUserRow) => void;
  onBlock: (row: AdminUserRow) => void;
  onToggleAdmin: (row: AdminUserRow) => void;
  busy?: boolean;
}

export function AdminUsersTable({
  rows,
  currentUserId,
  onGrant,
  onBlock,
  onToggleAdmin,
  busy,
}: Props) {
  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Nenhum usuário encontrado com os filtros atuais.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Usuário</TableHead>
            <TableHead>Cadastro</TableHead>
            <TableHead>Último acesso</TableHead>
            <TableHead>Workspaces</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Liberado em</TableHead>
            <TableHead>Bloqueado em</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{row.name ?? "—"}</span>
                  <span className="text-xs text-muted-foreground">{row.email ?? "—"}</span>
                </div>
                {row.is_admin && (
                  <Badge variant="secondary" className="mt-1">
                    Administrador
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-sm">{fmt(row.created_at)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {fmt(row.last_sign_in_at)}
              </TableCell>
              <TableCell className="text-sm">
                {row.workspaces.length === 0
                  ? "—"
                  : row.workspaces.map((w) => w.name).join(", ")}
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    row.status === "ACTIVE"
                      ? "default"
                      : row.status === "BLOCKED"
                        ? "destructive"
                        : "outline"
                  }
                >
                  {ACCESS_STATUS_LABEL[row.status]}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">{fmt(row.granted_at)}</TableCell>
              <TableCell className="text-sm">{fmt(row.blocked_at)}</TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || row.status === "ACTIVE"}
                    onClick={() => onGrant(row)}
                  >
                    <Check className="h-4 w-4" />
                    Liberar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || row.status === "BLOCKED" || row.id === currentUserId}
                    onClick={() => onBlock(row)}
                  >
                    <Ban className="h-4 w-4" />
                    Bloquear
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy || row.id === currentUserId}
                    onClick={() => onToggleAdmin(row)}
                    title={row.is_admin ? "Remover admin" : "Tornar admin"}
                  >
                    {row.is_admin ? (
                      <ShieldOff className="h-4 w-4" />
                    ) : (
                      <ShieldCheck className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
