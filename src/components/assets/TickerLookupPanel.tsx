// Sprint 4.10 — busca inteligente de ativo por ticker.
// Mostra prévia e só aplica os dados no formulário após confirmação do usuário.
import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ASSET_TYPE_LABELS } from "@/constants/enums";
import { MarketDataService } from "@/services/MarketDataService";
import type { MarketAssetInfo, MarketDataLookupResult } from "@/models/MarketData";
import type { Asset } from "@/models";

interface Props {
  workspaceId: string;
  assets: Asset[];
  /** Ticker atual do formulário. */
  value: string;
  onTickerChange: (ticker: string) => void;
  onApply: (info: MarketAssetInfo) => void;
  onOpenExisting?: (asset: Asset) => void;
}

export function TickerLookupPanel({
  workspaceId,
  assets,
  value,
  onTickerChange,
  onApply,
  onOpenExisting,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MarketDataLookupResult | null>(null);
  const [duplicate, setDuplicate] = useState<Asset | null>(null);

  const search = async () => {
    if (loading || !value.trim()) return;
    setLoading(true);
    setResult(null);
    setDuplicate(null);
    try {
      const existing = MarketDataService.findExistingByTicker(assets, value, workspaceId);
      if (existing) {
        setDuplicate(existing);
        return;
      }
      const res = await MarketDataService.lookup(value);
      setResult(res);
    } finally {
      setLoading(false);
    }
  };

  const info = result?.data ?? null;

  return (
    <div className="md:col-span-2 space-y-2 rounded-lg border border-border bg-muted/30 p-3">
      <Label>Código / Ticker</Label>
      <div className="flex gap-2">
        <Input
          placeholder="Ex.: WEGE3, HGLG11"
          value={value}
          maxLength={20}
          onChange={(e) => onTickerChange(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void search();
            }
          }}
        />
        <Button type="button" variant="secondary" onClick={() => void search()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          <span className="ml-2 hidden sm:inline">Buscar ativo</span>
        </Button>
      </div>

      {duplicate && (
        <div className="space-y-2 rounded-md border border-border bg-background p-3 text-sm">
          <p className="font-medium">Este ativo já está cadastrado.</p>
          <p className="text-muted-foreground">{duplicate.name}</p>
          {onOpenExisting && (
            <Button type="button" size="sm" variant="outline" onClick={() => onOpenExisting(duplicate)}>
              Abrir ativo
            </Button>
          )}
        </div>
      )}

      {result && result.status !== "FOUND" && (
        <p className="text-sm text-muted-foreground">
          {result.message ?? "Ativo não encontrado."} Você pode cadastrar manualmente.
        </p>
      )}

      {info && (
        <div className="space-y-2 rounded-md border border-border bg-background p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{info.ticker}</Badge>
            {info.exchange && <Badge variant="outline">{info.exchange}</Badge>}
            {info.currency && <Badge variant="outline">{info.currency}</Badge>}
            <span className="text-xs text-muted-foreground">via {info.provider}</span>
          </div>
          <p className="font-medium">{info.name}</p>
          <p className="text-muted-foreground">
            Tipo: {info.assetType ? ASSET_TYPE_LABELS[info.assetType] : "não identificado — escolha manualmente"}
          </p>
          <Button type="button" size="sm" onClick={() => onApply(info)}>
            Confirmar dados
          </Button>
        </div>
      )}
    </div>
  );
}
