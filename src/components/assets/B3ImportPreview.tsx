import { useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, FileSpreadsheet, Info, Search, Upload } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBuildB3Preview } from "@/hooks/useB3Import";
import { useWorkspace } from "@/hooks/useWorkspace";
import { formatCurrency } from "@/lib/format";
import type { B3Group, B3IdentificationStatus, B3PreviewResult, B3PreviewRow, B3RowStatus } from "@/models/B3Import";

const GROUP_LABELS: Record<B3Group, string> = {
  B3_INCOME: "Rendimento",
  B3_INVESTMENT_OPERATION: "Investimento",
  B3_POSITION_EVENT: "Evento de posição",
  B3_CORPORATE_EVENT: "Evento corporativo",
  B3_TRANSFER: "Transferência",
  B3_UNCLASSIFIED: "Não classificado",
};
const IDENTIFICATION_LABELS: Record<B3IdentificationStatus, string> = {
  FOUND: "Encontrado", NOT_FOUND: "Não encontrado", UNIDENTIFIED: "Não identificado", AMBIGUOUS: "Ambíguo",
};
const STATUS_LABELS: Record<B3RowStatus, string> = {
  VALID: "Válido", REVIEW: "Revisar", INVALID: "Inválido", UNCLASSIFIED: "Não classificado",
};
const IMPACT_LABELS = { YES: "SIM", NO: "NÃO", UNKNOWN: "DESCONHECIDO" } as const;

const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const result = typeof reader.result === "string" ? reader.result : "";
    resolve(result.includes(",") ? result.slice(result.indexOf(",") + 1) : result);
  };
  reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
  reader.readAsDataURL(file);
});

export function B3ImportPreview() {
  const { data: workspace } = useWorkspace();
  const previewMutation = useBuildB3Preview();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<B3PreviewResult | null>(null);
  const [selected, setSelected] = useState<B3PreviewRow | null>(null);
  const [dragging, setDragging] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [groupFilter, setGroupFilter] = useState("ALL");
  const [tickerFilter, setTickerFilter] = useState("ALL");
  const [assetFilter, setAssetFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const processFile = async (file: File) => {
    if (!workspace?.id) return toast.error("Workspace indisponível.");
    if (!file.name.toLowerCase().endsWith(".xlsx")) return toast.error("Selecione o Excel .xlsx exportado pela B3.");
    if (file.size > 12 * 1024 * 1024) return toast.error("O arquivo deve ter no máximo 12 MB.");
    try {
      const result = await previewMutation.mutateAsync({
        workspaceId: workspace.id,
        fileName: file.name,
        fileBase64: await fileToBase64(file),
      });
      setPreview(result);
      toast.success(`${result.totals.total.toLocaleString("pt-BR")} linhas analisadas sem gravar dados.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao analisar o Excel B3.");
    }
  };

  const rows = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("pt-BR");
    return (preview?.rows ?? []).filter((row) => {
      const searchable = [row.product.ticker, row.product.rawProduct, row.product.institution, row.movementType].join(" ").toLocaleLowerCase("pt-BR");
      return (!needle || searchable.includes(needle))
        && (typeFilter === "ALL" || row.movementType === typeFilter)
        && (groupFilter === "ALL" || row.group === groupFilter)
        && (tickerFilter === "ALL" || row.product.ticker === tickerFilter)
        && (assetFilter === "ALL" || row.product.identificationStatus === assetFilter)
        && (statusFilter === "ALL" || row.status === statusFilter)
        && (!from || !!row.date && row.date >= from)
        && (!to || !!row.date && row.date <= to);
    });
  }, [preview, search, typeFilter, groupFilter, tickerFilter, assetFilter, statusFilter, from, to]);

  const types = useMemo(() => [...new Set((preview?.rows ?? []).map((row) => row.movementType))].filter(Boolean).sort(), [preview]);
  const tickers = useMemo(() => [...new Set((preview?.rows ?? []).map((row) => row.product.ticker).filter((ticker): ticker is string => !!ticker))].sort(), [preview]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-3">
            <Link to="/investimentos"><ArrowLeft /> Investimentos</Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Importação B3</h1>
          <p className="text-sm text-muted-foreground">Analise movimentações da B3 antes de qualquer decisão financeira.</p>
        </div>
        <Badge variant="outline" className="gap-2 self-start py-1.5"><Info className="h-3.5 w-3.5" /> Somente preview · nenhum dado será gravado</Badge>
      </div>

      {!preview ? (
        <Card>
          <CardContent className="p-6">
            <div
              className={`flex min-h-64 cursor-pointer flex-col items-center justify-center border-2 border-dashed p-8 text-center transition-colors ${dragging ? "border-primary bg-accent" : "border-border hover:bg-muted/40"}`}
              onClick={() => inputRef.current?.click()}
              onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file) void processFile(file); }}
            >
              <FileSpreadsheet className="h-10 w-10 text-primary" />
              <h2 className="mt-4 text-lg font-semibold">Selecione o Excel exportado da B3</h2>
              <p className="mt-1 max-w-lg text-sm text-muted-foreground">A leitura usa exclusivamente a aba “Movimentação” e valida as oito colunas oficiais.</p>
              <Button className="mt-5" disabled={previewMutation.isPending || !workspace?.id}>
                <Upload /> {previewMutation.isPending ? "Analisando…" : "Escolher arquivo .xlsx"}
              </Button>
              <input ref={inputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void processFile(file); event.target.value = ""; }} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Metric label="Linhas" value={preview.totals.total} />
            <Metric label="Válidas" value={preview.totals.valid} tone="positive" />
            <Metric label="Com alerta" value={preview.totals.warnings} tone="warning" />
            <Metric label="Não classificadas" value={preview.totals.unclassified} tone="danger" />
            <Metric label="Ativos encontrados" value={preview.totals.assetsFound} />
            <Metric label="Não encontrados" value={preview.totals.assetsNotFound} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div><CardTitle>Linhas processadas</CardTitle><p className="mt-1 text-sm text-muted-foreground">{rows.length.toLocaleString("pt-BR")} de {preview.rows.length.toLocaleString("pt-BR")}</p></div>
                <Button variant="outline" onClick={() => setPreview(null)}><Upload /> Outro arquivo</Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  <div className="relative md:col-span-2"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar ticker, produto, instituição ou tipo" className="pl-9" /></div>
                  <Filter value={typeFilter} onChange={setTypeFilter} placeholder="Tipo B3" options={types.map((value) => ({ value, label: value }))} />
                  <Filter value={groupFilter} onChange={setGroupFilter} placeholder="Grupo" options={Object.entries(GROUP_LABELS).map(([value, label]) => ({ value, label }))} />
                  <Filter value={tickerFilter} onChange={setTickerFilter} placeholder="Ticker" options={tickers.map((value) => ({ value, label: value }))} />
                  <Filter value={assetFilter} onChange={setAssetFilter} placeholder="Ativo" options={Object.entries(IDENTIFICATION_LABELS).map(([value, label]) => ({ value, label }))} />
                  <Filter value={statusFilter} onChange={setStatusFilter} placeholder="Status" options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))} />
                  <div className="grid grid-cols-2 gap-2"><Input aria-label="Período inicial" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /><Input aria-label="Período final" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
                </div>
                <div className="max-h-[620px] overflow-auto border">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background"><TableRow>
                      <TableHead>Data</TableHead><TableHead>Produto original</TableHead><TableHead>Ticker</TableHead><TableHead>Instituição</TableHead><TableHead>Movimentação B3</TableHead><TableHead>Grupo interno</TableHead><TableHead>Entrada/Saída</TableHead><TableHead className="text-right">Quantidade</TableHead><TableHead className="text-right">Preço unitário</TableHead><TableHead className="text-right">Valor da Operação</TableHead><TableHead>Ativo encontrado</TableHead><TableHead>Status</TableHead><TableHead>Observação</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>{rows.map((row) => (
                      <TableRow key={row.index} className="cursor-pointer" onClick={() => setSelected(row)}>
                        <TableCell className="whitespace-nowrap tabular-nums">{formatDate(row.date)}</TableCell>
                        <TableCell className="min-w-60 font-medium">{row.product.rawProduct}</TableCell>
                        <TableCell>{row.product.ticker ?? "—"}</TableCell>
                        <TableCell className="min-w-40">{row.product.institution ?? "—"}</TableCell>
                        <TableCell className="min-w-52">{row.movementType || "—"}</TableCell>
                        <TableCell><Badge variant="secondary">{GROUP_LABELS[row.group]}</Badge></TableCell>
                        <TableCell>{row.direction ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(row.quantity)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatOptionalCurrency(row.unitPrice)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatOptionalCurrency(row.operationValue)}</TableCell>
                        <TableCell>{IDENTIFICATION_LABELS[row.product.identificationStatus]}</TableCell>
                        <TableCell><StatusBadge row={row} /></TableCell>
                        <TableCell className="min-w-72 text-muted-foreground">{row.possibleDuplicate ? "Possível duplicidade. " : ""}{row.observation}</TableCell>
                      </TableRow>
                    ))}</TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="h-fit">
              <CardHeader><CardTitle>Tipos de evento</CardTitle></CardHeader>
              <CardContent className="space-y-3">{preview.eventCounts.map((item) => (
                <div key={item.type} className="flex items-center justify-between gap-4 border-b pb-2 text-sm last:border-0"><span>{item.type}</span><strong className="tabular-nums">{item.count.toLocaleString("pt-BR")}</strong></div>
              ))}</CardContent>
            </Card>
          </div>
        </>
      )}

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {selected && <RowDetail row={selected} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Filter({ value, onChange, placeholder, options }: { value: string; onChange: (value: string) => void; placeholder: string; options: Array<{ value: string; label: string }> }) {
  return <Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger><SelectContent><SelectItem value="ALL">{placeholder}: todos</SelectItem>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>;
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "positive" | "warning" | "danger" }) {
  const toneClass = tone === "positive" ? "text-emerald-600" : tone === "warning" ? "text-amber-600" : tone === "danger" ? "text-destructive" : "text-foreground";
  return <div className="border bg-card p-4"><p className="text-xs font-medium uppercase text-muted-foreground">{label}</p><p className={`mt-2 text-2xl font-semibold tabular-nums ${toneClass}`}>{value.toLocaleString("pt-BR")}</p></div>;
}

function StatusBadge({ row }: { row: B3PreviewRow }) {
  const icon = row.status === "VALID" ? <CheckCircle2 /> : <AlertTriangle />;
  return <Badge variant={row.status === "INVALID" ? "destructive" : row.status === "VALID" ? "outline" : "secondary"} className="gap-1 whitespace-nowrap">{icon}{STATUS_LABELS[row.status]}</Badge>;
}

function RowDetail({ row }: { row: B3PreviewRow }) {
  return <>
    <SheetHeader><SheetTitle>{row.product.rawProduct}</SheetTitle><SheetDescription>Linha {row.index + 2} da aba Movimentação</SheetDescription></SheetHeader>
    <div className="mt-6 space-y-6">
      <DetailSection title="Dados da B3" items={[
        ["Movimentação", row.movementType], ["Data", formatDate(row.date)], ["Instituição", row.product.institution ?? "—"], ["Entrada/Saída", row.direction ?? "—"], ["Quantidade", formatNumber(row.quantity)], ["Preço unitário", formatOptionalCurrency(row.unitPrice)], ["Valor", formatOptionalCurrency(row.operationValue)],
      ]} />
      <DetailSection title="Interpretação Finance OS" items={[
        ["Ticker", row.product.ticker ?? "Não identificado"], ["Ativo", row.product.assetName ? `${row.product.assetName} — encontrado` : IDENTIFICATION_LABELS[row.product.identificationStatus]], ["Grupo", row.group], ["Classificação", row.event], ["Impacto em caixa", IMPACT_LABELS[row.cashImpact]], ["Impacto na posição", IMPACT_LABELS[row.positionImpact]], ["Natureza", GROUP_LABELS[row.group]], ["Status", STATUS_LABELS[row.status]],
      ]} />
      <div className="border-l-2 border-primary pl-4"><p className="text-sm font-medium">Por que esta interpretação?</p><p className="mt-1 text-sm text-muted-foreground">{row.observation}</p>{[...row.errors, ...row.warnings].map((message) => <p key={message} className="mt-2 text-sm">• {message}</p>)}</div>
      <p className="text-xs text-muted-foreground">Impactos exibidos são apenas diagnósticos. Nenhuma movimentação, ativo ou posição foi alterada.</p>
    </div>
  </>;
}

function DetailSection({ title, items }: { title: string; items: Array<[string, string]> }) {
  return <section><h3 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">{title}</h3><dl className="grid grid-cols-2 gap-x-4 gap-y-3">{items.map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-0.5 text-sm font-medium">{value}</dd></div>)}</dl></section>;
}

const formatDate = (value: string | null) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "—";
const formatNumber = (value: number | null) => value === null ? "—" : value.toLocaleString("pt-BR", { maximumFractionDigits: 8 });
const formatOptionalCurrency = (value: number | null) => value === null ? "—" : formatCurrency(value);