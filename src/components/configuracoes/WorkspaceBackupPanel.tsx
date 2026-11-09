import { toast } from "sonner";
import { Download } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWorkspaceBackup } from "@/hooks/useWorkspaceBackup";

interface Props { workspaceId?: string; workspaceName?: string | null }

export function WorkspaceBackupPanel({ workspaceId, workspaceName }: Props) {
  const backup = useWorkspaceBackup();
  const handle = async () => {
    if (!workspaceId) return;
    try {
      const b = await backup.mutateAsync({ workspaceId, workspaceName });
      const total = Object.values(b.counts).reduce((s, n) => s + n, 0);
      toast.success(`Backup baixado (${total.toLocaleString("pt-BR")} registros)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar backup");
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Backup dos dados</CardTitle>
        <CardDescription>
          Baixa um arquivo com todas as informações deste workspace: contas, cartões, lançamentos, faturas,
          importações, investimentos, cotações, metas, planejamentos e fechamentos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={handle} disabled={!workspaceId || backup.isPending}>
          <Download className="mr-2 h-4 w-4" /> {backup.isPending ? "Gerando backup…" : "Baixar backup"}
        </Button>
      </CardContent>
    </Card>
  );
}
