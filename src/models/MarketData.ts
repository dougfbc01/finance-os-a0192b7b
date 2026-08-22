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

/** Contrato de provider. Trocar de provider = trocar a implementação. */
export interface MarketDataProvider {
  readonly name: string;
  lookup(ticker: string): Promise<MarketDataLookupResult>;
}
