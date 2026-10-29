// Read-only presentation adapter. Financial calculations remain in the existing services.
import { AssetValuationSource, ASSET_TYPE_LABELS, INVESTMENT_ASSET_TYPES, InvestmentOperation, isMarketQuotableType, type AssetType } from "@/constants/enums";
import type { Account, Asset, Movement } from "@/models";
import type { MarketPricePoint, MarketQuoteMap } from "@/models/MarketData";
import { AssetValuationServiceImpl } from "./AssetValuationService";
import { InvestmentServiceImpl, type InvestmentRow } from "./InvestmentService";
import { MarketQuotationServiceImpl } from "./MarketQuotationService";
import { YieldReconciliationServiceImpl } from "./YieldReconciliationService";
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

/** Below this share of the group capital valued, a return point is shown with a hollow marker. */
export const GROUP_RETURN_COVERAGE_WARNING = 0.8;

/**
 * Ativo de investimento espelhado numa conta (caixinha/CDB com valuation_source
 * ACCOUNT). Segue fora do total de ativos do Patrimônio (o caixa já o conta),
 * mas na aba Análise o saldo da conta é o valor comprovado da posição.
 * Classes de caixa puro (BANK, CASH, CAIXINHA, OUTRO) continuam excluídas.
 */
export function isAccountMirrorInvestment(asset: Asset): boolean {
  return asset.valuation_source === AssetValuationSource.ACCOUNT
    && !!asset.account_id
    && INVESTMENT_ASSET_TYPES.includes(asset.asset_type);
}

export interface AccountMirrorValue {
  /** Saldo da conta na data (mesma regra do extrato/dashboard). */
  value: number;
  /** Saldo inicial + aportes/transferências recebidas − resgates/enviadas. */
  capital: number;
  /** Rendimentos registrados (conciliados) até a data. */
  yields: number;
  lastReconciliation: { date: string; amount: number; movementId: string } | null;
}

/**
 * Valor de um ativo espelhado numa conta em uma data. Reutiliza o breakdown da
 * conciliação de rendimentos e o impacto em conta do MovementService — nenhuma
 * segunda fórmula de saldo. Rendimento só existe quando foi conciliado.
 */
export function accountMirrorValue(asset: Asset, account: Account, movements: Movement[], date: string): AccountMirrorValue {
  const breakdown = YieldReconciliationServiceImpl.breakdown(account, movements, date);
  const value = YieldReconciliationServiceImpl.expectedBalance(account, movements, date);
  const capital = Number((breakdown.initialBalance + breakdown.contributions - breakdown.redemptions).toFixed(2));
  const past = movements.filter((m) => !m.deleted_at && m.transaction_date <= date);
  return { value, capital, yields: breakdown.registeredYields, lastReconciliation: YieldReconciliationServiceImpl.lastReconciliation(past, asset.id) };
}

/** Linha de carteira de um ativo espelhado, com o saldo da conta como valor comprovado. */
function accountMirrorRow(asset: Asset, mirror: AccountMirrorValue): InvestmentRow {
  const profit = Number((mirror.value - mirror.capital).toFixed(2));
  return {
    asset,
    invested: mirror.capital,
    current: mirror.value,
    profit,
    profitPercent: mirror.capital > 0 ? (profit / mirror.capital) * 100 : 0,
    // Retorno absoluto mesmo com capital zero: o rendimento conciliado é o retorno.
    economicReturn: mirror.yields,
    accumulatedIncome: mirror.yields,
  };
}

/** Linhas atuais dos ativos espelhados em conta, para a Composição da aba Análise. */
export function accountMirrorRows(assets: Asset[], accounts: Account[], movements: Movement[], date: string): InvestmentRow[] {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  return assets.filter((a) => !a.deleted_at && a.is_active && isAccountMirrorInvestment(a)).flatMap((asset) => {
    const account = byId.get(asset.account_id ?? "");
    return account ? [accountMirrorRow(asset, accountMirrorValue(asset, account, movements, date))] : [];
  });
}

/** Shared historical-position evidence guard; does not calculate a position. */
function lacksPositionHistory(asset: Asset, movements: Movement[], date: string, requireEvent = false): boolean {
  const events = movements.filter((m) => !m.deleted_at &&
    (m.asset_id === asset.id || (m.tags ?? []).includes(`cost:SOURCE:${asset.id}`)) &&
    [InvestmentOperation.APORTE, InvestmentOperation.RESGATE, InvestmentOperation.AJUSTE_QUANTIDADE].includes(AssetValuationServiceImpl.operationOf(m)));
  const past = events.filter((m) => m.transaction_date <= date);
  const first = [...past].sort((a, b) => a.transaction_date.localeCompare(b.transaction_date) || a.id.localeCompare(b.id))[0];
  return asset.valuation_source !== AssetValuationSource.MOVEMENTS || Number(asset.opening_value) !== 0 ||
    (requireEvent && events.length === 0) ||
    past.some((m) => m.asset_id === asset.id &&
      [InvestmentOperation.APORTE, InvestmentOperation.RESGATE].includes(AssetValuationServiceImpl.operationOf(m)) &&
      (m.quantity == null || !Number.isFinite(Number(m.quantity)) || Number(m.quantity) <= 0)) ||
    !!(first && (first.asset_id !== asset.id || AssetValuationServiceImpl.operationOf(first) === InvestmentOperation.RESGATE || (first.tags ?? []).includes("qty:DECREASE"))) ||
    (events.length === 0 && (Number(asset.quantity) > 0 || Number(asset.acquisition_value) > 0 || Number(asset.current_value) > 0));
}

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
  /** Capital coverage of each group's return: valued cost / known cost, plus asset counts. */
  returnCoverage?: Record<string, { pct: number | null; valued: number; missing: number }>;
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
      if (lacksPositionHistory(asset, params.movements, date)) {
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

export type MonthlyPositionStatus = "OK" | "STALE_PRICE" | "CLOSED" | "NO_PRICE" | "NO_HISTORY" | "NO_VALUATION" | "ACCOUNT_RECONCILED";
export interface InvestmentMonthlyRow {
  assetId: string;
  name: string;
  ticker: string | null;
  assetType: AssetType;
  month: string;
  referenceDate: string;
  quantity: number | null;
  /** Position cost at the reference date; null when history is insufficient. */
  cost: number | null;
  unitQuote: number | null;
  quoteDate: string | null;
  totalValue: number | null;
  status: MonthlyPositionStatus;
  currency: string;
  group: string;
  /** "ACCOUNT" quando o valor é o saldo espelhado da conta (caixinha/CDB). */
  valueOrigin?: "ACCOUNT";
  /** Data da última conciliação de rendimento até a referência (ativos de conta). */
  lastReconciliationDate?: string | null;
  /** The existing services' projection, not a second financial calculation. */
  projection: InvestmentHistoryPoint;
}

/** Read-only monthly ledger. A stored session is evidence, not an inferred exchange calendar. */
export function investmentMonthlyBase(params: {
  assets: Asset[]; movements: Movement[]; prices: Record<string, MarketPricePoint[]>; from: string; to: string;
  /** Contas do workspace; necessárias para valorar ativos espelhados (caixinha/CDB). */
  accounts?: Account[];
}): InvestmentMonthlyRow[] {
  if (!validInvestmentRange(params.from, params.to, params.to)) return [];
  const result: InvestmentMonthlyRow[] = [];
  const accountsById = new Map((params.accounts ?? []).map((a) => [a.id, a]));
  // Ativos espelhados em conta: o saldo da conta é o valor comprovado do mês.
  for (const asset of params.assets.filter((a) => !a.deleted_at && a.is_active && isAccountMirrorInvestment(a))) {
    const account = accountsById.get(asset.account_id ?? "");
    if (!account) continue;
    const related = params.movements.filter((m) => !m.deleted_at &&
      (m.asset_id === asset.id || m.account_id === account.id || m.transfer_account_id === account.id));
    const first = related.map((m) => m.transaction_date).sort()[0];
    const start = first ?? params.from;
    if (!validInvestmentRange(start, params.to, params.to)) continue;
    const cursor = new Date(`${start.slice(0, 7)}-01T00:00:00Z`);
    while (cursor.toISOString().slice(0, 10) <= params.to) {
      const month = cursor.toISOString().slice(0, 7);
      const monthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
      const referenceDate = monthEnd > params.to ? params.to : monthEnd;
      const mirror = accountMirrorValue(asset, account, params.movements, referenceDate);
      const row = accountMirrorRow(asset, mirror);
      const group = investmentGroupKey(asset);
      result.push({
        assetId: asset.id, name: asset.name, ticker: asset.ticker, assetType: asset.asset_type,
        month, referenceDate, quantity: null, cost: mirror.capital,
        unitQuote: null, quoteDate: null, totalValue: mirror.value,
        status: "ACCOUNT_RECONCILED", currency: asset.currency, group,
        valueOrigin: "ACCOUNT", lastReconciliationDate: mirror.lastReconciliation?.date ?? null,
        projection: { date: referenceDate, value: mirror.value, valuesByGroup: { [group]: mirror.value },
          returns: {}, missingAssets: 0, limitations: [], carriedPrices: [], assetRows: [row] },
      });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }
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
      // Single reference rule for every Análise view: last quote saved inside the month.
      const session = prices.filter((p) => p.date.slice(0, 7) === month).at(-1);
      const monthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
      // No quote in the month: the month-end reference carries only an earlier quote, never a future one.
      const referenceDate = session?.date ?? (monthEnd > params.to ? params.to : monthEnd);
      if (referenceDate <= params.to) {
        const projection = investmentHistory({ assets: [asset], movements: params.movements,
          prices: { [asset.id]: prices }, dates: [referenceDate] })[0];
        if (projection) {
          const noHistory = !first || projection.limitations.some((l) => l.reason === "NO_HISTORY");
          const position = noHistory ? null : AssetValuationServiceImpl.positionOf(asset.id,
            params.movements.filter((m) => !m.deleted_at && m.transaction_date <= referenceDate));
          const quantity = position?.quantity ?? null;
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
          result.push({ assetId: asset.id, name: asset.name, ticker: asset.ticker, assetType: asset.asset_type, month, referenceDate,
            quantity, cost: position?.cost ?? null,
            unitQuote: quote && asset.ticker && isMarketQuotableType(asset.asset_type) ? quote.close : null,
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
    // A monthly aggregate must never be dated before any price/position it contains.
    const date = members.map((r) => r.referenceDate).sort().at(-1);
    if (!date || date < from || date > to) return [];
    const rows = members.flatMap((r) => r.totalValue === null ? [] : r.projection.assetRows ?? []);
    const groups = summarizeInvestments(rows);
    const missingByGroup: Record<string, number> = {};
    const valuesByGroup: Record<string, number | null> = {};
    const calculableByGroup: Record<string, number | null> = {};
    const returns: Record<string, number | null> = {};
    const returnCoverage: NonNullable<InvestmentHistoryPoint["returnCoverage"]> = {};
    for (const key of new Set(members.map((r) => r.group))) {
      const scoped = members.filter((r) => r.group === key);
      const valued = scoped.filter((r) => r.totalValue !== null);
      const missing = scoped.length - valued.length;
      const group = groups.find((g) => g.key === key);
      const evidencedHeld = valued.some((r) => (r.quantity ?? 0) > 0);
      // Return over the valued set only: market value minus cost of the SAME assets.
      const valuedRows = valued.flatMap((r) => r.projection.assetRows ?? []);
      const valuedGroup = valuedRows.length ? summarizeInvestments(valuedRows).find((g) => g.key === key) : undefined;
      const unknownCost = valued.some((r) => r.projection.limitations.some((l) => l.reason === "UNKNOWN_COST"));
      const totalCost = scoped.reduce((sum, r) => sum + (r.cost ?? 0), 0);
      const valuedCost = valued.reduce((sum, r) => sum + (r.cost ?? 0), 0);
      returnCoverage[key] = { pct: totalCost > 0 ? valuedCost / totalCost : null, valued: valued.length, missing };
      missingByGroup[key] = missing;
      valuesByGroup[key] = missing ? null : group?.current ?? 0;
      calculableByGroup[key] = missing && !evidencedHeld ? null : group?.current ?? 0;
      returns[key] = unknownCost || !valuedGroup || valuedGroup.invested <= 0 ? null : valuedGroup.profitPercent;
    }
    const missingAssets = members.filter((r) => r.totalValue === null).length;
    const mixedCurrency = new Set(members.map((r) => r.currency)).size > 1;
    const total = Number(rows.reduce((sum, r) => sum + r.current, 0).toFixed(2));
    const evidencedHeld = members.some((r) => r.totalValue !== null && (r.quantity ?? 0) > 0);
    return [{ date, value: missingAssets || mixedCurrency ? null : total,
      calculableValue: mixedCurrency || (missingAssets && !evidencedHeld) ? null : total,
      valuesByGroup, calculableByGroup, missingByGroup, returns, returnCoverage, missingAssets,
      limitations: members.flatMap((r) => r.projection.limitations),
      carriedPrices: members.filter((r) => r.status === "STALE_PRICE" && r.quoteDate)
        .map((r) => ({ assetId: r.assetId, priceDate: r.quoteDate ?? "" })) }];
  });
}

export interface CapitalVsMarketAssetRow {
  assetId: string;
  assetType: AssetType;
  /** ACCOUNT: valor comprovado pelo saldo espelhado da conta (caixinha/CDB). */
  status: "MARKET" | "COST_ONLY" | "NO_HISTORY" | "ACCOUNT";
  quantity: number | null;
  cost: number | null;
  marketValue: number | null;
  quoteDate: string | null;
  held: boolean;
}
export interface CapitalVsMarketMonth {
  month: string;
  date: string;
  currency: string;
  assets: CapitalVsMarketAssetRow[];
  capitalTotal: number | null;
  valorMercadoAvaliados: number | null;
  custoAvaliados: number | null;
  capitalSomenteCusto: number | null;
  ganhoNaoRealizado: number | null;
  ganhoPct: number | null;
  ativosAvaliados: number;
  ativosComPosicao: number;
  cobertura: number | null;
  /** Valued cost / total known capital; 1 means every known capital has proven market value. */
  coberturaCapital: number | null;
  /** Complete month: 100% of the scope capital valued and no asset without history. */
  completo: boolean;
  ativosSemHistorico: number;
}

/** Separate month-end comparison; existing first-session ledger/charts remain unchanged. */
export function capitalVsMarketMonthly(params: {
  assets: Asset[]; movements: Movement[]; prices: Record<string, MarketPricePoint[]>; from: string; to: string;
  /** Contas do workspace; necessárias para valorar ativos espelhados (caixinha/CDB). */
  accounts?: Account[];
}): CapitalVsMarketMonth[] {
  if (!validInvestmentRange(params.from, params.to, params.to)) return [];
  const assets = InvestmentServiceImpl.filterInvestments(params.assets).filter((a) => !a.deleted_at);
  const mirrors = params.assets.filter((a) => !a.deleted_at && a.is_active && isAccountMirrorInvestment(a));
  const accountsById = new Map((params.accounts ?? []).map((a) => [a.id, a]));
  const active = params.movements.filter((m) => !m.deleted_at);
  const related = (asset: Asset) => active.filter((m) => m.asset_id === asset.id || (m.tags ?? []).includes(`cost:SOURCE:${asset.id}`));
  const mirrorRelated = (asset: Asset) => active.filter((m) =>
    m.asset_id === asset.id || m.account_id === asset.account_id || m.transfer_account_id === asset.account_id);
  const first = [...assets.flatMap((a) => related(a).map((m) => m.transaction_date)),
    ...mirrors.flatMap((a) => mirrorRelated(a).map((m) => m.transaction_date))].sort()[0];
  if (!first || first > params.to) return [];
  const cursor = new Date(`${first.slice(0, 7)}-01T00:00:00Z`);
  const result: CapitalVsMarketMonth[] = [];
  const round = (n: number) => Number(n.toFixed(2));
  while (cursor.toISOString().slice(0, 10) <= params.to) {
    const month = cursor.toISOString().slice(0, 7);
    const end = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    const date = end > params.to ? params.to : end;
    if (date >= params.from) {
      const past = active.filter((m) => m.transaction_date <= date);
      for (const currency of new Set([...assets, ...mirrors].map((a) => a.currency))) {
        const members = assets.filter((a) => a.currency === currency &&
          (!related(a).length || related(a).some((m) => m.transaction_date <= date)));
        const mirrorMembers = mirrors.filter((a) => a.currency === currency && accountsById.has(a.account_id ?? "") &&
          (mirrorRelated(a).some((m) => m.transaction_date <= date) ||
            Number(accountsById.get(a.account_id ?? "")?.initial_balance) !== 0));
        if (!members.length && !mirrorMembers.length) continue;
        const rows: CapitalVsMarketAssetRow[] = members.map((asset) => {
          if (lacksPositionHistory(asset, active, date, true)) return {
            assetId: asset.id, assetType: asset.asset_type, status: "NO_HISTORY", quantity: null, cost: null, marketValue: null, quoteDate: null, held: false,
          };
          const position = AssetValuationServiceImpl.positionOf(asset.id, past);
          const held = position.quantity > 0 || position.cost > 0;
          const quote = isMarketQuotableType(asset.asset_type) && asset.ticker?.trim()
            ? [...(params.prices[asset.id] ?? [])].filter((p) => p.date.slice(0, 7) === month &&
              validInvestmentRange(p.date, p.date, date) && Number.isFinite(p.close) && p.close > 0)
              .sort((a, b) => a.date.localeCompare(b.date)).at(-1) : undefined;
          // Reuse the quotation service for quantity × price; pin its cost fallback to positionOf.
          const effective = AssetValuationServiceImpl.effectiveAssets([{ ...asset, quantity: 0, unit_price: 0,
            acquisition_value: 0, current_value: 0 }], past)[0];
          const ticker = asset.ticker?.trim().toUpperCase();
          const projected = effective && quote && ticker ? MarketQuotationServiceImpl.applyQuotes([
            { ...effective, effective_acquisition: position.cost, acquisition_value: position.cost },
          ], { [ticker]: { status: "FOUND", ticker, message: null, quote: {
            ticker, price: quote.close, currency, quotedAt: `${quote.date}T00:00:00Z`, provider: quote.provider,
            change: null, changePercent: null, marketState: null,
          } } })[0] : undefined;
          const marketValue = held ? projected?.market_value ?? null : 0;
          return { assetId: asset.id, assetType: asset.asset_type, status: held && marketValue !== null ? "MARKET" : "COST_ONLY",
            quantity: position.quantity, cost: position.cost, marketValue, quoteDate: quote?.date ?? null, held };
        });
        // Ativos espelhados em conta entram como avaliados: o saldo da conta é o valor comprovado.
        for (const asset of mirrorMembers) {
          const account = accountsById.get(asset.account_id ?? "");
          if (!account) continue;
          const mirror = accountMirrorValue(asset, account, active, date);
          const held = mirror.value !== 0 || mirror.capital !== 0;
          rows.push({ assetId: asset.id, assetType: asset.asset_type, status: "ACCOUNT",
            quantity: null, cost: mirror.capital, marketValue: mirror.value,
            quoteDate: mirror.lastReconciliation?.date ?? null, held });
        }
        const known = rows.filter((r) => r.status !== "NO_HISTORY");
        const market = known.filter((r) => r.status === "MARKET" || r.status === "ACCOUNT");
        const held = known.filter((r) => r.held);
        const capitalTotal = known.length ? round(known.reduce((sum, r) => sum + (r.cost ?? 0), 0)) : null;
        const valorMercadoAvaliados = market.length ? round(market.reduce((sum, r) => sum + (r.marketValue ?? 0), 0)) : held.length === 0 && known.length ? 0 : null;
        const custoAvaliados = valorMercadoAvaliados === null ? null : round(market.reduce((sum, r) => sum + (r.cost ?? 0), 0));
        const ganhoNaoRealizado = valorMercadoAvaliados !== null && custoAvaliados !== null ? round(valorMercadoAvaliados - custoAvaliados) : null;
        result.push({ month, date, currency, assets: rows, capitalTotal, valorMercadoAvaliados, custoAvaliados,
          capitalSomenteCusto: known.length ? round(known.filter((r) => r.status === "COST_ONLY").reduce((sum, r) => sum + (r.cost ?? 0), 0)) : null,
          ganhoNaoRealizado, ganhoPct: ganhoNaoRealizado !== null && custoAvaliados !== null && custoAvaliados > 0 ? round(ganhoNaoRealizado / custoAvaliados * 100) : null,
          ativosAvaliados: market.length, ativosComPosicao: held.length,
          cobertura: held.length ? market.length / held.length : null,
          coberturaCapital: capitalTotal !== null && capitalTotal > 0 && custoAvaliados !== null ? custoAvaliados / capitalTotal : null,
          completo: known.length > 0 && rows.length === known.length && custoAvaliados !== null && capitalTotal !== null && custoAvaliados === capitalTotal,
          ativosSemHistorico: rows.length - known.length });
      }
    }
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return result;
}