// Read-only presentation adapter. Financial calculations remain in the existing services.
import { AssetValuationSource, ASSET_TYPE_LABELS, isMarketQuotableType } from "@/constants/enums";
import type { Asset, Movement } from "@/models";
import type { MarketPricePoint, MarketQuoteMap } from "@/models/MarketData";
import { AssetValuationServiceImpl } from "./AssetValuationService";
import { InvestmentServiceImpl, type InvestmentRow } from "./InvestmentService";
import { MarketQuotationServiceImpl } from "./MarketQuotationService";

export interface InvestmentGroup {
  key: string;
  label: string;
  currency: string;
  count: number;
  invested: number;
  current: number;
  profit: number;
  profitPercent: number;
  economicReturn: number | null;
  unavailableReturns: number;
  participation: number;
}

export const investmentGroupKey = (asset: Asset) => `${asset.asset_type}_${asset.currency}`;

export function summarizeInvestments(rows: InvestmentRow[]): InvestmentGroup[] {
  const grouped = new Map<string, InvestmentRow[]>();
  for (const row of rows) {
    const key = investmentGroupKey(row.asset);
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  return Array.from(grouped, ([key, members]) => {
    const first = members[0];
    if (!first) return null;
    const totals = InvestmentServiceImpl.totals(members.map((r) => r.asset));
    const available = members.filter((r) => r.economicReturn !== null);
    const currencyTotal = rows.filter((r) => r.asset.currency === first.asset.currency)
      .reduce((sum, r) => sum + r.current, 0);
    return {
      key, label: ASSET_TYPE_LABELS[first.asset.asset_type], currency: first.asset.currency,
      ...totals,
      economicReturn: available.length ? Number(available.reduce((sum, r) => sum + (r.economicReturn ?? 0), 0).toFixed(2)) : null,
      unavailableReturns: members.length - available.length,
      participation: currencyTotal > 0 ? (totals.current / currencyTotal) * 100 : 0,
    };
  }).filter((g): g is InvestmentGroup => g !== null).sort((a, b) => b.current - a.current);
}

export interface InvestmentHistoryPoint {
  date: string;
  value: number | null;
  returns: Record<string, number | null>;
  missingAssets: number;
}

/** Rebuild an as-of-date projection; never use a future quote or today's manual valuation. */
export function investmentHistory(params: {
  assets: Asset[];
  movements: Movement[];
  prices: Record<string, MarketPricePoint[]>;
  dates: string[];
}): InvestmentHistoryPoint[] {
  const assets = InvestmentServiceImpl.filterInvestments(params.assets);
  const sortedPrices = new Map(assets.map((a) => [a.id,
    [...(params.prices[a.id] ?? [])].filter((p) => Number.isFinite(p.close) && p.close > 0)
      .sort((a, b) => a.date.localeCompare(b.date)),
  ]));
  return params.dates.map((date) => {
    const movements = params.movements.filter((m) => !m.deleted_at && m.transaction_date <= date);
    const eligible: Asset[] = [];
    const quotes: MarketQuoteMap = {};
    const missing = new Map<string, number>();
    for (const asset of assets) {
      const key = investmentGroupKey(asset);
      if (asset.valuation_source !== AssetValuationSource.MOVEMENTS || Number(asset.opening_value) !== 0) {
        missing.set(key, (missing.get(key) ?? 0) + 1);
        continue;
      }
      const position = AssetValuationServiceImpl.positionOf(asset.id, movements);
      const price = sortedPrices.get(asset.id)?.filter((p) => p.date <= date).at(-1);
      if (isMarketQuotableType(asset.asset_type) && position.quantity > 0 && (!price || !asset.ticker)) {
        missing.set(key, (missing.get(key) ?? 0) + 1);
        continue;
      }
      // Clear static quantities so a fully sold or not-yet-acquired position cannot reappear.
      eligible.push({ ...asset, quantity: 0, unit_price: 0, current_value: 0, acquisition_value: 0 });
      if (price && asset.ticker) {
        const ticker = asset.ticker.trim().toUpperCase();
        quotes[ticker] = { status: "FOUND", ticker, message: null, quote: {
          ticker, price: price.close, currency: asset.currency, quotedAt: `${price.date}T00:00:00Z`,
          change: null, changePercent: null, marketState: null, provider: price.provider,
        } };
      }
    }
    const effective = AssetValuationServiceImpl.effectiveAssets(eligible, movements).map((asset) =>
      isMarketQuotableType(asset.asset_type) && asset.position.quantity === 0
        ? { ...asset, current_value: 0, effective_value: 0, acquisition_value: 0, effective_acquisition: 0 }
        : asset,
    );
    const projected = MarketQuotationServiceImpl.applyQuotes(effective, quotes);
    const rows = InvestmentServiceImpl.rows(projected, movements);
    const groups = summarizeInvestments(rows);
    const returns: Record<string, number | null> = {};
    for (const asset of assets) {
      const key = investmentGroupKey(asset);
      const group = groups.find((g) => g.key === key);
      // Same position profitability used by the current portfolio; no TIR or new return formula.
      returns[key] = missing.has(key) || !group || group.invested <= 0 ? null : group.profitPercent;
    }
    const missingAssets = Array.from(missing.values()).reduce((a, b) => a + b, 0);
    return {
      date, returns, missingAssets,
      value: missingAssets > 0 ? null : Number(rows.reduce((sum, r) => sum + r.current, 0).toFixed(2)),
    };
  });
}