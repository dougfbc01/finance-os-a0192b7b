import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useB3QuoteHistoryImport } from "@/hooks/useB3QuoteHistoryImport";
import type { QuoteImportTarget } from "@/services/B3QuoteHistoryImportService";

export function B3QuoteHistoryImportDialog({ workspaceId, targets }: { workspaceId: string | undefined; targets: QuoteImportTarget[] }) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const { progress, preview, commit, reset } = useB3QuoteHistoryImport(workspaceId, targets);
  const data = preview.data;
  const close = (v: boolean) => { setOpen(v); if (!v) { reset(); setFiles([]); } };
  return <Dialog open={open} onOpenChange={close}>
    <DialogTrigger asChild><Button variant="outline">Importar histórico B3 (arquivo)</Button></DialogTrigger>
    <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Importar histórico de cotações da B3</DialogTitle>
        <DialogDescription>Baixe manualmente o arquivo anual de cotações históricas (COTAHIST, .zip ou .txt) no site da B3 e envie aqui. O arquivo é lido no seu navegador. Os preços são gravados como publicados, sem ajuste por proventos ou desdobramentos; cotações já salvas nunca são substituídas.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <Input type="file" multiple accept=".zip,.txt" aria-label="Arquivos COTAHIST" onChange={(e) => { setFiles([...(e.target.files ?? [])]); reset(); }} />
        {targets.length === 0 && <p className="text-sm text-muted-foreground">Nenhum ativo com ticker e movimentações para casar.</p>}
        {preview.isPending && <p className="text-sm text-muted-foreground" role="status">Lendo {progress?.file ?? "arquivo"}… {(progress?.lines ?? 0).toLocaleString("pt-BR")} linhas lidas</p>}
        {preview.error && <p className="text-sm text-destructive">Erro ao ler arquivo: {(preview.error as Error).message}</p>}
        {commit.error && <p className="text-sm text-destructive">Erro ao gravar: {(commit.error as Error).message}</p>}
        {commit.data && <p className="text-sm" role="status">Importação concluída: {commit.data.inserted} preços novos gravados · {commit.data.ignored} já existentes ignorados.</p>}
        {data && <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{data.linesRead.toLocaleString("pt-BR")} linhas lidas · pregões de {data.fileFrom ?? "—"} a {data.fileTo ?? "—"} · {data.toInsertCount} preços novos · {data.existingCount} já existentes</p>
          {data.assets.length === 0 ? <p className="text-sm">Nenhum ativo seu foi encontrado no arquivo.</p> :
            <Table><TableHeader><TableRow><TableHead>Ativo</TableHead><TableHead>Meses encontrados</TableHead><TableHead>Já existentes</TableHead><TableHead>Novos</TableHead><TableHead>Meses sem pregão</TableHead></TableRow></TableHeader>
              <TableBody>{data.assets.map((a) => <TableRow key={a.assetId}><TableCell>{a.ticker} <span className="text-muted-foreground">{a.assetName}</span></TableCell><TableCell>{a.found.length}</TableCell><TableCell>{a.existing.length}</TableCell><TableCell>{a.toInsert.length}</TableCell><TableCell className="text-xs">{a.missingMonths.join(", ") || "—"}</TableCell></TableRow>)}</TableBody></Table>}
          {data.absentAssets.length > 0 && <div className="text-sm"><p className="font-medium">Ativos sem registro no arquivo ({data.absentAssets.length})</p><p className="text-muted-foreground">{data.absentAssets.map((a) => `${a.ticker} (${a.assetName})`).join(", ")}</p></div>}
        </div>}
      </div>
      <DialogFooter>
        {!data ? <Button disabled={files.length === 0 || preview.isPending || targets.length === 0} onClick={() => preview.mutate(files)}>{preview.isPending ? "Lendo…" : "Pré-visualizar"}</Button>
          : <Button disabled={data.toInsertCount === 0 || commit.isPending || !!commit.data} onClick={() => commit.mutate()}>{commit.isPending ? "Gravando…" : "Confirmar importação"}</Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
