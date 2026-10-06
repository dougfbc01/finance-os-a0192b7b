// Correção de cotações: cada ativo mantém sua própria última cotação.
import { describe, it, expect, vi } from "vitest";
import { MarketQuoteStoreServiceImpl } from "@/services/MarketQuoteStoreService";
import { MarketDataServiceImpl } from "@/services/MarketDataService";
import type { MarketQuoteResult } from "@/models/MarketData";

const found = (ticker: string, price: number): MarketQuoteResult => ({
  status: "FOUND",
  ticker,
  message: null,
  quote: {
    ticker, price, currency: "BRL", quotedAt: null, change: null,
    changePercent: null, marketState: null, provider: "mock",
  },
});

describe("Cotações por ativo", () => {
  it("atualizar um ativo não altera as cotações dos outros", () => {
    const prev = { WEGE3: found("WEGE3", 35), ITSA3: found("ITSA3", 10) };
    const next = MarketQuoteStoreServiceImpl.merge(prev, { WEGE3: found("WEGE3", 40) });
    expect(next.WEGE3?.quote?.price).toBe(40);
    expect(next.ITSA3?.quote?.price).toBe(10);
  });

  it("falha na consulta mantém a última cotação salva do ativo", () => {
    const prev = { WEGE3: found("WEGE3", 35) };
    const next = MarketQuoteStoreServiceImpl.merge(prev, {
      WEGE3: { status: "ERROR", ticker: "WEGE3", quote: null, message: "falhou" },
    });
    expect(next.WEGE3?.quote?.price).toBe(35);
  });

  it("carrega a cotação salva mais recente de cada ativo", () => {
    const map = MarketQuoteStoreServiceImpl.latestFromRows([
      { ticker: "WEGE3", close_price: 30, provider: "p", fetched_at: "2026-10-01T10:00:00Z", price_date: "2026-10-01" },
      { ticker: "WEGE3", close_price: 36, provider: "p", fetched_at: "2026-10-05T10:00:00Z", price_date: "2026-10-05" },
      { ticker: "ITSA3", close_price: 11, provider: "p", fetched_at: "2026-09-01T10:00:00Z", price_date: "2026-09-01" },
    ]);
    expect(map.WEGE3?.quote?.price).toBe(36);
    expect(map.ITSA3?.quote?.price).toBe(11);
  });

  it("consulta somente o ativo pedido e permite atualizações seguidas", async () => {
    const spy = vi.fn(async (ts: string[]) => ts.map((t) => found(t, 10)));
    const svc = new MarketDataServiceImpl({ name: "m", lookup: vi.fn(), getQuotes: spy });
    await svc.getQuotes(["WEGE3", "ITSA3"]);
    await svc.refreshQuotes(["WEGE3"]);
    await svc.refreshQuotes(["WEGE3"]);
    expect(spy).toHaveBeenNthCalledWith(2, ["WEGE3"]);
    expect(spy).toHaveBeenCalledTimes(3);
  });
});
