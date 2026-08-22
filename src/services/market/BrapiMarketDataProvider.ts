// Sprint 4.10 — provider concreto (brapi.dev) atrás do contrato MarketDataProvider.
// A chamada HTTP acontece server-side (src/lib/marketData.functions.ts).
import type {
  MarketDataLookupResult,
  MarketDataProvider,
  MarketQuoteResult,
} from "@/models/MarketData";
import { lookupTickerFn, quoteTickersFn } from "@/lib/marketData.functions";
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

  /**
   * Sprint 4.11 — cotação atual em lote.
   * Erro/ausência de um ticker nunca impede os demais: cada ticker recebe
   * seu próprio resultado.
   */
  async getQuotes(rawTickers: string[]): Promise<MarketQuoteResult[]> {
    const tickers = Array.from(
      new Set(rawTickers.map(normalizeTicker).filter(Boolean)),
    );
    if (tickers.length === 0) return [];

    const fail = (status: MarketQuoteResult["status"], message: string) =>
      tickers.map<MarketQuoteResult>((ticker) => ({
        status,
        ticker,
        quote: null,
        message,
      }));

    try {
      const res = await quoteTickersFn({ data: { tickers } });
      if (res.status === "NOT_CONFIGURED") {
        return fail("NOT_CONFIGURED", res.message ?? "Cotação não configurada.");
      }
      if (res.status === "ERROR") {
        return fail("ERROR", res.message ?? "Provider de mercado indisponível.");
      }
      const bySymbol = new Map(
        res.quotes.map((q) => [normalizeTicker(q.symbol), q] as const),
      );
      return tickers.map<MarketQuoteResult>((ticker) => {
        const q = bySymbol.get(ticker);
        if (!q) {
          return {
            status: "NOT_FOUND",
            ticker,
            quote: null,
            message: "Ativo não encontrado no provider.",
          };
        }
        if (q.price === null || !Number.isFinite(q.price)) {
          return {
            status: "NO_QUOTE",
            ticker,
            quote: null,
            message: "Cotação indisponível para este ativo.",
          };
        }
        return {
          status: "FOUND",
          ticker,
          message: null,
          quote: {
            ticker,
            price: q.price,
            currency: q.currency ?? "BRL",
            quotedAt: q.quotedAt,
            change: q.change,
            changePercent: q.changePercent,
            marketState: q.marketState,
            provider: BRAPI_PROVIDER_NAME,
          },
        };
      });
    } catch {
      return fail("ERROR", "Falha ao consultar cotações no provider.");
    }
  }
}
