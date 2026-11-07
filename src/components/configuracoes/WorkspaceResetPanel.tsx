import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useWorkspaceReset, useWorkspaceResetPreview } from "@/hooks/useWorkspaceReset";
import {
  WORKSPACE_RESET_TABLE_LABELS, WorkspaceResetServiceImpl, type WorkspaceResetMode,
} from "@/services/WorkspaceResetService";

interface Props { workspaceId?: string; workspaceName?: string | null }

export function WorkspaceResetPanel({ workspaceId, workspaceName }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<WorkspaceResetMode>("MOVEMENTS_AND_INVESTMENTS");
  const [typed, setTyped] = useState("");
  const preview = useWorkspaceResetPreview(workspaceId, mode, open);
  const reset = useWorkspaceReset();
  const canConfirm = WorkspaceResetServiceImpl.canConfirm(typed, workspaceName);

  const close = () => { setOpen(false); setTyped(""); };
  const handleConfirm = async () => {
    if (!workspaceId || !canConfirm) return;
    try {
      await reset.mutateAsync({ workspaceId, mode });
      toast.success("Dados do workspace apagados");
      close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao zerar dados");
    }
  };

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-destructive">
          <AlertTriangle className="h-4 w-4" /> Zona de perigo
        </CardTitle>
        <CardDescription>Apaga os dados deste workspace para recomeçar. Ação irreversível.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="destructive" onClick={() => setOpen(true)} disabled={!workspaceId}>
          <Trash2 className="mr-2 h-4 w-4" /> Zerar dados
        </Button>
      </CardContent>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Zerar dados do workspace</DialogTitle>
            <DialogDescription>
              Esta ação é irreversível. Depois será preciso reimportar os arquivos B3 e COTAHIST.
            </DialogDescription>
          </DialogHeader>

          <RadioGroup value={mode} onValueChange={(v) => setMode(v as WorkspaceResetMode)} className="space-y-2">
            <Label className="flex items-start gap-2 font-normal">
              <RadioGroupItem value="MOVEMENTS_AND_INVESTMENTS" className="mt-0.5" />
              <span><strong>Zerar lançamentos e investimentos</strong> — mantém contas, cartões, categorias, regras, metas e planejamento.</span>
            </Label>
            <Label className="flex items-start gap-2 font-normal">
              <RadioGroupItem value="ALL" className="mt-0.5" />
              <span><strong>Zerar tudo</strong> — apaga também contas, cartões, categorias, regras, metas e planejamento.</span>
            </Label>
          </RadioGroup>

          <div className="rounded-md border text-sm">
            {preview.isLoading && <p className="p-3 text-muted-foreground">Contando registros...</p>}
            {preview.error && <p className="p-3 text-destructive">{(preview.error as Error).message}</p>}
            {preview.data && (
              <ul className="divide-y">
                {Object.entries(preview.data).map(([table, count]) => (
                  <li key={table} className="flex justify-between px-3 py-1.5">
                    <span>{WORKSPACE_RESET_TABLE_LABELS[table] ?? table}</span>
                    <span className="tabular-nums">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="reset-confirm">
              Digite <strong>{workspaceName}</strong> para confirmar
            </Label>
            <Input id="reset-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={close}>Cancelar</Button>
            <Button variant="destructive" onClick={handleConfirm} disabled={!canConfirm || reset.isPending}>
              {reset.isPending ? "Apagando..." : "Apagar definitivamente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
