// MarketHistoricalPriceService — Sprint 4.12
// Orquestra o histórico de preços de mercado:
//   1. lê o que já existe em market_price_history (sem duplicar consultas);
//   2. busca na BRAPI (via MarketDataService → provider) o que falta;
//   3. normaliza e persiste sem duplicar (mesmo ativo + mesma data);
//   4. devolve a série cronológica ordenada por data.
//
// O histórico de mercado é dado de MERCADO: nunca cria movimentação, nunca
// altera saldo, patrimônio, metas ou planejamento.
import { BaseService } from "./BaseService";
import { MarketDataService } from "./MarketDataService";
import { normalizeTicker } from "./market/tickerMapping";
import type { MarketHistoryResult, MarketPricePoint } from "@/models/MarketData";
import type { UUID } from "@/models";

export interface MarketHistoryQuery {
  workspaceId: UUID;
  assetId: UUID;
  ticker: string;
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

export interface MarketHistorySeries {
  status: MarketHistoryResult["status"];
  points: MarketPricePoint[];
  message: string | null;
  /** True quando a série veio integralmente do armazenamento local. */
  fromStorage: boolean;
}

interface HistoryRow {
  ticker: string;
  price_date: string;
  close_price: number | string;
  open_price: number | string | null;
  high_price: number | string | null;
  low_price: number | string | null;
  volume: number | string | null;
  provider: string;
  fetched_at: string;
}

const numOrNull = (v: number | string | null): number | null => {
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

class MarketHistoricalPriceServiceImpl extends BaseService {
  private readonly table = "market_price_history" as const;

  private mapRow(r: HistoryRow): MarketPricePoint {
    return {
      ticker: r.ticker,
      date: r.price_date,
      close: Number(r.close_price),
      open: numOrNull(r.open_price),
      high: numOrNull(r.high_price),
      low: numOrNull(r.low_price),
      volume: numOrNull(r.volume),
      provider: r.provider,
      fetchedAt: r.fetched_at,
    };
  }

  /** Lê os pontos já armazenados para o ativo no intervalo [from, to]. */
  async listStored(query: MarketHistoryQuery): Promise<MarketPricePoint[]> {
    const { data, error } = await this.client
      .from(this.table)
      .select("ticker, price_date, close_price, open_price, high_price, low_price, volume, provider, fetched_at")
      .eq("workspace_id", query.workspaceId)
      .eq("asset_id", query.assetId)
      .gte("price_date", query.from)
      .lte("price_date", query.to)
      .order("price_date", { ascending: true });
    if (error) this.handleError(error, "listStored");
    return ((data ?? []) as unknown as HistoryRow[]).map((r) => this.mapRow(r));
  }

  /**
   * Persiste pontos novos sem duplicar: o índice único (asset_id, price_date)
   * garante idempotência; conflitos são ignorados.
   */
  async store(query: MarketHistoryQuery, points: MarketPricePoint[]): Promise<number> {
    if (points.length === 0) return 0;
    const rows = points.map((p) => ({
      workspace_id: query.workspaceId,
      asset_id: query.assetId,
      ticker: normalizeTicker(p.ticker),
      price_date: p.date,
      close_price: p.close,
      open_price: p.open,
      high_price: p.high,
      low_price: p.low,
      volume: p.volume,
      provider: p.provider,
      fetched_at: p.fetchedAt,
    }));
    const { data, error } = await this.client
      .from(this.table)
      .upsert(rows, { onConflict: "asset_id,price_date", ignoreDuplicates: true })
      .select("id");
    if (error) this.handleError(error, "store");
    return (data ?? []).length;
  }

  /**
   * Série histórica do ativo no intervalo, reutilizando o que já está
   * armazenado e consultando o provider apenas quando necessário.
   * Erros do provider nunca alteram dados existentes nem valores do ativo.
   */
  async getHistory(query: MarketHistoryQuery): Promise<MarketHistorySeries> {
    const ticker = normalizeTicker(query.ticker ?? "");
    if (!ticker) {
      return { status: "NOT_FOUND", points: [], message: "Ativo sem ticker.", fromStorage: false };
    }

    const stored = await this.listStored(query);
    const coversFrom =
      stored.length > 0 && (stored[0] as MarketPricePoint).date <= query.from;

    if (stored.length > 0 && coversFrom) {
      // Já temos dados desde o início do período: não repetir a consulta.
      return { status: "OK", points: stored, message: null, fromStorage: true };
    }

    const result = await MarketDataService.getHistoricalPrices(ticker, {
      from: query.from,
      to: query.to,
    });

    if (result.status === "OK" && result.points.length > 0) {
      await this.store(query, result.points);
      const merged = await this.listStored(query);
      return { status: "OK", points: merged, message: null, fromStorage: false };
    }

    if (stored.length > 0) {
      // Provider falhou/não tem o período todo: devolve o que já existe.
      return { status: "OK", points: stored, message: result.message, fromStorage: true };
    }

    return {
      status: result.status,
      points: [],
      message: result.message ?? "Histórico de mercado indisponível.",
      fromStorage: false,
    };
  }
}

export const MarketHistoricalPriceService = new MarketHistoricalPriceServiceImpl();
export { MarketHistoricalPriceServiceImpl };
