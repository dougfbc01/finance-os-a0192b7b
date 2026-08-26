// Sprint 4.10 — serviço de dados de mercado.
// Responsável por: normalizar ticker, delegar ao provider, cachear em memória
// por sessão e checar duplicidade de ticker dentro do workspace.
// Nunca cria ativos: apenas devolve uma prévia para confirmação do usuário.
import type {
  MarketDataLookupResult,
  MarketDataProvider,
  MarketHistoryResult,
  MarketQuoteMap,
  MarketQuoteResult,
} from "@/models/MarketData";
import type { Asset } from "@/models";
import { BrapiMarketDataProvider } from "./market/BrapiMarketDataProvider";
import { normalizeTicker } from "./market/tickerMapping";

export class MarketDataServiceImpl {
  private cache = new Map<string, MarketDataLookupResult>();
  private inflight = new Map<string, Promise<MarketDataLookupResult>>();
  private quoteCache = new Map<string, MarketQuoteResult>();
  private quoteInflight = new Map<string, Promise<MarketQuoteResult>>();
  private historyCache = new Map<string, MarketHistoryResult>();

  constructor(private provider: MarketDataProvider = new BrapiMarketDataProvider()) {}

  /** Permite trocar o provider (testes ou provider B/API oficial no futuro). */
  setProvider(provider: MarketDataProvider) {
    this.provider = provider;
    this.clearCache();
  }

  get providerName(): string {
    return this.provider.name;
  }

  clearCache() {
    this.cache.clear();
    this.inflight.clear();
    this.clearQuoteCache();
  }

  /** Limpa apenas as cotações (usado pelo botão "Atualizar cotações"). */
  clearQuoteCache() {
    this.quoteCache.clear();
  }

  /**
   * Sprint 4.11 — cotações atuais em lote.
   * - Reutiliza o cache em memória da sessão;
   * - deduplica tickers repetidos e chamadas concorrentes do mesmo ticker;
   * - isola erros: um ticker com falha não impede os demais.
   */
  async getQuotes(rawTickers: string[]): Promise<MarketQuoteMap> {
    const tickers = Array.from(
      new Set((rawTickers ?? []).map((t) => normalizeTicker(t ?? "")).filter(Boolean)),
    );
    const out: MarketQuoteMap = {};
    const pending: Promise<void>[] = [];
    const missing: string[] = [];

    for (const ticker of tickers) {
      const cached = this.quoteCache.get(ticker);
      if (cached) {
        out[ticker] = { ...cached, cached: true };
        continue;
      }
      const inflight = this.quoteInflight.get(ticker);
      if (inflight) {
        pending.push(
          inflight.then((res) => {
            out[ticker] = res;
          }),
        );
        continue;
      }
      missing.push(ticker);
    }

    if (missing.length > 0) {
      const batch = this.provider
        .getQuotes(missing)
        .catch((): MarketQuoteResult[] =>
          missing.map((ticker) => ({
            status: "ERROR" as const,
            ticker,
            quote: null,
            message: "Falha ao consultar cotações no provider.",
          })),
        )
        .then((results) => {
          const byTicker = new Map(results.map((r) => [normalizeTicker(r.ticker), r]));
          return missing.map<MarketQuoteResult>(
            (ticker) =>
              byTicker.get(ticker) ?? {
                status: "NOT_FOUND",
                ticker,
                quote: null,
                message: "Cotação indisponível para este ativo.",
              },
          );
        });

      missing.forEach((ticker, index) => {
        const p = batch.then((results) => results[index] as MarketQuoteResult);
        this.quoteInflight.set(ticker, p);
        pending.push(
          p
            .then((res) => {
              // Só cacheamos respostas conclusivas; erros podem ser reconsultados.
              if (res.status === "FOUND" || res.status === "NO_QUOTE") {
                this.quoteCache.set(ticker, res);
              }
              out[ticker] = res;
            })
            .finally(() => {
              this.quoteInflight.delete(ticker);
            }),
        );
      });
    }

    await Promise.all(pending);
    return out;
  }

  /**
   * Sprint 4.12 — histórico de preços via provider (sem persistência aqui;
   * o armazenamento/reuso fica no MarketHistoricalPriceService).
   * Cache em memória por sessão para não repetir a mesma consulta.
   */
  async getHistoricalPrices(
    rawTicker: string,
    range: { from: string; to: string },
  ): Promise<MarketHistoryResult> {
    const ticker = normalizeTicker(rawTicker ?? "");
    if (!ticker) {
      return { status: "NOT_FOUND", ticker, points: [], message: "Informe um ticker." };
    }
    if (!this.provider.getHistoricalPrices) {
      return {
        status: "ERROR",
        ticker,
        points: [],
        message: "Provider não suporta histórico de preços.",
      };
    }
    const key = `${ticker}:${range.from}:${range.to}`;
    const cached = this.historyCache.get(key);
    if (cached) return cached;

    const res = await this.provider.getHistoricalPrices(ticker, range).catch(
      (): MarketHistoryResult => ({
        status: "ERROR",
        ticker,
        points: [],
        message: "Falha ao consultar o histórico no provider.",
      }),
    );
    // Só cacheamos respostas conclusivas; erros podem ser reconsultados.
    if (res.status === "OK" || res.status === "NO_DATA" || res.status === "NOT_FOUND") {
      this.historyCache.set(key, res);
    }
    return res;
  }

  async lookup(rawTicker: string): Promise<MarketDataLookupResult> {
    const ticker = normalizeTicker(rawTicker ?? "");
    if (!ticker) {
      return { status: "NOT_FOUND", ticker, data: null, message: "Informe um ticker." };
    }
    const cached = this.cache.get(ticker);
    if (cached) return { ...cached, cached: true };

    const pending = this.inflight.get(ticker);
    if (pending) return pending;

    const promise = this.provider
      .lookup(ticker)
      .then((res) => {
        // Só cacheamos respostas conclusivas; erros transitórios podem ser reconsultados.
        if (res.status === "FOUND" || res.status === "NOT_FOUND") {
          this.cache.set(ticker, res);
        }
        return res;
      })
      .catch(
        (): MarketDataLookupResult => ({
          status: "ERROR",
          ticker,
          data: null,
          message: "Falha ao consultar o provider de mercado.",
        }),
      )
      .finally(() => {
        this.inflight.delete(ticker);
      });

    this.inflight.set(ticker, promise);
    return promise;
  }

  /**
   * Procura um ativo já cadastrado com o mesmo ticker no workspace.
   * A lista recebida já é isolada por workspace (RLS + filtro do AssetService).
   */
  findExistingByTicker(assets: Asset[], rawTicker: string, workspaceId: string): Asset | null {
    const ticker = normalizeTicker(rawTicker ?? "");
    if (!ticker) return null;
    return (
      assets.find(
        (a) =>
          a.workspace_id === workspaceId &&
          !a.deleted_at &&
          normalizeTicker(a.ticker ?? "") === ticker,
      ) ?? null
    );
  }
}

export const MarketDataService = new MarketDataServiceImpl();
