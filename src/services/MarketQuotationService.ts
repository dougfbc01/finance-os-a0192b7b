// MarketQuotationService — Sprint 4.11
// Aplica a COTAÇÃO ATUAL sobre os ativos já valorados pelo AssetValuationService.
//
// Regras:
//  - Só recebe cotação o ativo negociado em mercado (AÇÃO/FII/ETF/BDR) que
//    possua ticker e quantidade > 0.
//  - Ativos ACCOUNT (caixinhas) NUNCA recebem cotação: continuam espelhando
//    o saldo da conta (e continuam fora do total, evitando dupla contagem).
//  - Sem cotação disponível, o ativo mantém exatamente o valor da sua origem
//    (MANUAL / MOVEMENTS). Nada é zerado e nenhum erro vira "cotação zero".
//  - Nada é persistido: nenhuma movimentação, nenhum lançamento, nenhum saldo.
import { BaseService } from "./BaseService";
import type { EffectiveAsset } from "./AssetValuationService";
import { AssetValuationSource, isMarketQuotableType } from "@/constants/enums";
import { normalizeTicker } from "./market/tickerMapping";
import type { MarketQuote, MarketQuoteMap, MarketQuoteResult } from "@/models/MarketData";

export interface QuotedAsset extends EffectiveAsset {
  /** Cotação aplicada (null quando indisponível ou não aplicável). */
  quote: MarketQuote | null;
  /** Resultado bruto da consulta (para mensagens de indisponibilidade). */
  quoteResult: MarketQuoteResult | null;
  /** O ativo é elegível a cotação de mercado. */
  quotable: boolean;
  /** Custo histórico usado como base da valorização. */
  cost_basis: number;
  /** Valor de mercado (quantidade × cotação) quando houver cotação. */
  market_value: number | null;
  /** Valorização da posição em moeda (valor atual − custo histórico). */
  appreciation: number | null;
  /** Valorização da posição em % ((valor atual / custo) − 1) × 100. */
  appreciation_percent: number | null;
}

class MarketQuotationServiceImpl extends BaseService {
  /** O ativo pode receber cotação de mercado? */
  static isQuotable(asset: EffectiveAsset): boolean {
    if (asset.valuation_source === AssetValuationSource.ACCOUNT) return false;
    if (!isMarketQuotableType(asset.asset_type)) return false;
    if (!normalizeTicker(asset.ticker ?? "")) return false;
    return Number(asset.effective_quantity) > 0;
  }

  /** Tickers únicos que precisam de cotação (entrada do refresh). */
  static tickersToQuote(assets: EffectiveAsset[]): string[] {
    const set = new Set<string>();
    for (const a of assets) {
      if (!a.is_active) continue;
      if (!this.isQuotable(a)) continue;
      set.add(normalizeTicker(a.ticker ?? ""));
    }
    return Array.from(set);
  }

  /** Custo histórico da posição (base da valorização). */
  static costBasisOf(asset: EffectiveAsset): number {
    if (
      asset.valuation_source === AssetValuationSource.MOVEMENTS &&
      asset.position.quantity > 0 &&
      asset.position.cost > 0
    ) {
      return asset.position.cost;
    }
    return Number(asset.effective_acquisition) || 0;
  }

  /**
   * Projeta os ativos com o valor de mercado atual quando houver cotação.
   * `current_value`/`effective_value` já saem resolvidos, de modo que
   * PatrimonyService, InvestmentService e os widgets continuam funcionando
   * sem mudar de contrato.
   */
  static applyQuotes(assets: EffectiveAsset[], quotes: MarketQuoteMap = {}): QuotedAsset[] {
    return assets.map((asset) => {
      const quotable = this.isQuotable(asset);
      const ticker = normalizeTicker(asset.ticker ?? "");
      const quoteResult = quotable ? (quotes[ticker] ?? null) : null;
      const quote =
        quoteResult && quoteResult.status === "FOUND" ? quoteResult.quote : null;
      const costBasis = this.costBasisOf(asset);

      const marketValue =
        quote && Number.isFinite(quote.price)
          ? Number((Number(asset.effective_quantity) * quote.price).toFixed(2))
          : null;

      const value = marketValue ?? Number(asset.effective_value) || 0;
      const appreciation = marketValue !== null ? Number((value - costBasis).toFixed(2)) : null;
      const appreciationPercent =
        marketValue !== null && costBasis > 0
          ? Number((((value / costBasis) - 1) * 100).toFixed(2))
          : marketValue !== null
            ? 0
            : null;

      return {
        ...asset,
        current_value: value,
        effective_value: value,
        // Quando há valor de mercado, a base de comparação é o custo histórico.
        acquisition_value: marketValue !== null ? costBasis : asset.acquisition_value,
        effective_acquisition:
          marketValue !== null ? costBasis : asset.effective_acquisition,
        quote,
        quoteResult,
        quotable,
        cost_basis: costBasis,
        market_value: marketValue,
        appreciation,
        appreciation_percent: appreciationPercent,
      };
    });
  }
}

export const MarketQuotationService = new MarketQuotationServiceImpl();
export { MarketQuotationServiceImpl };
