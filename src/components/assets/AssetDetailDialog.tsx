import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  ScrollableDialogBody,
  ScrollableDialogContent,
  ScrollableDialogHeader,
  DialogSection,
} from "@/components/ui/scrollable-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { YieldReconciliationDialog } from "./YieldReconciliationDialog";
import { YieldReconciliationServiceImpl } from "@/services/YieldReconciliationService";
import { MovementFormDialog } from "@/components/movements/MovementFormDialog";
import { useDeleteMovement } from "@/hooks/useMovements";
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
  const [yieldOpen, setYieldOpen] = useState(false);
  const [editing, setEditing] = useState<Movement | null>(null);
  const [deleting, setDeleting] = useState<Movement | null>(null);
  const deleteMut = useDeleteMovement();

  if (!asset) return null;
  const canReconcileYield = YieldReconciliationServiceImpl.isEligible(asset);
  const detail = InvestmentServiceImpl.detail(asset, movements);
  const traits = assetTypeTraits(asset.asset_type);
  const quote = asset.quote ?? null;
  const quoteResult = asset.quoteResult ?? null;
  const costBasis = asset.cost_basis ?? detail.position.cost;
  const marketValue = asset.market_value ?? null;
  const appreciation = asset.appreciation ?? null;
  const appreciationPercent = asset.appreciation_percent ?? null;

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteMut.mutateAsync(deleting.id);
      toast.success("Lançamento excluído. Posição do ativo recalculada.");
      setDeleting(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir lançamento");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ScrollableDialogContent className="max-w-lg">
        <ScrollableDialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {asset.name}
            <Badge variant="secondary">{ASSET_TYPE_LABELS[asset.asset_type]}</Badge>
          </DialogTitle>
          <DialogDescription>
            {asset.institution || "Sem instituição"} ·{" "}
            {ASSET_VALUATION_SOURCE_LABELS[asset.valuation_source]}
          </DialogDescription>
        </ScrollableDialogHeader>

        <ScrollableDialogBody>
          <DialogSection title="Resumo">
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
          </DialogSection>

          <DialogSection title="Posição e custo">
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
          </DialogSection>

          {(quote || quoteResult || asset.quotable) && (
            <DialogSection
              title="Mercado"
              description="Valorização da posição (não é rentabilidade completa)"
            >
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
            </DialogSection>
          )}

          {(quote || quoteResult || asset.quotable) && asset.ticker && (
            <DialogSection title="Histórico de cotações">
              <AssetMarketHistory asset={asset} currency={asset.currency} />
            </DialogSection>
          )}

          <DialogSection
            title={`Movimentações relacionadas (${detail.movements.length})`}
            description="Lançamentos históricos podem ser editados ou excluídos — a posição é recalculada."
          >
            {detail.movements.length === 0 ? (
              <p className="py-3 text-center text-sm text-muted-foreground">
                Nenhuma movimentação vinculada a este ativo.
              </p>
            ) : (
              <ul className="max-h-64 space-y-1 overflow-y-auto overscroll-contain pr-1">
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
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0"
                      aria-label={`Editar ${m.description}`}
                      onClick={() => setEditing(m)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0 text-destructive"
                      aria-label={`Excluir ${m.description}`}
                      onClick={() => setDeleting(m)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </DialogSection>

          {canReconcileYield && (
            <DialogSection title="Conciliação de rendimento">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Confira o saldo real da instituição e registre o rendimento do período.
                </p>
                <Button size="sm" variant="outline" onClick={() => setYieldOpen(true)}>
                  Conferir rendimento
                </Button>
              </div>
            </DialogSection>
          )}
        </ScrollableDialogBody>
      </ScrollableDialogContent>

      {canReconcileYield && (
        <YieldReconciliationDialog
          open={yieldOpen}
          onOpenChange={setYieldOpen}
          asset={asset}
        />
      )}

      <MovementFormDialog
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        workspaceId={asset.workspace_id}
        movement={editing}
      />

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.is_historical
                ? "Este é um lançamento histórico. A posição do ativo (quantidade, preço médio, custo e rentabilidade) será recalculada. O saldo das contas não é afetado."
                : "A posição do ativo será recalculada e o saldo da conta vinculada será atualizado."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleteMut.isPending}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
