// Sprint 4.11.1 — diagnóstico da integração de mercado (BRAPI).
// Usa exatamente o fluxo existente: diagnoseMarketFn (server) e
// MarketDataService.getQuotes (cache/dedupe) para o teste em lote.
import { useState } from "react";
import { Activity, CheckCircle2, AlertTriangle, PlugZap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { diagnoseMarketFn } from "@/lib/marketData.functions";
import { MarketDataService } from "@/services/MarketDataService";
import type { MarketQuoteResult } from "@/models/MarketData";

type Diagnosis = Awaited<ReturnType<typeof diagnoseMarketFn>>;

const STATUS_LABEL: Record<string, string> = {
  OK: "Configurado e funcionando",
  NOT_CONFIGURED: "Não configurado",
  INVALID_TOKEN: "Token inválido",
  NOT_FOUND: "Ticker não encontrado",
  TIMEOUT: "Tempo limite excedido",
  UNAVAILABLE: "Indisponível",
};

const QUOTE_LABEL: Record<MarketQuoteResult["status"], string> = {
  FOUND: "OK",
  NOT_FOUND: "ERRO",
  NO_QUOTE: "ERRO",
  ERROR: "ERRO",
  NOT_CONFIGURED: "ERRO",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR");
}

function formatBRL(value: number, currency: string | null): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency ?? "BRL",
  }).format(value);
}

export function MarketIntegrationPanel() {
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [testing, setTesting] = useState(false);

  const [tickersInput, setTickersInput] = useState("WEGE3, PETR4, ABCB4, AGRO3");
  const [batch, setBatch] = useState<MarketQuoteResult[] | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    try {
      setDiagnosis(await diagnoseMarketFn({ data: { ticker: "WEGE3" } }));
    } finally {
      setTesting(false);
    }
  };

  const handleBatch = async () => {
    const tickers = tickersInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (tickers.length === 0) return;
    setBatchLoading(true);
    try {
      MarketDataService.clearQuoteCache();
      const map = await MarketDataService.getQuotes(tickers);
      setBatch(Object.values(map));
    } finally {
      setBatchLoading(false);
    }
  };

  const ok = diagnosis?.status === "OK";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-primary" />
          Integrações — Mercado / BRAPI
        </CardTitle>
        <CardDescription>
          Diagnóstico da consulta de cotações. Nenhuma credencial é exibida: o token fica
          exclusivamente no backend (secret <code>BRAPI_TOKEN</code>).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Provider:</span>
            <span className="font-medium">brapi.dev</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Status:</span>
            {diagnosis ? (
              <Badge variant={ok ? "secondary" : "outline"} className="gap-1">
                {ok ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                ) : (
                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                )}
                {STATUS_LABEL[diagnosis.status] ?? diagnosis.status}
              </Badge>
            ) : (
              <span className="text-muted-foreground">Não verificado</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Última consulta:</span>
            <span>{formatDateTime(diagnosis?.checkedAt ?? null)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Último resultado:</span>
            <span>
              {diagnosis
                ? diagnosis.price !== null
                  ? `${diagnosis.ticker} · ${formatBRL(diagnosis.price, diagnosis.currency)}`
                  : "—"
                : "—"}
            </span>
          </div>
        </div>

        {diagnosis && (
          <p className="rounded-md border p-3 text-sm">
            {diagnosis.message}
            {diagnosis.status === "NOT_CONFIGURED" && (
              <span className="block text-muted-foreground">
                Cadastre o secret <code>BRAPI_TOKEN</code> no backend para habilitar as cotações.
                Sem ele, o cadastro manual e o patrimônio continuam funcionando normalmente.
              </span>
            )}
          </p>
        )}

        <Button onClick={handleTest} disabled={testing}>
          <PlugZap className="mr-2 h-4 w-4" />
          {testing ? "Testando..." : "Testar conexão"}
        </Button>

        <div className="space-y-2 border-t pt-4">
          <Label htmlFor="market-tickers">Teste de múltiplos tickers</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="market-tickers"
              value={tickersInput}
              onChange={(e) => setTickersInput(e.target.value)}
              placeholder="WEGE3, PETR4, ABCB4, AGRO3"
              className="max-w-md"
            />
            <Button variant="outline" onClick={handleBatch} disabled={batchLoading}>
              {batchLoading ? "Consultando..." : "Consultar"}
            </Button>
          </div>

          {batch && (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Ticker</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Cotação</th>
                    <th className="px-3 py-2 font-medium">Mensagem</th>
                  </tr>
                </thead>
                <tbody>
                  {batch.map((r) => (
                    <tr key={r.ticker} className="border-t">
                      <td className="px-3 py-2 font-medium">{r.ticker}</td>
                      <td className="px-3 py-2">
                        <Badge variant={r.status === "FOUND" ? "secondary" : "outline"}>
                          {QUOTE_LABEL[r.status]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        {r.quote ? formatBRL(r.quote.price, r.quote.currency) : "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {r.message ?? "Cotação recebida"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
