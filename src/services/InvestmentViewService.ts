// Read-only view operations: never recalculate or persist financial values.
import { ASSET_TYPE_LABELS } from "@/constants/enums";
import type { InvestmentRow } from "./InvestmentService";
import type { InvestmentHistoryPoint } from "./InvestmentAnalysisService";

export type InvestmentSortKey = "name" | "ticker" | "type" | "institution" | "quantity" | "averagePrice" | "quote" | "invested" | "current" | "profitPercent" | "economicReturn" | "accumulatedIncome";
export type InvestmentSortDirection = "asc" | "desc";
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

function sortValue(row: InvestmentRow, key: InvestmentSortKey): string | number | null {
  switch (key) {
    case "name": return row.asset.name;
    case "ticker": return row.asset.ticker;
    case "type": return ASSET_TYPE_LABELS[row.asset.asset_type];
    case "institution": return row.asset.institution;
    case "quantity": return Number(row.asset.quantity);
    case "averagePrice": return Number(row.asset.unit_price);
    case "quote": return row.asset.quote?.price ?? null;
    default: return row[key];
  }
}

export function portfolioView(rows: InvestmentRow[], options: { search: string; type: string; sortKey: InvestmentSortKey | null; direction: InvestmentSortDirection }): InvestmentRow[] {
  const term = normalize(options.search.trim());
  const filtered = rows.filter((row) => (options.type === "ALL" || row.asset.asset_type === options.type)
    && (!term || normalize(row.asset.name).includes(term) || normalize(row.asset.ticker ?? "").includes(term)));
  const key = options.sortKey;
  if (!key) return filtered;
  return filtered.sort((a, b) => {
    const left = sortValue(a, key);
    const right = sortValue(b, key);
    const leftMissing = left == null || left === "" || (typeof left === "number" && !finite(left));
    const rightMissing = right == null || right === "" || (typeof right === "number" && !finite(right));
    // Unavailable values remain last in either direction, not numerical zero.
    if (leftMissing || rightMissing) return Number(leftMissing) - Number(rightMissing);
    const order = typeof left === "number" && typeof right === "number"
      ? left - right
      : String(left).localeCompare(String(right), "pt-BR", { sensitivity: "base", numeric: true });
    return options.direction === "asc" ? order : -order;
  });
}

export function historicalChartView(points: InvestmentHistoryPoint[], groupKeys: string[]) {
  const data = points.map((point) => ({
    date: point.date,
    value: finite(point.value) ? point.value : null,
    coverage: point.returnCoverage ?? {},
    ...Object.fromEntries(groupKeys.map((key) => [key, finite(point.returns[key]) ? point.returns[key] : null])),
  }));
  return {
    data,
    hasValues: data.some((point) => finite(point.value)),
    returnKeys: groupKeys.filter((key) => points.some((point) => finite(point.returns[key]))),
    isolatedReturns: groupKeys.flatMap((key) => {
      const valid = points.filter((point) => finite(point.returns[key]));
      const single = valid[0];
      return valid.length === 1 && single ? [{ key, date: single.date }] : [];
    }),
  };
}

/** Per-asset gap summary across the period, for explaining missing data. */
export function limitationSummary(points: InvestmentHistoryPoint[]) {
  const map = new Map<string, { assetId: string; name: string; reason: InvestmentHistoryPoint["limitations"][number]["reason"]; dates: number; first: string; last: string }>();
  for (const p of points) for (const l of p.limitations) {
    const k = `${l.assetId}:${l.reason}`;
    const cur = map.get(k);
    if (cur) { cur.dates += 1; cur.last = p.date; } else map.set(k, { ...l, dates: 1, first: p.date, last: p.date });
  }
  return [...map.values()];
}

export function investmentPeriodStart(today: string, months: number): string {
  const date = new Date(`${today}T12:00:00Z`);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - months);
  const endOfMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, endOfMonth));
  return date.toISOString().slice(0, 10);
}

export function investmentHistoryDates(from: string, to: string): string[] {
  if (!validInvestmentRange(from, to, to)) return [];
  const dates: string[] = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  while (cursor.toISOString().slice(0, 10) <= to) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

/** First weekday of each month inside [from, to], plus `to` itself; never a future date. */
export function investmentMonthlyDates(from: string, to: string): string[] {
  if (!validInvestmentRange(from, to, to)) return [];
  const dates: string[] = [];
  const cursor = new Date(`${from.slice(0, 7)}-01T00:00:00Z`);
  while (cursor.toISOString().slice(0, 10) <= to) {
    const day = new Date(cursor);
    while (day.getUTCDay() === 0 || day.getUTCDay() === 6) day.setUTCDate(day.getUTCDate() + 1);
    const iso = day.toISOString().slice(0, 10);
    if (iso >= from && iso <= to) dates.push(iso);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  if (dates.at(-1) !== to) dates.push(to);
  return dates;
}

export function validInvestmentRange(from: string, to: string, today: string): boolean {
  const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date)
    && Number.isFinite(Date.parse(`${date}T00:00:00Z`))
    && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
  return validDate(from) && validDate(to) && from <= to && to <= today;
}