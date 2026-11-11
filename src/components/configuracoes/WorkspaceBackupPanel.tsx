import { useState } from "react";
import { toast } from "sonner";
import { Download, Upload, Sparkles, FileText } from "lucide-react";
import { buildBackupReviewPdf } from "@/lib/backupReviewPdf";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useWorkspaceBackup, useWorkspaceRestore, useBackupReview, useBackupQuestion } from "@/hooks/useWorkspaceBackup";
import { WorkspaceBackupServiceImpl, type WorkspaceBackup } from "@/services/WorkspaceBackupService";
import { WORKSPACE_RESET_TABLE_LABELS, WorkspaceResetServiceImpl } from "@/services/WorkspaceResetService";

interface Props { workspaceId?: string; workspaceName?: string | null }

export function WorkspaceBackupPanel({ workspaceId, workspaceName }: Props) {
  const backup = useWorkspaceBackup();
  const restore = useWorkspaceRestore();
  const aiReview = useBackupReview();
  const askAi = useBackupQuestion();
  const [question, setQuestion] = useState("");
  const [qa, setQa] = useState<{ q: string; a: string; error?: boolean }[]>([]);
  const submitQuestion = async () => {
    const q = question.trim();
    if (q.length < 3 || !aiReview.data) return;
    const res = await askAi.mutateAsync({ workspaceId, profile: aiReview.data.profile, question: q, history: qa.filter((x) => !x.error).map(({ q, a }) => ({ q, a })) });
    setQa((prev) => [...prev, res.answer ? { q, a: res.answer } : { q, a: res.error ?? "Erro", error: true }]);
    setQuestion("");
  };
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

  const close = () => { setOpen(false); setFile(null); setFileError(null); setTyped(""); aiReview.reset(); };

  const handleFile = async (f: File | undefined) => {
    setFile(null); setFileError(null); aiReview.reset();
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

          {file && workspaceId && (
            <div className="space-y-2 rounded-md border p-3 text-sm">
              <Button size="sm" variant="secondary" disabled={aiReview.isPending}
                onClick={() => aiReview.mutate({ workspaceId, backup: file })}>
                <Sparkles className="mr-2 h-4 w-4" />
                {aiReview.isPending ? "Analisando…" : "Analisar backup com IA"}
              </Button>
              {aiReview.isError && <p className="text-destructive">{aiReview.error instanceof Error ? aiReview.error.message : "Erro na análise"}</p>}
              {aiReview.data && (
                <div className="space-y-2">
                  {aiReview.data.profile.comparison && aiReview.data.profile.comparison.some((c) => c.delta !== 0) && (
                    <div>
                      <p className="font-medium">Atual × backup</p>
                      <ul className="text-muted-foreground">
                        {aiReview.data.profile.comparison.filter((c) => c.delta !== 0).slice(0, 8).map((c) => (
                          <li key={c.table}>{WORKSPACE_RESET_TABLE_LABELS[c.table] ?? c.table}: {c.current} → {c.backup}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {aiReview.data.profile.issues.length > 0 && (
                    <div>
                      <p className="font-medium">Problemas detectados no arquivo</p>
                      <ul className="list-disc pl-5 text-muted-foreground">
                        {aiReview.data.profile.issues.map((i) => <li key={i}>{i}</li>)}
                      </ul>
                    </div>
                  )}
                  {aiReview.data.error && <p className="text-destructive">{aiReview.data.error}</p>}
                  {aiReview.data.review && (
                    <>
                      <p>{aiReview.data.review.summary}</p>
                      {aiReview.data.review.replacement && <p><strong>O que seria substituído:</strong> {aiReview.data.review.replacement}</p>}
                      {!!aiReview.data.review.differences?.length && (
                        <ul className="list-disc pl-5">{aiReview.data.review.differences.map((d, n) => <li key={n}>{d}</li>)}</ul>
                      )}
                      {aiReview.data.review.inconsistencies.length > 0 && (
                        <ul className="space-y-1">
                          {aiReview.data.review.inconsistencies.map((i, n) => (
                            <li key={n}><span className={i.severity === "alta" ? "font-medium text-destructive" : "font-medium"}>[{i.severity}]</span> {i.description}</li>
                          ))}
                        </ul>
                      )}
                      <p className="text-muted-foreground"><strong>Recomendação:</strong> {aiReview.data.review.recommendation}</p>
                      <Button size="sm" variant="outline" onClick={async () => {
                        const d = aiReview.data!;
                        const blob = await buildBackupReviewPdf({ workspaceName, profile: d.profile, review: d.review, labels: WORKSPACE_RESET_TABLE_LABELS });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url; a.download = `analise-backup-${new Date().toISOString().slice(0, 10)}.pdf`;
                        document.body.appendChild(a); a.click(); a.remove();
                        setTimeout(() => URL.revokeObjectURL(url), 30_000);
                      }}>
                        <FileText className="mr-2 h-4 w-4" /> Baixar relatório em PDF
                      </Button>
                      <div className="space-y-2 border-t pt-2">
                        <p className="font-medium">Pergunte sobre este backup</p>
                        {qa.map((x, n) => (
                          <div key={n} className="space-y-0.5">
                            <p className="text-muted-foreground">Você: {x.q}</p>
                            <p className={x.error ? "text-destructive" : "whitespace-pre-wrap"}>{x.a}</p>
                          </div>
                        ))}
                        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void submitQuestion(); }}>
                          <Input value={question} maxLength={500} onChange={(e) => setQuestion(e.target.value)} placeholder="Ex.: vou perder lançamentos de 2025?" disabled={askAi.isPending} />
                          <Button type="submit" size="sm" disabled={askAi.isPending || question.trim().length < 3}>{askAi.isPending ? "..." : "Perguntar"}</Button>
                        </form>
                        <p className="text-xs text-muted-foreground">A IA só vê contagens, datas e diferenças; não vê valores nem lançamentos.</p>
                      </div>
                      <p className="text-xs text-muted-foreground">Análise gerada por IA a partir de um resumo do arquivo; confira antes de restaurar.</p>
                    </>
                  )}
                </div>
              )}
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
