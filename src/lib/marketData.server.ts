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

/** Consulta cotações em lote. Nunca lança: erros viram status tratado. */
export async function fetchBrapiQuotes(tickers: string[]): Promise<BrapiQuotesResponse> {
  const list = Array.from(
    new Set(tickers.map((t) => t.trim().toUpperCase()).filter(Boolean)),
  );
  if (list.length === 0) return { status: "OK", quotes: [], message: null };

  const token = process.env["BRAPI_TOKEN"];
  const url = new URL(`https://brapi.dev/api/quote/${encodeURIComponent(list.join(","))}`);
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
        quotes: [],
        message:
          "Cotação indisponível: o provider exige credencial (BRAPI_TOKEN) para estes ativos.",
      };
    }
    if (res.status === 404) return { status: "OK", quotes: [], message: null };
    if (!res.ok) {
      return { status: "ERROR", quotes: [], message: "Provider de mercado indisponível." };
    }
    const body = (await res.json()) as { results?: Array<Record<string, unknown>> };
    const results = body.results ?? [];
    const quotes: RawQuotePrice[] = results.map((r) => {
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
    });
    return { status: "OK", quotes, message: null };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return {
      status: "ERROR",
      quotes: [],
      message: aborted
        ? "Tempo esgotado ao consultar cotações."
        : "Falha ao consultar cotações no provider.",
    };
  } finally {
    clearTimeout(timer);
  }
}
