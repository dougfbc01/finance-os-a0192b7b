import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  ASSET_TYPE_LABELS,
  ASSET_VALUATION_SOURCE_LABELS,
  assetTypeTraits,
  INVESTMENT_OPERATION_LABELS,
} from "@/constants/enums";
import { AssetValuationServiceImpl } from "@/services/AssetValuationService";
import { InvestmentServiceImpl } from "@/services/InvestmentService";
import { formatCurrency } from "@/lib/format";
import { formatDateTime } from "@/lib/format";
import { AssetMarketHistory } from "./AssetMarketHistory";
import type { QuotedAsset } from "@/services/MarketQuotationService";
import type { Asset, Movement } from "@/models";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: (Asset & Partial<QuotedAsset>) | null;
  movements: Movement[];
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export function AssetDetailDialog({ open, onOpenChange, asset, movements }: Props) {
  if (!asset) return null;
  const detail = InvestmentServiceImpl.detail(asset, movements);
  const traits = assetTypeTraits(asset.asset_type);
  const quote = asset.quote ?? null;
  const quoteResult = asset.quoteResult ?? null;
  const costBasis = asset.cost_basis ?? detail.position.cost;
  const marketValue = asset.market_value ?? null;
  const appreciation = asset.appreciation ?? null;
  const appreciationPercent = asset.appreciation_percent ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {asset.name}
            <Badge variant="secondary">{ASSET_TYPE_LABELS[asset.asset_type]}</Badge>
          </DialogTitle>
          <DialogDescription>
            {asset.institution || "Sem instituição"} ·{" "}
            {ASSET_VALUATION_SOURCE_LABELS[asset.valuation_source]}
          </DialogDescription>
        </DialogHeader>

        <div className="divide-y">
          <div className="pb-2">
            {traits.hasTicker && asset.ticker && <Row label="Código" value={asset.ticker} />}
            {traits.hasQuantity && (
              <>
                <Row
                  label="Quantidade"
                  value={Number(asset.quantity).toLocaleString("pt-BR", {
                    maximumFractionDigits: 8,
                  })}
                />
                <Row
                  label="Preço médio"
                  value={formatCurrency(asset.unit_price, asset.currency)}
                />
              </>
            )}
            <Row label="Valor investido" value={formatCurrency(detail.invested, asset.currency)} />
            <Row label="Valor atual" value={formatCurrency(detail.current, asset.currency)} />
            <Row
              label="Rentabilidade"
              value={`${formatCurrency(detail.profit, asset.currency)} (${detail.profitPercent.toFixed(2)}%)`}
            />
          </div>

          <div className="py-2">
            {detail.position.quantity > 0 && (
              <>
                <Row
                  label="Posição (quantidade)"
                  value={detail.position.quantity.toLocaleString("pt-BR", {
                    maximumFractionDigits: 8,
                  })}
                />
                <Row
                  label="Preço médio (operações)"
                  value={formatCurrency(detail.position.averagePrice, asset.currency)}
                />
              </>
            )}
            <Row label="Custo histórico" value={formatCurrency(detail.position.cost, asset.currency)} />
            <Row label="Aportes" value={formatCurrency(detail.contributions, asset.currency)} />
            <Row
              label="— dos quais históricos"
              value={formatCurrency(detail.historicalContributions, asset.currency)}
            />
            <Row label="Resgates" value={formatCurrency(detail.redemptions, asset.currency)} />
            <Row label="Rendimentos" value={formatCurrency(detail.yields, asset.currency)} />
          </div>

          {(quote || quoteResult || asset.quotable) && (
            <div className="py-2">
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Valorização da posição (mercado)
              </p>
              {quote && marketValue !== null ? (
                <>
                  <Row label="Custo histórico" value={formatCurrency(costBasis, asset.currency)} />
                  <Row
                    label="Cotação atual"
                    value={formatCurrency(quote.price, quote.currency || asset.currency)}
                  />
                  <Row label="Valor atual (mercado)" value={formatCurrency(marketValue, asset.currency)} />
                  <div className="flex items-center justify-between py-1 text-sm">
                    <span className="text-muted-foreground">Valorização</span>
                    <span
                      className={`tabular-nums font-medium ${
                        (appreciation ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {(appreciation ?? 0) >= 0 ? "+" : ""}
                      {formatCurrency(appreciation ?? 0, asset.currency)} (
                      {(appreciationPercent ?? 0) >= 0 ? "+" : ""}
                      {(appreciationPercent ?? 0).toFixed(2)}%)
                    </span>
                  </div>
                  <p className="pt-1 text-[11px] text-muted-foreground">
                    Cotação {quote.provider}
                    {quote.quotedAt ? ` · ${formatDateTime(quote.quotedAt)}` : ""}
                    {quote.marketState ? ` · mercado: ${quote.marketState}` : ""}. Valorização da
                    posição (não é rentabilidade completa: sem dividendos, taxas ou impostos).
                  </p>
                </>
              ) : (
                <p className="py-2 text-sm text-muted-foreground">
                  Cotação indisponível
                  {quoteResult?.message ? ` — ${quoteResult.message}` : "."} O valor patrimonial
                  segue a origem declarada do ativo.
                </p>
              )}
            </div>
          )}

          {(quote || quoteResult || asset.quotable) && asset.ticker && (
            <AssetMarketHistory asset={asset} currency={asset.currency} />
          )}

          <div className="pt-2">
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Movimentações relacionadas ({detail.movements.length})
            </p>
            {detail.movements.length === 0 ? (
              <p className="py-3 text-center text-sm text-muted-foreground">
                Nenhuma movimentação vinculada a este ativo.
              </p>
            ) : (
              <ul className="max-h-56 space-y-1 overflow-y-auto">
                {detail.movements.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 text-sm">
                    <span className="w-20 shrink-0 text-xs text-muted-foreground tabular-nums">
                      {m.transaction_date}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{m.description}</span>
                    {m.quantity ? (
                      <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                        {Number(m.quantity).toLocaleString("pt-BR", { maximumFractionDigits: 8 })} un
                      </span>
                    ) : null}
                    <Badge
                      variant={m.is_historical ? "secondary" : "outline"}
                      className="shrink-0 text-[10px]"
                    >
                      {m.is_historical ? "Histórica" : "Atual"}
                    </Badge>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {
                        INVESTMENT_OPERATION_LABELS[
                          AssetValuationServiceImpl.operationOf(m)
                        ]
                      }
                    </Badge>
                    <span className="w-24 shrink-0 text-right tabular-nums">
                      {formatCurrency(m.amount, asset.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
