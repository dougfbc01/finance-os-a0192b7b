import { AssetType } from "@/constants/enums";
import type { B3AssetReference, B3PreviewRow } from "@/models/B3Import";
import { inferAssetType } from "@/services/market/tickerMapping";

export interface B3HistoricalAssetCandidate {
  ticker: string | null;
  name: string;
  institution: string | null;
  assetType: AssetType;
}

const normalize = (value: string) =>
  value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").toUpperCase();

const fixedIncomeType = (rawProduct: string): AssetType | null => {
  const value = normalize(rawProduct);
  if (value.startsWith("TESOURO ")) return AssetType.TESOURO;
  if (value.startsWith("CDB - ")) return AssetType.CDB;
  return null;
};

/**
 * Builds safe historical-asset candidates from B3 rows that do not have a
 * current Asset. Negotiable tickers use the existing market type inference;
 * Tesouro/CDB are identified by their explicit B3 product names.
 * Rights remain pending when no supported type can be inferred safely.
 */
export function buildB3HistoricalAssetCandidates(
  rows: B3PreviewRow[],
  assets: B3AssetReference[],
): B3HistoricalAssetCandidate[] {
  const existingTickers = new Set(
    assets.map((asset) => asset.ticker?.trim().toUpperCase()).filter((ticker): ticker is string => !!ticker),
  );
  const existingNames = new Set(assets.map((asset) => normalize(asset.name)));
  const candidates = new Map<string, B3HistoricalAssetCandidate>();

  for (const row of rows) {
    if (row.product.identificationStatus !== "NOT_FOUND" && row.product.identificationStatus !== "UNIDENTIFIED") continue;

    const ticker = row.product.ticker?.trim().toUpperCase() || null;
    const name = row.product.productName?.trim() || row.product.rawProduct.trim();

    if (ticker) {
      if (existingTickers.has(ticker) || candidates.has(ticker)) continue;
      const assetType = inferAssetType(ticker, name || row.product.rawProduct);
      if (!assetType) continue;
      candidates.set(ticker, { ticker, name: name || ticker, institution: row.product.institution?.trim() || null, assetType });
      continue;
    }

    const assetType = fixedIncomeType(row.product.rawProduct);
    if (!assetType) continue;
    const key = `NAME:${normalize(name)}`;
    if (!name || existingNames.has(normalize(name)) || candidates.has(key)) continue;
    candidates.set(key, { ticker: null, name, institution: row.product.institution?.trim() || null, assetType });
  }

  return [...candidates.values()].sort((a, b) => (a.ticker ?? a.name).localeCompare(b.ticker ?? b.name));
}
