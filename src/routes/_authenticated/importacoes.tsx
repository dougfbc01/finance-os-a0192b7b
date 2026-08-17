import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Upload, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ImportDialog } from "@/components/imports/ImportDialog";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { useAccounts } from "@/hooks/useAccounts";
import { useDeleteImport, useImports } from "@/hooks/useImports";
import { IMPORTER_LABELS } from "@/services/importers/ImporterFactory";
import {
  buildReviewPath,
  IMPORT_REVIEW_ROUTE,
  MOVEMENTS_ROUTE,
} from "@/services/ImportNavigationService";
import type { ImportRecord } from "@/models/Import";


export const Route = createFileRoute("/_authenticated/importacoes")({
  head: () => ({
    meta: [
      { title: "Importações — Finance OS" },
      {
        name: "description",
        content: "Importe extratos bancários e faturas de cartão automaticamente.",
      },
    ],
  }),
  component: ImportacoesPage,
});

function ImportacoesPage() {
  const { data: ws } = useWorkspace();
  const { user } = useAuth();
  const wsId = ws?.id as string | undefined;
  const { data: accounts = [] } = useAccounts(wsId);
  const { data: imports = [], isLoading } = useImports(wsId);
  const del = useDeleteImport();
  const [open, setOpen] = useState(false);

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este registro de importação? As movimentações permanecem.")) return;
    try {
      await del.mutateAsync(id);
      toast.success("Registro removido.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao excluir.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Importações</h1>
          <p className="text-sm text-muted-foreground">
            Importe extratos CSV do Nubank ou OFX. O sistema evita duplicidades e reconhece
            pagamentos de fatura.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} disabled={!wsId || accounts.length === 0}>
          <Upload className="h-4 w-4 mr-2" />
          Importar Arquivo
        </Button>
      </div>

      {accounts.length === 0 && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Cadastre pelo menos uma conta antes de importar.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : imports.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhuma importação ainda.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Arquivo</th>
                    <th className="px-3 py-2">Data</th>
                    <th className="px-3 py-2">Origem</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2 text-right">Importadas</th>
                    <th className="px-3 py-2 text-right">Duplicadas</th>
                    <th className="px-3 py-2 text-right">Ignoradas</th>
                    <th className="px-3 py-2">Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {imports.map((imp: ImportRecord) => (
                    <tr key={imp.id} className="border-t">
                      <td className="px-3 py-2 font-medium">{imp.file_name}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {new Date(imp.imported_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-3 py-2">{IMPORTER_LABELS[imp.source]}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{imp.total_rows}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-600">
                        {imp.imported_rows}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-amber-600">
                        {imp.duplicated_rows}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-red-600">
                        {imp.ignored_rows}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={imp.status} />
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <Button variant="ghost" size="sm" asChild>
                          <Link
                            to="/importacoes/revisao/$importId"
                            params={{ importId: imp.id }}
                          >
                            {imp.reviewed_at ? "Ver revisão" : "Revisar"}
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(imp.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {wsId && (
        <ImportDialog
          open={open}
          onOpenChange={setOpen}
          workspaceId={wsId}
          accounts={accounts}
          userId={user?.id ?? null}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ImportRecord["status"] }) {
  const map: Record<ImportRecord["status"], { label: string; cls: string }> = {
    PENDING: { label: "Pendente", cls: "" },
    PROCESSING: { label: "Processando", cls: "" },
    COMPLETED: { label: "Concluída", cls: "bg-emerald-600 text-white" },
    PARTIAL: { label: "Parcial", cls: "bg-amber-500 text-white" },
    FAILED: { label: "Falhou", cls: "bg-red-600 text-white" },
  };
  const m = map[status];
  return <Badge className={m.cls}>{m.label}</Badge>;
}
