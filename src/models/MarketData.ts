// Sprint 4.10 — contrato de dados de mercado (identificação de ativos por ticker).
// A aplicação depende deste contrato, nunca de uma API externa específica.
import type { AssetType } from "@/constants/enums";

/** Dados cadastrais retornados por um provider de mercado. */
export interface MarketAssetInfo {
  ticker: string;
  name: string;
  /** Nulo quando o provider não consegue determinar o tipo com segurança. */
  assetType: AssetType | null;
  description: string | null;
  exchange: string | null;
  currency: string | null;
  /** Identificação do provider que respondeu (auditoria/UI). */
  provider: string;
}

export type MarketDataLookupStatus =
  | "FOUND"
  | "NOT_FOUND"
  | "ERROR"
  | "NOT_CONFIGURED";

export interface MarketDataLookupResult {
  status: MarketDataLookupStatus;
  ticker: string;
  data: MarketAssetInfo | null;
  /** Mensagem amigável para exibir ao usuário quando não houver dados. */
  message: string | null;
  /** True quando a resposta veio do cache em memória da sessão. */
  cached?: boolean;
}

// ---------------------------------------------------------------------------
// Sprint 4.11 — cotação atual
// ---------------------------------------------------------------------------

/** Cotação normalizada de um ativo negociado em mercado. */
export interface MarketQuote {
  ticker: string;
  /** Preço atual na moeda informada. */
  price: number;
  currency: string;
  /** ISO string do momento da cotação informado pelo provider. */
  quotedAt: string | null;
  /** Variação do dia em moeda (null quando o provider não informa). */
  change: number | null;
  /** Variação percentual do dia (null quando o provider não informa). */
  changePercent: number | null;
  /** Estado do mercado informado pelo provider (ex.: "REGULAR", "CLOSED"). */
  marketState: string | null;
  provider: string;
}

export type MarketQuoteStatus =
  | "FOUND"
  | "NOT_FOUND"
  | "NO_QUOTE"
  | "ERROR"
  | "NOT_CONFIGURED";

export interface MarketQuoteResult {
  status: MarketQuoteStatus;
  ticker: string;
  quote: MarketQuote | null;
  message: string | null;
  cached?: boolean;
}

/** Mapa ticker normalizado → resultado da cotação. */
export type MarketQuoteMap = Record<string, MarketQuoteResult>;

// ---------------------------------------------------------------------------
// Sprint 4.12 — histórico de preços de mercado
// ---------------------------------------------------------------------------

/** Ponto histórico normalizado (um pregão/dia). */
export interface MarketPricePoint {
  ticker: string;
  /** Data do pregão no formato YYYY-MM-DD. */
  date: string;
  /** Preço de fechamento do dia. */
  close: number;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  provider: string;
  /** ISO string do momento em que o dado foi obtido do provider. */
  fetchedAt: string;
}

export type MarketHistoryStatus =
  | "OK"
  | "NOT_FOUND"
  | "NO_DATA"
  | "ERROR"
  | "NOT_CONFIGURED";

export interface MarketHistoryResult {
  status: MarketHistoryStatus;
  ticker: string;
  /** Série cronológica ordenada por data (ascendente). */
  points: MarketPricePoint[];
  message: string | null;
}

/** Contrato de provider. Trocar de provider = trocar a implementação. */
export interface MarketDataProvider {
  readonly name: string;
  /** Dados cadastrais (Sprint 4.10). */
  lookup(ticker: string): Promise<MarketDataLookupResult>;
  /** Cotação atual (Sprint 4.11). Sempre em lote para deduplicar chamadas. */
  getQuotes(tickers: string[]): Promise<MarketQuoteResult[]>;
  /**
   * Sprint 4.12 — histórico de preços (série diária).
   * Opcional no contrato: providers que não suportam simplesmente não implementam.
   * `range.from`/`range.to` no formato YYYY-MM-DD.
   */
  getHistoricalPrices?(
    ticker: string,
    range: { from: string; to: string },
  ): Promise<MarketHistoryResult>;
}

