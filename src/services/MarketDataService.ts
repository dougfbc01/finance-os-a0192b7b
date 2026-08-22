// Sprint 4.10 — serviço de dados de mercado.
// Responsável por: normalizar ticker, delegar ao provider, cachear em memória
// por sessão e checar duplicidade de ticker dentro do workspace.
// Nunca cria ativos: apenas devolve uma prévia para confirmação do usuário.
import type {
  MarketDataLookupResult,
  MarketDataProvider,
} from "@/models/MarketData";
import type { Asset } from "@/models";
import { BrapiMarketDataProvider } from "./market/BrapiMarketDataProvider";
import { normalizeTicker } from "./market/tickerMapping";

export class MarketDataServiceImpl {
  private cache = new Map<string, MarketDataLookupResult>();
  private inflight = new Map<string, Promise<MarketDataLookupResult>>();

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
