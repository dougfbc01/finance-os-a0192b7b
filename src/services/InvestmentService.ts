// InvestmentService — Filtragem e métricas de ativos de investimento.
// Regra: apenas ativos classificados como classes de investimento
// (renda fixa, ações, fundos, cripto, previdência, FIIs, ETFs, BDRs, etc.).
import { BaseService } from "./BaseService";
import { AssetServiceImpl } from "./AssetService";
import { AssetValuationServiceImpl } from "./AssetValuationService";
import type { AssetPosition } from "./AssetValuationService";
import {
  AssetValuationSource,
  INVESTMENT_ASSET_TYPES,
  InvestmentOperation,
} from "@/constants/enums";
import type { QuotedAsset } from "./MarketQuotationService";
import type { Asset, Movement } from "@/models";

export interface InvestmentRow {
  asset: Asset;
  invested: number; // valor de aquisição
  current: number; // valor atual
  profit: number;
  profitPercent: number;
}

export interface AssetDetail {
  asset: Asset;
  /** Movimentações vinculadas ao ativo (mais recentes primeiro). */
  movements: Movement[];
  /** Total aplicado no ativo. */
  contributions: number;
  /** Total resgatado do ativo. */
  redemptions: number;
  /** Rendimentos que aumentaram o valor patrimonial (sem entrada em conta). */
  yields: number;
  /** Total aplicado por operações históricas (não passou pelo caixa). */
  historicalContributions: number;
  /** Total aplicado por operações financeiras atuais. */
  currentContributions: number;
  /** Posição reconstruída (quantidade, custo, preço médio). */
  position: AssetPosition;
  invested: number;
  current: number;
  profit: number;
  profitPercent: number;
}

export interface InvestmentPositionSummary {
  quantity: number;
  historicalCost: number;
  averagePrice: number;
  quote: number | null;
  quoteCurrency: string;
  marketValue: number | null;
  result: number | null;
  resultPercent: number | null;
  investedCapital: number;
  realizedValue: number;
  realizedResult: number;
  incomeReceived: number;
  economicReturn: number | null;
  economicReturnPercent: number | null;
}

class InvestmentServiceImpl extends BaseService {
  /**
   * Resumo estritamente derivado da posição reconstruída e da cotação existente.
   * Ativos ACCOUNT não representam uma posição cotada e nunca entram neste cálculo.
   */
  static positionSummary(
    asset: Asset & Partial<QuotedAsset>,
    movements: Movement[] = [],
  ): InvestmentPositionSummary | null {
    if (asset.valuation_source !== AssetValuationSource.MOVEMENTS) return null;

    const position = AssetValuationServiceImpl.positionOf(asset.id, movements);
    const quotePrice = Number(asset.quote?.price);
    const hasPosition = position.quantity > 0 && position.cost > 0;
    const hasQuote = !!asset.quote && Number.isFinite(quotePrice) && quotePrice > 0;
    const canCalculate = hasPosition && hasQuote;
    const marketValue = canCalculate
      ? Number((position.quantity * quotePrice).toFixed(2))
      : null;
    const result = marketValue === null ? null : Number((marketValue - position.cost).toFixed(2));
    const resultPercent =
      result === null
        ? null
        : Number(((result / position.cost) * 100).toFixed(2));
    const canCalculateEconomicReturn = position.quantity === 0 || marketValue !== null;
    // Rendimento distribuído continua sendo retorno econômico mesmo quando
    // já foi conciliado com uma conta. Nesse caso o account_id impede que ele
    // aumente o valor patrimonial do ativo, mas não deve apagar o rendimento
    // do retorno total do investimento.
    const incomeReceived = movements
      .filter((m) => m.asset_id === asset.id && !m.deleted_at)
      .reduce((total, m) => {
        return AssetValuationServiceImpl.operationOf(m) === InvestmentOperation.RENDIMENTO
          ? total + Math.abs(Number(m.amount) || 0)
          : total;
      }, 0);
    const economicReturn = canCalculateEconomicReturn
      ? Number(((marketValue ?? 0) + position.realizedValue + incomeReceived - position.investedCapital).toFixed(2))
      : null;
    const economicReturnPercent = economicReturn === null || position.investedCapital <= 0
      ? null
      : Number(((economicReturn / position.investedCapital) * 100).toFixed(2));

    return {
      quantity: position.quantity,
      historicalCost: position.cost,
      averagePrice: position.averagePrice,
      quote: hasQuote ? quotePrice : null,
      quoteCurrency: asset.quote?.currency || asset.currency,
      marketValue,
      result,
      resultPercent,
      investedCapital: position.investedCapital,
      realizedValue: position.realizedValue,
      realizedResult: position.realizedResult,
      incomeReceived: Number(incomeReceived.toFixed(2)),
      economicReturn,
      economicReturnPercent,
    };
  }

  /**
   * Sprint 4.6 — detalhe de um ativo para o drill-down patrimonial.
   * Não recalcula patrimônio: consome os valores já resolvidos pelo
   * AssetValuationService e apenas classifica as movimentações vinculadas.
   */
  static detail(asset: Asset, movements: Movement[] = []): AssetDetail {
    const related = movements
      .filter((m) => m.asset_id === asset.id && !m.deleted_at)
      .sort((a, b) => (a.transaction_date < b.transaction_date ? 1 : -1));

    let contributions = 0;
    let redemptions = 0;
    let yieldsTotal = 0;
    let historicalContributions = 0;
    let currentContributions = 0;
    for (const m of related) {
      const op = AssetValuationServiceImpl.operationOf(m);
      const delta = AssetValuationServiceImpl.deltaForAsset(m);
      if (op === InvestmentOperation.APORTE) {
        contributions += Math.abs(delta);
        if (m.is_historical) historicalContributions += Math.abs(delta);
        else currentContributions += Math.abs(delta);
      }
      else if (op === InvestmentOperation.RESGATE) redemptions += Math.abs(delta);
      else if (op === InvestmentOperation.RENDIMENTO) yieldsTotal += delta;
    }

    const invested = Number(asset.acquisition_value) || 0;
    const current = Number(asset.current_value) || 0;
    return {
      asset,
      movements: related,
      contributions,
      historicalContributions,
      currentContributions,
      position: AssetValuationServiceImpl.positionOf(asset.id, movements),
      redemptions,
      yields: yieldsTotal,
      invested,
      current,
      profit: AssetServiceImpl.profit(asset),
      profitPercent: AssetServiceImpl.profitPercent(asset),
    };
  }

  static filterInvestments(assets: Asset[]): Asset[] {
    return assets.filter(
      (a) =>
        a.is_active &&
        INVESTMENT_ASSET_TYPES.includes(a.asset_type) &&
        AssetValuationServiceImpl.countsInTotal(a),
    );
  }

  static rows(assets: Asset[]): InvestmentRow[] {
    return this.filterInvestments(assets).map((asset) => ({
      asset,
      invested: Number(asset.acquisition_value),
      current: Number(asset.current_value),
      profit: AssetServiceImpl.profit(asset),
      profitPercent: AssetServiceImpl.profitPercent(asset),
    }));
  }

  static totals(assets: Asset[]) {
    const rows = this.rows(assets);
    const invested = rows.reduce((s, r) => s + r.invested, 0);
    const current = rows.reduce((s, r) => s + r.current, 0);
    const profit = current - invested;
    const profitPercent = invested > 0 ? (profit / invested) * 100 : 0;
    return { invested, current, profit, profitPercent, count: rows.length };
  }
}

export const InvestmentService = new InvestmentServiceImpl();
export { InvestmentServiceImpl };
