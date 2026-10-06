// Correção de cotações — última cotação salva POR ATIVO.
// Reaproveita market_price_history (uma linha por ativo + data). Gravar a
// cotação de um ativo só toca a linha daquele ativo no dia; nunca apaga nem
// altera linhas de outros ativos. Dado de mercado: não cria movimentações.
import { BaseService } from "./BaseService";
import { normalizeTicker } from "./market/tickerMapping";
import type { MarketQuoteMap, MarketQuoteResult } from "@/models/MarketData";
import type { UUID } from "@/models";

interface StoredRow {
  ticker: string;
  close_price: number | string;
  provider: string;
  fetched_at: string;
  price_date: string;
}

class MarketQuoteStoreServiceImpl extends BaseService {
  private readonly table = "market_price_history" as const;

  /**
   * Junta resultados novos sem afetar os outros tickers. Uma consulta que
   * falha nunca substitui uma cotação válida já conhecida daquele ativo.
   */
  static merge(prev: MarketQuoteMap, incoming: MarketQuoteMap): MarketQuoteMap {
    const next: MarketQuoteMap = { ...prev };
    for (const [ticker, res] of Object.entries(incoming)) {
      if (res.status === "FOUND" || next[ticker]?.status !== "FOUND") {
        next[ticker] = res;
      }
    }
    return next;
  }

  /** Converte as linhas salvas na última cotação de cada ticker. */
  static latestFromRows(rows: StoredRow[]): MarketQuoteMap {
    const out: MarketQuoteMap = {};
    const sorted = [...rows].sort((a, b) =>
      a.price_date === b.price_date
        ? b.fetched_at.localeCompare(a.fetched_at)
        : b.price_date.localeCompare(a.price_date),
    );
    for (const r of sorted) {
      const ticker = normalizeTicker(r.ticker);
      const price = Number(r.close_price);
      if (!ticker || out[ticker] || !Number.isFinite(price)) continue;
      out[ticker] = {
        status: "FOUND",
        ticker,
        message: null,
        cached: true,
        quote: {
          ticker,
          price,
          currency: "BRL",
          quotedAt: r.fetched_at,
          change: null,
          changePercent: null,
          marketState: null,
          provider: r.provider,
        },
      };
    }
    return out;
  }

  /** Última cotação salva de cada ativo do workspace. */
  async loadLatest(workspaceId: UUID, tickers: string[]): Promise<MarketQuoteMap> {
    if (tickers.length === 0) return {};
    const { data, error } = await this.client
      .from(this.table)
      .select("ticker, close_price, provider, fetched_at, price_date")
      .eq("workspace_id", workspaceId)
      .in("ticker", tickers)
      .order("price_date", { ascending: false })
      .limit(2000);
    if (error) this.handleError(error, "loadLatest");
    return MarketQuoteStoreServiceImpl.latestFromRows((data ?? []) as unknown as StoredRow[]);
  }

  /** Salva as cotações encontradas apenas para os ativos informados. */
  async save(
    workspaceId: UUID,
    assets: { id: UUID; ticker: string }[],
    results: MarketQuoteMap,
  ): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const rows = assets.flatMap((a) => {
      const res: MarketQuoteResult | undefined = results[a.ticker];
      if (!res || res.status !== "FOUND" || !res.quote) return [];
      return [
        {
          workspace_id: workspaceId,
          asset_id: a.id,
          ticker: a.ticker,
          price_date: today,
          close_price: res.quote.price,
          provider: res.quote.provider,
          fetched_at: new Date().toISOString(),
        },
      ];
    });
    if (rows.length === 0) return;
    const { error } = await this.client
      .from(this.table)
      .upsert(rows, { onConflict: "asset_id,price_date" });
    if (error) this.handleError(error, "save");
  }
}

export const MarketQuoteStoreService = new MarketQuoteStoreServiceImpl();
export { MarketQuoteStoreServiceImpl };
