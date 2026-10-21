// Read-only presentation adapter. Financial calculations remain in the existing services.
import { AssetValuationSource, ASSET_TYPE_LABELS, InvestmentOperation, isMarketQuotableType } from "@/constants/enums";
import type { Asset, Movement } from "@/models";
import type { MarketPricePoint, MarketQuoteMap } from "@/models/MarketData";
import { AssetValuationServiceImpl } from "./AssetValuationService";
import { InvestmentServiceImpl, type InvestmentRow } from "./InvestmentService";
import { MarketQuotationServiceImpl } from "./MarketQuotationService";
import { validInvestmentRange } from "./InvestmentViewService";

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
  accumulatedIncome: number;
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
      accumulatedIncome: Number(members.reduce((sum, r) => sum + r.accumulatedIncome, 0).toFixed(2)),
      participation: currencyTotal > 0 ? (totals.current / currencyTotal) * 100 : 0,
    };
  }).filter((g): g is InvestmentGroup => g !== null).sort((a, b) => b.current - a.current);
}

export interface InvestmentHistoryPoint {
  date: string;
  /** Complete portfolio value; null whenever any asset lacks evidence on this date. */
  value: number | null;
  valuesByGroup?: Record<string, number | null>;
  /** Sum of only the positions valued with evidence; never presented as the full portfolio. */
  calculableValue?: number | null;
  calculableByGroup?: Record<string, number | null>;
  missingByGroup?: Record<string, number>;
  returns: Record<string, number | null>;
  missingAssets: number;
  limitations: { assetId: string; name: string; reason: "NO_HISTORY" | "NO_PRICE" | "NO_VALUATION" | "UNKNOWN_COST" }[];
  carriedPrices: { assetId: string; priceDate: string }[];
  /** Evidenced rows, reused by the monthly projection without new financial formulas. */
  assetRows?: InvestmentRow[];
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
    const unknownCost = new Set<string>();
    const limitations: InvestmentHistoryPoint["limitations"] = [];
    const carriedPrices: InvestmentHistoryPoint["carriedPrices"] = [];
    for (const asset of assets) {
      const key = investmentGroupKey(asset);
      const positionEvents = params.movements.filter((m) => !m.deleted_at &&
        (m.asset_id === asset.id || (m.tags ?? []).includes(`cost:SOURCE:${asset.id}`)) &&
        [InvestmentOperation.APORTE, InvestmentOperation.RESGATE, InvestmentOperation.AJUSTE_QUANTIDADE].includes(AssetValuationServiceImpl.operationOf(m)));
      const pastEvents = positionEvents.filter((m) => m.transaction_date <= date);
      const incompleteQuantity = pastEvents.some((m) => m.asset_id === asset.id &&
        [InvestmentOperation.APORTE, InvestmentOperation.RESGATE].includes(AssetValuationServiceImpl.operationOf(m)) &&
        (m.quantity == null || !Number.isFinite(Number(m.quantity)) || Number(m.quantity) <= 0));
      const firstEvent = [...pastEvents].sort((a, b) => a.transaction_date.localeCompare(b.transaction_date) || a.id.localeCompare(b.id))[0];
      const missingOpeningPosition = firstEvent && (firstEvent.asset_id !== asset.id ||
        AssetValuationServiceImpl.operationOf(firstEvent) === InvestmentOperation.RESGATE ||
        (firstEvent.tags ?? []).includes("qty:DECREASE"));
      if (asset.valuation_source !== AssetValuationSource.MOVEMENTS || Number(asset.opening_value) !== 0) {
        missing.set(key, (missing.get(key) ?? 0) + 1);
        limitations.push({ assetId: asset.id, name: asset.name, reason: "NO_HISTORY" });
        continue;
      }
      if (incompleteQuantity || missingOpeningPosition || (positionEvents.length === 0 && (Number(asset.quantity) > 0 || Number(asset.acquisition_value) > 0 || Number(asset.current_value) > 0))) {
        missing.set(key, (missing.get(key) ?? 0) + 1);
        limitations.push({ assetId: asset.id, name: asset.name, reason: "NO_HISTORY" });
        continue;
      }
      const position = AssetValuationServiceImpl.positionOf(asset.id, movements);
      const price = sortedPrices.get(asset.id)?.filter((p) => p.date <= date).at(-1);
      // Contribution cost is not evidence of historical fair value for unquoted assets.
      if (!isMarketQuotableType(asset.asset_type) && (position.quantity > 0 || position.cost > 0)) {
        missing.set(key, (missing.get(key) ?? 0) + 1);
        limitations.push({ assetId: asset.id, name: asset.name, reason: "NO_VALUATION" });
        continue;
      }
      if (isMarketQuotableType(asset.asset_type) && position.quantity > 0 && (!price || !asset.ticker)) {
        missing.set(key, (missing.get(key) ?? 0) + 1);
        limitations.push({ assetId: asset.id, name: asset.name, reason: "NO_PRICE" });
        continue;
      }
      if (position.quantity > 0 && (position.cost <= 0 || movements.some((m) => m.asset_id === asset.id && (m.tags ?? []).includes("cost:INDETERMINATE")))) {
        unknownCost.add(key);
        limitations.push({ assetId: asset.id, name: asset.name, reason: "UNKNOWN_COST" });
      }
      // Clear static quantities so a fully sold or not-yet-acquired position cannot reappear.
      eligible.push({ ...asset, quantity: 0, unit_price: 0, current_value: 0, acquisition_value: 0 });
      if (price && asset.ticker) {
        if (position.quantity > 0 && price.date < date) carriedPrices.push({ assetId: asset.id, priceDate: price.date });
        const ticker = asset.ticker.trim().toUpperCase();
        quotes[ticker] = { status: "FOUND", ticker, message: null, quote: {
          ticker, price: price.close, currency: asset.currency, quotedAt: `${price.date}T00:00:00Z`,
          change: null, changePercent: null, marketState: null, provider: price.provider,
        } };
      }
    }
    const effective = AssetValuationServiceImpl.effectiveAssets(eligible, movements).map((asset) =>
      // A closed position holds no wealth; a redemption gain must not appear as negative patrimony.
      (isMarketQuotableType(asset.asset_type) ? asset.position.quantity === 0 : asset.position.quantity <= 0 && asset.position.cost <= 0)
        ? { ...asset, current_value: 0, effective_value: 0, acquisition_value: 0, effective_acquisition: 0 }
        : asset,
    );
    // Quote maps are keyed by ticker, but stored histories belong to individual assets.
    const projected = effective.flatMap((asset) => {
      const price = sortedPrices.get(asset.id)?.filter((p) => p.date <= date).at(-1);
      const ticker = asset.ticker?.trim().toUpperCase();
      const result = ticker ? quotes[ticker] : undefined;
      const ownQuotes: MarketQuoteMap = ticker && price && result?.quote
        ? { [ticker]: { ...result, quote: { ...result.quote, price: price.close, quotedAt: `${price.date}T00:00:00Z` } } }
        : {};
      return MarketQuotationServiceImpl.applyQuotes([asset], ownQuotes);
    });
    const rows = InvestmentServiceImpl.rows(projected, movements);
    const groups = summarizeInvestments(rows);
    const held = new Set(effective.filter((a) => a.position.quantity > 0 || Number(a.effective_value) > 0).map((a) => investmentGroupKey(a)));
    const returns: Record<string, number | null> = {};
    const valuesByGroup: Record<string, number | null> = {};
    const calculableByGroup: Record<string, number | null> = {};
    const missingByGroup: Record<string, number> = Object.fromEntries(missing);
    for (const asset of assets) {
      const key = investmentGroupKey(asset);
      const group = groups.find((g) => g.key === key);
      // Same position profitability used by the current portfolio; no TIR or new return formula.
      returns[key] = missing.has(key) || unknownCost.has(key) || !group || group.invested <= 0 ? null : group.profitPercent;
      valuesByGroup[key] = missing.has(key) ? null : group?.current ?? 0;
      // A group whose only held positions lack evidence has no calculable value, not zero.
      calculableByGroup[key] = missing.has(key) && !held.has(key) ? null : Number((group?.current ?? 0).toFixed(2));
    }
    const missingAssets = Array.from(missing.values()).reduce((a, b) => a + b, 0);
    const mixedCurrency = new Set(assets.map((a) => a.currency)).size > 1;
    const calculableTotal = Number(rows.reduce((sum, r) => sum + r.current, 0).toFixed(2));
    return {
      date, returns, valuesByGroup, calculableByGroup, missingByGroup, missingAssets, limitations, carriedPrices, assetRows: rows,
      value: missingAssets > 0 || mixedCurrency ? null : calculableTotal,
      calculableValue: mixedCurrency || (missingAssets > 0 && held.size === 0) ? null : calculableTotal,
    };
  });
}

export type MonthlyPositionStatus = "OK" | "STALE_PRICE" | "CLOSED" | "NO_PRICE" | "NO_HISTORY" | "NO_VALUATION";
export interface InvestmentMonthlyRow {
  assetId: string;
  name: string;
  ticker: string | null;
  month: string;
  referenceDate: string;
  quantity: number | null;
  unitQuote: number | null;
  quoteDate: string | null;
  totalValue: number | null;
  status: MonthlyPositionStatus;
  currency: string;
  group: string;
  /** The existing services' projection, not a second financial calculation. */
  projection: InvestmentHistoryPoint;
}

/** Read-only monthly ledger. A stored session is evidence, not an inferred exchange calendar. */
export function investmentMonthlyBase(params: {
  assets: Asset[]; movements: Movement[]; prices: Record<string, MarketPricePoint[]>; from: string; to: string;
}): InvestmentMonthlyRow[] {
  if (!validInvestmentRange(params.from, params.to, params.to)) return [];
  const result: InvestmentMonthlyRow[] = [];
  for (const asset of InvestmentServiceImpl.filterInvestments(params.assets).filter((a) => !a.deleted_at)) {
    const related = params.movements.filter((m) => !m.deleted_at &&
      (m.asset_id === asset.id || (m.tags ?? []).includes(`cost:SOURCE:${asset.id}`)));
    const first = related.map((m) => m.transaction_date).sort()[0];
    // With no movement, the start is unknown; retain a visible limitation in the requested range.
    const start = first ?? params.from;
    if (!validInvestmentRange(start, params.to, params.to)) continue;
    const prices = [...(params.prices[asset.id] ?? [])].filter((p) =>
      validInvestmentRange(p.date, p.date, params.to) && Number.isFinite(p.close) && p.close > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
    const cursor = new Date(`${start.slice(0, 7)}-01T00:00:00Z`);
    while (cursor.toISOString().slice(0, 10) <= params.to) {
      const month = cursor.toISOString().slice(0, 7);
      const session = prices.find((p) => p.date.slice(0, 7) === month);
      const fallback = new Date(cursor);
      while ([0, 6].includes(fallback.getUTCDay())) fallback.setUTCDate(fallback.getUTCDate() + 1);
      // No recorded session: a weekday reference carries only an earlier quote, never a future one.
      const referenceDate = session?.date ?? fallback.toISOString().slice(0, 10);
      if (referenceDate <= params.to) {
        const projection = investmentHistory({ assets: [asset], movements: params.movements,
          prices: { [asset.id]: prices }, dates: [referenceDate] })[0];
        if (projection) {
          const noHistory = !first || projection.limitations.some((l) => l.reason === "NO_HISTORY");
          const quantity = noHistory ? null : AssetValuationServiceImpl.positionOf(asset.id,
            params.movements.filter((m) => !m.deleted_at && m.transaction_date <= referenceDate)).quantity;
          const quote = prices.filter((p) => p.date <= referenceDate).at(-1);
          const missingValuation = projection.limitations.some((l) => l.reason === "NO_VALUATION");
          const status: MonthlyPositionStatus = noHistory ? "NO_HISTORY" : missingValuation ? "NO_VALUATION"
            : quantity === 0 ? "CLOSED" : !quote || !asset.ticker ? "NO_PRICE"
            : quote.date.slice(0, 7) !== month ? "STALE_PRICE" : "OK";
          // Even an empty cadastro without events cannot establish a historical zero position.
          if (!first && !projection.limitations.some((l) => l.reason === "NO_HISTORY")) {
            projection.limitations.push({ assetId: asset.id, name: asset.name, reason: "NO_HISTORY" });
            projection.assetRows = [];
          }
          result.push({ assetId: asset.id, name: asset.name, ticker: asset.ticker, month, referenceDate,
            quantity, unitQuote: quote && asset.ticker && isMarketQuotableType(asset.asset_type) ? quote.close : null,
            quoteDate: quote && asset.ticker && isMarketQuotableType(asset.asset_type) ? quote.date : null,
            totalValue: noHistory ? null : projection.value, status, currency: asset.currency,
            group: investmentGroupKey(asset), projection });
        }
      }
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }
  return result.sort((a, b) => a.month.localeCompare(b.month) || a.name.localeCompare(b.name) || a.assetId.localeCompare(b.assetId));
}

/** Charts consume the monthly ledger; aggregation still uses the existing investment totals. */
export function monthlyInvestmentHistory(base: InvestmentMonthlyRow[], from: string, to: string): InvestmentHistoryPoint[] {
  const months = [...new Set(base.map((r) => r.month))].sort();
  return months.flatMap((month) => {
    const members = base.filter((r) => r.month === month);
    const date = members.map((r) => r.referenceDate).sort()[0];
    if (!date || date < from || date > to) return [];
    const rows = members.flatMap((r) => r.totalValue === null ? [] : r.projection.assetRows ?? []);
    const groups = summarizeInvestments(rows);
    const missingByGroup: Record<string, number> = {};
    const valuesByGroup: Record<string, number | null> = {};
    const calculableByGroup: Record<string, number | null> = {};
    const returns: Record<string, number | null> = {};
    for (const key of new Set(members.map((r) => r.group))) {
      const scoped = members.filter((r) => r.group === key);
      const missing = scoped.filter((r) => r.totalValue === null).length;
      const group = groups.find((g) => g.key === key);
      const evidencedHeld = scoped.some((r) => r.totalValue !== null && (r.quantity ?? 0) > 0);
      const unknownCost = scoped.some((r) => r.projection.limitations.some((l) => l.reason === "UNKNOWN_COST"));
      missingByGroup[key] = missing;
      valuesByGroup[key] = missing ? null : group?.current ?? 0;
      calculableByGroup[key] = missing && !evidencedHeld ? null : group?.current ?? 0;
      returns[key] = missing || unknownCost || !group || group.invested <= 0 ? null : group.profitPercent;
    }
    const missingAssets = members.filter((r) => r.totalValue === null).length;
    const mixedCurrency = new Set(members.map((r) => r.currency)).size > 1;
    const total = Number(rows.reduce((sum, r) => sum + r.current, 0).toFixed(2));
    const evidencedHeld = members.some((r) => r.totalValue !== null && (r.quantity ?? 0) > 0);
    return [{ date, value: missingAssets || mixedCurrency ? null : total,
      calculableValue: mixedCurrency || (missingAssets && !evidencedHeld) ? null : total,
      valuesByGroup, calculableByGroup, missingByGroup, returns, missingAssets,
      limitations: members.flatMap((r) => r.projection.limitations),
      carriedPrices: members.filter((r) => r.status === "STALE_PRICE" && r.quoteDate)
        .map((r) => ({ assetId: r.assetId, priceDate: r.quoteDate ?? "" })) }];
  });
}