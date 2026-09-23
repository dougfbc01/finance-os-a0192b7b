import type { B3AssetReference, B3ProductReference } from "@/models/B3Import";

const TICKER = /^[A-Z][A-Z0-9]{3}\d{1,2}(?:F)?$/;

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
      : [];

    const identificationStatus = unique.length > 1
      ? "AMBIGUOUS"
      : !ticker
        ? "UNIDENTIFIED"
        : matches.length > 1
          ? "AMBIGUOUS"
          : matches.length === 1
            ? "FOUND"
            : "NOT_FOUND";

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
