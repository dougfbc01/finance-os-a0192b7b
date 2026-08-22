// Sprint 4.10 — provider concreto (brapi.dev) atrás do contrato MarketDataProvider.
// A chamada HTTP acontece server-side (src/lib/marketData.functions.ts).
import type { MarketDataLookupResult, MarketDataProvider } from "@/models/MarketData";
import { lookupTickerFn } from "@/lib/marketData.functions";
import { inferAssetType, normalizeTicker } from "./tickerMapping";

export const BRAPI_PROVIDER_NAME = "brapi.dev";

export class BrapiMarketDataProvider implements MarketDataProvider {
  readonly name = BRAPI_PROVIDER_NAME;

  async lookup(rawTicker: string): Promise<MarketDataLookupResult> {
    const ticker = normalizeTicker(rawTicker);
    try {
      const res = await lookupTickerFn({ data: { ticker } });
      if (res.status !== "FOUND" || !res.quote) {
        return {
          status: res.status,
          ticker,
          data: null,
          message: res.message ?? "Ativo não encontrado.",
        };
      }
      const q = res.quote;
      const name = q.longName ?? q.shortName ?? ticker;
      return {
        status: "FOUND",
        ticker: normalizeTicker(q.symbol),
        message: null,
        data: {
          ticker: normalizeTicker(q.symbol),
          name,
          assetType: inferAssetType(q.symbol, name),
          description: q.summary,
          exchange: q.exchange ?? "B3",
          currency: q.currency ?? "BRL",
          provider: BRAPI_PROVIDER_NAME,
        },
      };
    } catch {
      return {
        status: "ERROR",
        ticker,
        data: null,
        message: "Falha ao consultar o provider de mercado.",
      };
    }
  }
}
