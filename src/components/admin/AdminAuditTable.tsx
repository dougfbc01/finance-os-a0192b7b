import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ADMIN_ACTION_LABEL, type AdminAuditLog, type AdminUserRow } from "@/models/Admin";

const DATE = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

interface Props {
  logs: AdminAuditLog[];
  users: AdminUserRow[];
}

export function AdminAuditTable({ logs, users }: Props) {
  const nameOf = (id: string | null) => {
    if (!id) return "—";
    const u = users.find((x) => x.id === id);
    return u?.email ?? u?.name ?? id;
  };

  if (logs.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhuma ação administrativa registrada até o momento.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Ação</TableHead>
            <TableHead>Usuário afetado</TableHead>
            <TableHead>Administrador</TableHead>
            <TableHead>Detalhes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell className="text-sm">{DATE.format(new Date(log.created_at))}</TableCell>
              <TableCell className="text-sm font-medium">
                {ADMIN_ACTION_LABEL[log.action] ?? log.action}
              </TableCell>
              <TableCell className="text-sm">{nameOf(log.target_user_id)}</TableCell>
              <TableCell className="text-sm">{nameOf(log.actor_id)}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {log.details && Object.keys(log.details).length > 0
                  ? JSON.stringify(log.details)
                  : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
