import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Upload, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency } from "@/lib/format";
import { IMPORTER_OPTIONS, ImporterFactory } from "@/services/importers/ImporterFactory";
import { useBuildImportPreview, useCommitImport } from "@/hooks/useImports";
import { useCards } from "@/hooks/useCards";
import type { Account, UUID } from "@/models";
import type { ImportSource } from "@/models/Import";
import type { PreviewResult } from "@/services/importers/types";
import { MOVEMENT_TYPE_LABELS } from "@/constants/enums";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: UUID;
  accounts: Account[];
  /** @deprecated Sprint 3.4: importação não aplica categoria padrão. */
  defaultCategoryId?: UUID | null;
  /** @deprecated Sprint 3.4: importação não aplica categoria padrão. */
  defaultSubcategoryId?: UUID | null;
  userId: UUID | null;
}

type Step = "select" | "preview" | "done";

export function ImportDialog({
  open,
  onOpenChange,
  workspaceId,
  accounts,
  userId,
}: ImportDialogProps) {
  const [step, setStep] = useState<Step>("select");
  const [source, setSource] = useState<ImportSource>("NUBANK_ACCOUNT");
  const [accountId, setAccountId] = useState<string>("");
  const [cardId, setCardId] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [fileText, setFileText] = useState<string>("");
  const [preview, setPreview] = useState<
    (PreviewResult & { existingImport: unknown | null }) | null
  >(null);
  const [reimport, setReimport] = useState(false);

  const buildPreview = useBuildImportPreview();
  const commit = useCommitImport();
  const { data: cards = [] } = useCards(workspaceId);
  const isCardSource = source === "NUBANK_CREDIT_CARD";

  const reset = () => {
    setStep("select");
    setFileName("");
    setFileText("");
    setPreview(null);
    setAccountId("");
    setCardId("");
    setReimport(false);
  };

  const handleFile = async (f: File) => {
    const text = await f.text();
    setFileName(f.name);
    setFileText(text);
    setSource(ImporterFactory.suggest(f.name, text));
  };

  const handleGeneratePreview = async () => {
    if (!fileText) {
      toast.error("Selecione um arquivo.");
      return;
    }
    if (isCardSource) {
      if (!cardId) {
        toast.error("Selecione o cartão.");
        return;
      }
    } else if (!accountId) {
      toast.error("Selecione a conta destino.");
      return;
    }
    try {
      const p = await buildPreview.mutateAsync({
        source,
        fileName,
        fileText,
        workspaceId,
        accountId: isCardSource ? null : accountId,
        cardId: isCardSource ? cardId : null,
        accounts,
        // Sprint 3.4: linhas nascem "Sem categoria"; classificação vem só das regras.
        defaults: { categoryId: null, subcategoryId: null },
      });
      if (p.existingImport && !reimport) {
        toast.warning('Este arquivo já foi importado antes. Marque "Reimportar" para continuar.');
      }
      setPreview(p);
      setStep("preview");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar preview");
    }
  };

  const handleCommit = async () => {
    if (!preview) return;
    try {
      const res = await commit.mutateAsync({
        preview,
        workspaceId,
        accountId: isCardSource ? null : accountId,
        cardId: isCardSource ? cardId : null,
        importedBy: userId,
      });
      const extra = res.autoReconciled
        ? ` · ${res.autoReconciled} transferência(s) conciliada(s).`
        : "";
      toast.success(
        `Importação concluída — ${res.inserted} novas, ${res.duplicated} duplicadas, ${res.ignored} ignoradas.${extra}`,
      );
      setStep("done");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao importar");
    }
  };

  const previewRows = useMemo(() => preview?.rows ?? [], [preview]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar Arquivo</DialogTitle>
          <DialogDescription>
            Suporte a CSV Nubank (conta e cartão) e OFX. Duplicidades são detectadas
            automaticamente.
          </DialogDescription>
        </DialogHeader>

        {step === "select" && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/40 transition"
              onDragOver={(e) => e.preventDefault()}
              onDrop={async (e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) await handleFile(f);
              }}
              onClick={() => document.getElementById("import-file-input")?.click()}
            >
              <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm">
                {fileName ? (
                  <>
                    <b>{fileName}</b> pronto — clique em Preview.
                  </>
                ) : (
                  "Arraste um arquivo ou clique para selecionar."
                )}
              </p>
              <input
                id="import-file-input"
                type="file"
                accept=".csv,.ofx,.txt"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) await handleFile(f);
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Origem</Label>
                <Select value={source} onValueChange={(v) => setSource(v as ImportSource)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IMPORTER_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{isCardSource ? "Cartão" : "Conta destino"}</Label>
                {isCardSource ? (
                  <Select value={cardId} onValueChange={setCardId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cartão" />
                    </SelectTrigger>
                    <SelectContent>
                      {cards
                        .filter((c) => c.is_active)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a conta" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts
                        .filter((a) => a.is_active)
                        .map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={reimport}
                onChange={(e) => setReimport(e.target.checked)}
              />
              Reimportar mesmo se o arquivo já tiver sido processado antes
            </label>

            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleGeneratePreview} disabled={buildPreview.isPending}>
                {buildPreview.isPending ? "Analisando…" : "Gerar Preview"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "preview" && preview && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
              <Stat label="Total" value={preview.totals.total} />
              <Stat label="Válidos" value={preview.totals.valid} tone="positive" />
              <Stat label="Duplicados" value={preview.totals.duplicated} tone="warn" />
              <Stat label="Inválidos" value={preview.totals.invalid} tone="danger" />
              <Stat label="Receitas" value={preview.totals.incomes} />
              <Stat label="Despesas" value={preview.totals.expenses} />
            </div>
            {preview.existingImport ? (
              <div className="flex items-center gap-2 text-amber-600 text-sm">
                <RefreshCw className="h-4 w-4" />
                Arquivo já importado anteriormente — apenas registros novos serão gravados.
              </div>
            ) : null}
            <ScrollArea className="h-72 border rounded">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/60">
                  <tr>
                    <th className="text-left px-2 py-1">Data</th>
                    <th className="text-left px-2 py-1">Descrição</th>
                    <th className="text-right px-2 py-1">Valor</th>
                    <th className="text-left px-2 py-1">Tipo</th>
                    <th className="text-left px-2 py-1">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r) => (
                    <tr key={r.index} className="border-t">
                      <td className="px-2 py-1 tabular-nums">{r.transaction_date}</td>
                      <td className="px-2 py-1">{r.description}</td>
                      <td className="px-2 py-1 text-right tabular-nums">
                        {formatCurrency(r.amount)}
                      </td>
                      <td className="px-2 py-1">{MOVEMENT_TYPE_LABELS[r.type]}</td>
                      <td className="px-2 py-1">
                        {r.isInvalid ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Inválido
                          </Badge>
                        ) : r.isDuplicate ? (
                          <Badge variant="secondary">Duplicado</Badge>
                        ) : r.isCardPayment ? (
                          <Badge>Pgto Fatura</Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            OK
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep("select")}>
                Voltar
              </Button>
              <Button onClick={handleCommit} disabled={commit.isPending}>
                {commit.isPending ? "Importando…" : `Confirmar (${preview.totals.valid})`}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "done" && (
          <div className="text-center py-6 space-y-3">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
            <p>Importação concluída com sucesso.</p>
            <DialogFooter className="justify-center gap-2">
              <Button variant="outline" onClick={reset}>
                Importar outro arquivo
              </Button>
              <Button onClick={() => onOpenChange(false)}>Fechar</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "positive" | "warn" | "danger";
}) {
  const cls =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "warn"
        ? "text-amber-600"
        : tone === "danger"
          ? "text-red-600"
          : "";
  return (
    <div className="rounded border p-2">
      <div className="text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}
