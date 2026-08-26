// Sprint 4.10 — integração com o provider brapi.dev (dados da B3).
// Server-only: o token opcional é lido de process.env dentro do handler.
export interface RawMarketQuote {
  symbol: string;
  longName: string | null;
  shortName: string | null;
  currency: string | null;
  exchange: string | null;
  summary: string | null;
}

export interface BrapiLookupResponse {
  status: "FOUND" | "NOT_FOUND" | "ERROR" | "NOT_CONFIGURED";
  quote: RawMarketQuote | null;
  message: string | null;
}

const TIMEOUT_MS = 8000;

export async function fetchBrapiQuote(rawTicker: string): Promise<BrapiLookupResponse> {
  const ticker = rawTicker.trim().toUpperCase();
  const token = process.env["BRAPI_TOKEN"];
  const url = new URL(`https://brapi.dev/api/quote/${encodeURIComponent(ticker)}`);
  if (token) url.searchParams.set("token", token);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (res.status === 404) {
      return { status: "NOT_FOUND", quote: null, message: "Ativo não encontrado." };
    }
    if (res.status === 401 || res.status === 403) {
      return {
        status: "NOT_CONFIGURED",
        quote: null,
        message:
          "Consulta de mercado indisponível (provider exige credencial BRAPI_TOKEN). Cadastre o ativo manualmente.",
      };
    }
    if (!res.ok) {
      return { status: "ERROR", quote: null, message: "Provider de mercado indisponível." };
    }
    const body = (await res.json()) as {
      results?: Array<Record<string, unknown>>;
    };
    const r = body.results?.[0];
    if (!r) return { status: "NOT_FOUND", quote: null, message: "Ativo não encontrado." };
    const str = (v: unknown): string | null =>
      typeof v === "string" && v.trim() ? v.trim() : null;
    return {
      status: "FOUND",
      quote: {
        symbol: str(r["symbol"]) ?? ticker,
        longName: str(r["longName"]),
        shortName: str(r["shortName"]),
        currency: str(r["currency"]),
        exchange: str(r["exchange"]),
        summary: str(r["summaryProfile"] && (r["summaryProfile"] as Record<string, unknown>)["longBusinessSummary"]),
      },
      message: null,
    };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return {
      status: "ERROR",
      quote: null,
      message: aborted
        ? "Tempo esgotado ao consultar o provider."
        : "Falha ao consultar o provider de mercado.",
    };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Sprint 4.11 — cotação atual (lote). Server-only.
// ---------------------------------------------------------------------------
export interface RawQuotePrice {
  symbol: string;
  price: number | null;
  currency: string | null;
  quotedAt: string | null;
  change: number | null;
  changePercent: number | null;
  marketState: string | null;
}

export interface BrapiQuotesResponse {
  status: "OK" | "ERROR" | "NOT_CONFIGURED";
  quotes: RawQuotePrice[];
  message: string | null;
}

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** Tamanho do lote aceito pelo provider (plano gratuito: 1 ativo/requisição). */
const QUOTES_PER_REQUEST = 1;
/** Requisições simultâneas ao provider. */
const QUOTES_CONCURRENCY = 4;

type ChunkOutcome =
  | { kind: "OK"; quotes: RawQuotePrice[] }
  | { kind: "NOT_CONFIGURED"; message: string }
  | { kind: "ERROR"; message: string };

function parseQuote(r: Record<string, unknown>): RawQuotePrice {
  const str = (v: unknown): string | null =>
    typeof v === "string" && v.trim() ? v.trim() : null;
  const rawDate = str(r["regularMarketTime"]);
  let quotedAt: string | null = null;
  if (rawDate) {
    const d = new Date(rawDate);
    quotedAt = Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return {
    symbol: str(r["symbol"]) ?? "",
    price: num(r["regularMarketPrice"]),
    currency: str(r["currency"]),
    quotedAt,
    change: num(r["regularMarketChange"]),
    changePercent: num(r["regularMarketChangePercent"]),
    marketState: str(r["marketState"]),
  };
}

async function fetchQuoteChunk(chunk: string[], token?: string): Promise<ChunkOutcome> {
  const url = new URL(`https://brapi.dev/api/quote/${encodeURIComponent(chunk.join(","))}`);
  if (token) url.searchParams.set("token", token);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (res.status === 401 || res.status === 403) {
      return {
        kind: "NOT_CONFIGURED",
        message:
          "Cotação indisponível: o provider exige credencial (BRAPI_TOKEN) para estes ativos.",
      };
    }
    if (res.status === 404) return { kind: "OK", quotes: [] };
    if (!res.ok) {
      return { kind: "ERROR", message: "Provider de mercado indisponível." };
    }
    const body = (await res.json()) as { results?: Array<Record<string, unknown>> };
    return { kind: "OK", quotes: (body.results ?? []).map(parseQuote) };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return {
      kind: "ERROR",
      message: aborted
        ? "Tempo esgotado ao consultar cotações."
        : "Falha ao consultar cotações no provider.",
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Consulta cotações em lote. Nunca lança: erros viram status tratado.
 * O provider gratuito aceita apenas 1 ativo por requisição, então a lista é
 * dividida em chunks e consultada com concorrência limitada.
 */
export async function fetchBrapiQuotes(tickers: string[]): Promise<BrapiQuotesResponse> {
  const list = Array.from(
    new Set(tickers.map((t) => t.trim().toUpperCase()).filter(Boolean)),
  );
  if (list.length === 0) return { status: "OK", quotes: [], message: null };

  const token = process.env["BRAPI_TOKEN"];
  const chunks: string[][] = [];
  for (let i = 0; i < list.length; i += QUOTES_PER_REQUEST) {
    chunks.push(list.slice(i, i + QUOTES_PER_REQUEST));
  }

  const outcomes: ChunkOutcome[] = new Array(chunks.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(QUOTES_CONCURRENCY, chunks.length) },
    async () => {
      while (cursor < chunks.length) {
        const index = cursor++;
        outcomes[index] = await fetchQuoteChunk(chunks[index] as string[], token);
      }
    },
  );
  await Promise.all(workers);

  const quotes = outcomes.flatMap((o) => (o?.kind === "OK" ? o.quotes : []));
  if (quotes.length > 0) return { status: "OK", quotes, message: null };

  const notConfigured = outcomes.find((o) => o?.kind === "NOT_CONFIGURED");
  if (notConfigured && notConfigured.kind === "NOT_CONFIGURED") {
    return { status: "NOT_CONFIGURED", quotes: [], message: notConfigured.message };
  }
  const failed = outcomes.find((o) => o?.kind === "ERROR");
  if (failed && failed.kind === "ERROR") {
    return { status: "ERROR", quotes: [], message: failed.message };
  }
  return { status: "OK", quotes: [], message: null };

}

// ---------------------------------------------------------------------------
// Sprint 4.11.1 — diagnóstico da integração (Configurações → Integrações).
// Nunca retorna o token nem parte dele; apenas se está configurado.
// ---------------------------------------------------------------------------
export type MarketIntegrationStatus =
  | "OK"
  | "NOT_CONFIGURED"
  | "INVALID_TOKEN"
  | "NOT_FOUND"
  | "TIMEOUT"
  | "UNAVAILABLE";

export interface MarketIntegrationDiagnosis {
  provider: string;
  tokenConfigured: boolean;
  status: MarketIntegrationStatus;
  httpStatus: number | null;
  /** Código técnico devolvido pelo provider (ex.: MISSING_TOKEN). */
  providerCode: string | null;
  message: string;
  ticker: string;
  price: number | null;
  currency: string | null;
  checkedAt: string;
}

/** Executa uma consulta real e traduz a causa da falha (sem mascarar). */
export async function diagnoseBrapi(rawTicker = "WEGE3"): Promise<MarketIntegrationDiagnosis> {
  const ticker = rawTicker.trim().toUpperCase() || "WEGE3";
  const token = process.env["BRAPI_TOKEN"];
  const base: Omit<MarketIntegrationDiagnosis, "status" | "message"> = {
    provider: "brapi.dev",
    tokenConfigured: Boolean(token),
    httpStatus: null,
    providerCode: null,
    ticker,
    price: null,
    currency: null,
    checkedAt: new Date().toISOString(),
  };

  const url = new URL(`https://brapi.dev/api/quote/${encodeURIComponent(ticker)}`);
  if (token) url.searchParams.set("token", token);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    const body = (await res.json().catch(() => ({}))) as {
      results?: Array<Record<string, unknown>>;
      code?: string;
      message?: string;
    };
    const providerCode = typeof body.code === "string" ? body.code : null;

    if (res.status === 401 || res.status === 403) {
      const missing = providerCode === "MISSING_TOKEN" || !token;
      return {
        ...base,
        httpStatus: res.status,
        providerCode,
        status: missing ? "NOT_CONFIGURED" : "INVALID_TOKEN",
        message: missing
          ? "BRAPI_TOKEN não configurado — o provider exige credencial para este ativo."
          : "Token inválido ou não autorizado para este plano.",
      };
    }
    if (res.status === 404) {
      return {
        ...base,
        httpStatus: 404,
        providerCode,
        status: "NOT_FOUND",
        message: "Ticker não encontrado no provider.",
      };
    }
    if (!res.ok) {
      return {
        ...base,
        httpStatus: res.status,
        providerCode,
        status: "UNAVAILABLE",
        message: "BRAPI indisponível no momento.",
      };
    }
    const r = body.results?.[0];
    const price = r ? num(r["regularMarketPrice"]) : null;
    if (!r || price === null) {
      return {
        ...base,
        httpStatus: res.status,
        providerCode,
        status: "NOT_FOUND",
        message: "Consulta respondida, mas sem cotação para este ticker.",
      };
    }
    return {
      ...base,
      httpStatus: res.status,
      providerCode,
      status: "OK",
      price,
      currency: typeof r["currency"] === "string" ? (r["currency"] as string) : "BRL",
      message: "Conexão funcionando — cotação recebida.",
    };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return {
      ...base,
      status: aborted ? "TIMEOUT" : "UNAVAILABLE",
      message: aborted
        ? "Tempo limite excedido ao consultar a BRAPI."
        : "Falha de rede ao consultar a BRAPI.",
    };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Sprint 4.12 — histórico de preços (série diária). Server-only.
// Endpoint BRAPI: GET /api/quote/{TICKER}?range=<r>&interval=1d
// O token nunca sai do servidor.
// ---------------------------------------------------------------------------
export interface RawHistoricalPrice {
  date: string; // YYYY-MM-DD
  close: number;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
}

export interface BrapiHistoricalResponse {
  status: "OK" | "NOT_FOUND" | "NO_DATA" | "ERROR" | "NOT_CONFIGURED";
  ticker: string;
  points: RawHistoricalPrice[];
  message: string | null;
}

/** Converte o intervalo pedido no parâmetro `range` aceito pela BRAPI. */
function brapiRangeParam(from: string, to: string): string {
  const fromMs = new Date(`${from}T00:00:00Z`).getTime();
  const toMs = new Date(`${to}T00:00:00Z`).getTime();
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) return "3mo";
  const days = Math.max(1, Math.round((toMs - fromMs) / 86400000));
  if (days <= 32) return "1mo";
  if (days <= 95) return "3mo";
  if (days <= 185) return "6mo";
  if (days <= 370) return "1y";
  if (days <= 740) return "2y";
  if (days <= 1830) return "5y";
  return "max";
}

/**
 * Busca o histórico diário de um ticker na BRAPI e filtra para o intervalo
 * [from, to] (YYYY-MM-DD). Nunca lança: erros viram status tratado.
 */
export async function fetchBrapiHistorical(
  rawTicker: string,
  range: { from: string; to: string },
): Promise<BrapiHistoricalResponse> {
  const ticker = rawTicker.trim().toUpperCase();
  const token = process.env["BRAPI_TOKEN"];
  const url = new URL(`https://brapi.dev/api/quote/${encodeURIComponent(ticker)}`);
  url.searchParams.set("range", brapiRangeParam(range.from, range.to));
  url.searchParams.set("interval", "1d");
  if (token) url.searchParams.set("token", token);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (res.status === 401 || res.status === 403) {
      return {
        status: "NOT_CONFIGURED",
        ticker,
        points: [],
        message: "Histórico indisponível: o provider exige credencial (BRAPI_TOKEN).",
      };
    }
    if (res.status === 404) {
      return { status: "NOT_FOUND", ticker, points: [], message: "Ativo não encontrado." };
    }
    if (!res.ok) {
      return {
        status: "ERROR",
        ticker,
        points: [],
        message: "Provider de mercado indisponível.",
      };
    }
    const body = (await res.json()) as {
      results?: Array<Record<string, unknown>>;
    };
    const r = body.results?.[0];
    if (!r) {
      return { status: "NOT_FOUND", ticker, points: [], message: "Ativo não encontrado." };
    }
    const raw = Array.isArray(r["historicalDataPrice"])
      ? (r["historicalDataPrice"] as Array<Record<string, unknown>>)
      : [];

    const points: RawHistoricalPrice[] = [];
    for (const p of raw) {
      const ts = num(p["date"]);
      const close = num(p["close"]);
      if (ts === null || close === null) continue;
      // BRAPI devolve `date` em segundos (unix).
      const date = new Date(ts * 1000).toISOString().slice(0, 10);
      if (date < range.from || date > range.to) continue;
      points.push({
        date,
        close,
        open: num(p["open"]),
        high: num(p["high"]),
        low: num(p["low"]),
        volume: num(p["volume"]),
      });
    }
    // Ordena e remove datas duplicadas (a última ocorrência prevalece).
    const byDate = new Map(points.map((p) => [p.date, p] as const));
    const series = Array.from(byDate.values()).sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
    );
    if (series.length === 0) {
      return {
        status: "NO_DATA",
        ticker,
        points: [],
        message: "Sem dados históricos para o período solicitado.",
      };
    }
    return { status: "OK", ticker, points: series, message: null };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return {
      status: "ERROR",
      ticker,
      points: [],
      message: aborted
        ? "Tempo esgotado ao consultar o histórico."
        : "Falha ao consultar o histórico no provider.",
    };
  } finally {
    clearTimeout(timer);
  }
}
