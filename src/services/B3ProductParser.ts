import type { B3AssetReference, B3ProductReference } from "@/models/B3Import";

const TICKER = /^[A-Z][A-Z0-9]{3}\d{1,2}(?:F)?$/;

const normalizeName = (value: string) =>
  value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").toUpperCase();

export class B3ProductParser {
  static parse(rawProduct: string, institution: string | null, assets: B3AssetReference[]): B3ProductReference {
    const raw = rawProduct.trim();
    const tokens = raw.toUpperCase().match(/\b[A-Z][A-Z0-9]{3}\d{1,2}(?:F)?\b/g) ?? [];
    const unique = [...new Set(tokens.filter((token) => TICKER.test(token)))];
    const ticker = unique.length === 1 ? unique[0] : null;
    const productName = ticker
      ? raw.replace(new RegExp(`^${ticker}\\s*[-–—]?\\s*`, "i"), "").trim() || null
      : null;
    const matches = ticker
      ? assets.filter((asset) => asset.ticker?.trim().toUpperCase() === ticker)
      : assets.filter((asset) => !asset.ticker && normalizeName(asset.name) === normalizeName(raw));

    const identificationStatus = unique.length > 1
      ? "AMBIGUOUS"
      : matches.length > 1
        ? "AMBIGUOUS"
        : matches.length === 1
          ? "FOUND"
          : ticker
            ? "NOT_FOUND"
            : "UNIDENTIFIED";

    return {
      rawProduct: raw,
      ticker,
      productName,
      institution,
      identificationStatus,
      assetId: matches.length === 1 ? matches[0].id : null,
      assetName: matches.length === 1 ? matches[0].name : null,
    };
  }
}
