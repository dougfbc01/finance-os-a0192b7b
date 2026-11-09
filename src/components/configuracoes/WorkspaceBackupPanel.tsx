import { useState } from "react";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useWorkspaceBackup, useWorkspaceRestore } from "@/hooks/useWorkspaceBackup";
import { WorkspaceBackupServiceImpl, type WorkspaceBackup } from "@/services/WorkspaceBackupService";
import { WORKSPACE_RESET_TABLE_LABELS, WorkspaceResetServiceImpl } from "@/services/WorkspaceResetService";

interface Props { workspaceId?: string; workspaceName?: string | null }

export function WorkspaceBackupPanel({ workspaceId, workspaceName }: Props) {
  const backup = useWorkspaceBackup();
  const restore = useWorkspaceRestore();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<WorkspaceBackup | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const canConfirm = !!file && WorkspaceResetServiceImpl.canConfirm(typed, workspaceName);

  const handleBackup = async () => {
    if (!workspaceId) return;
    try {
      const b = await backup.mutateAsync({ workspaceId, workspaceName });
      const total = Object.values(b.counts).reduce((s, n) => s + n, 0);
      toast.success(`Backup baixado (${total.toLocaleString("pt-BR")} registros)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar backup");
    }
  };

  const close = () => { setOpen(false); setFile(null); setFileError(null); setTyped(""); };

  const handleFile = async (f: File | undefined) => {
    setFile(null); setFileError(null);
    if (!f) return;
    try { setFile(WorkspaceBackupServiceImpl.parse(await f.text())); }
    catch (e) { setFileError(e instanceof Error ? e.message : "Arquivo inválido"); }
  };

  const handleRestore = async () => {
    if (!workspaceId || !file || !canConfirm) return;
    try {
      await restore.mutateAsync({ workspaceId, backup: file });
      toast.success("Backup restaurado");
      close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao restaurar backup");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Backup dos dados</CardTitle>
        <CardDescription>
          Baixe um arquivo com todas as informações deste workspace ou restaure um backup salvo antes.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={handleBackup} disabled={!workspaceId || backup.isPending}>
          <Download className="mr-2 h-4 w-4" /> {backup.isPending ? "Gerando backup…" : "Baixar backup"}
        </Button>
        <Button variant="outline" onClick={() => setOpen(true)} disabled={!workspaceId}>
          <Upload className="mr-2 h-4 w-4" /> Restaurar backup
        </Button>
      </CardContent>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Restaurar backup</DialogTitle>
            <DialogDescription>
              Todos os dados atuais deste workspace serão substituídos pelos dados do arquivo. Se algo falhar, nada é alterado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1">
            <Label htmlFor="restore-file">Arquivo de backup (.json)</Label>
            <Input id="restore-file" type="file" accept="application/json,.json" onChange={(e) => handleFile(e.target.files?.[0])} />
            {fileError && <p className="text-sm text-destructive">{fileError}</p>}
          </div>

          {file && (
            <div className="rounded-md border text-sm">
              <p className="px-3 py-2 text-muted-foreground">
                Backup de {file.exported_at ? new Date(file.exported_at).toLocaleString("pt-BR") : "data desconhecida"}
              </p>
              <ul className="divide-y border-t">
                {Object.entries(file.tables)
                  .filter(([t]) => WORKSPACE_RESET_TABLE_LABELS[t])
                  .map(([t, rows]) => (
                    <li key={t} className="flex justify-between px-3 py-1.5">
                      <span>{WORKSPACE_RESET_TABLE_LABELS[t]}</span>
                      <span className="tabular-nums">{Array.isArray(rows) ? rows.length : 0}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="restore-confirm">Digite <strong>{workspaceName}</strong> para confirmar</Label>
            <Input id="restore-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={close}>Cancelar</Button>
            <Button variant="destructive" onClick={handleRestore} disabled={!canConfirm || restore.isPending}>
              {restore.isPending ? "Restaurando…" : "Substituir e restaurar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
