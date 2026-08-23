// Sprint 4.11 — cotação atual e valorização da posição.
// Provider sempre mockado: nenhuma chamada real ao brapi.
import { describe, it, expect, vi } from "vitest";
import { MarketDataServiceImpl } from "@/services/MarketDataService";
import { MarketQuotationServiceImpl } from "@/services/MarketQuotationService";
import { AssetValuationServiceImpl } from "@/services/AssetValuationService";
import { PatrimonyServiceImpl } from "@/services/PatrimonyService";
import {
  AssetType,
  AssetValuationSource,
  MovementType,
  MovementStatus,
} from "@/constants/enums";
import type {
  MarketDataLookupResult,
  MarketDataProvider,
  MarketQuoteResult,
} from "@/models/MarketData";
import type { Asset, Movement } from "@/models";

const notFoundLookup = async (ticker: string): Promise<MarketDataLookupResult> => ({
  status: "NOT_FOUND",
  ticker,
  data: null,
  message: null,
});

function provider(
  getQuotes: (tickers: string[]) => Promise<MarketQuoteResult[]>,
): MarketDataProvider {
  return { name: "mock", lookup: notFoundLookup, getQuotes };
}

function quoteOf(ticker: string, price: number): MarketQuoteResult {
  return {
    status: "FOUND",
    ticker,
    message: null,
    quote: {
      ticker,
      price,
      currency: "BRL",
      quotedAt: "2026-08-21T20:00:00.000Z",
      change: 1.5,
      changePercent: 4.5,
      marketState: "CLOSED",
      provider: "mock",
    },
  };
}

function asset(partial: Partial<Asset>): Asset {
  return {
    id: "a1",
    workspace_id: "w1",
    name: "WEG",
    asset_type: AssetType.ACAO,
    institution: null,
    ticker: "WEGE3",
    currency: "BRL",
    quantity: 0,
    unit_price: 0,
    current_value: 0,
    acquisition_value: 0,
    opening_value: 0,
    account_id: null,
    valuation_source: AssetValuationSource.MOVEMENTS,
    is_active: true,
    deleted_at: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    ...partial,
  } as Asset;
}

function buy(overrides: Partial<Movement>): Movement {
  return {
    id: "m1",
    workspace_id: "w1",
    account_id: null,
    card_id: null,
    asset_id: "a1",
    category_id: null,
    subcategory_id: null,
    description: "Compra",
    amount: 3000,
    type: MovementType.INVESTMENT,
    status: MovementStatus.PAID,
    transaction_date: "2026-01-10",
    competence_date: "2026-01-10",
    quantity: 100,
    unit_price: 30,
    is_historical: true,
    tags: [],
    deleted_at: null,
    created_at: "2026-01-10",
    updated_at: "2026-01-10",
    ...overrides,
  } as Movement;
}

describe("Sprint 4.11 — MarketDataService.getQuotes", () => {
  it("retorna a cotação encontrada normalizada", async () => {
    const svc = new MarketDataServiceImpl(
      provider(async (ts) => ts.map((t) => quoteOf(t, 35))),
    );
    const res = await svc.getQuotes(["wege3"]);
    expect(res["WEGE3"]?.status).toBe("FOUND");
    expect(res["WEGE3"]?.quote).toMatchObject({
      ticker: "WEGE3",
      price: 35,
      currency: "BRL",
      quotedAt: "2026-08-21T20:00:00.000Z",
      marketState: "CLOSED",
    });
  });

  it("trata ticker sem cotação sem virar preço zero", async () => {
    const svc = new MarketDataServiceImpl(
      provider(async (ts) =>
        ts.map((t) => ({
          status: "NO_QUOTE" as const,
          ticker: t,
          quote: null,
          message: "Cotação indisponível para este ativo.",
        })),
      ),
    );
    const res = await svc.getQuotes(["XPTO3"]);
    expect(res["XPTO3"]?.status).toBe("NO_QUOTE");
    expect(res["XPTO3"]?.quote).toBeNull();
  });

  it("trata provider indisponível e token ausente sem lançar", async () => {
    const down = new MarketDataServiceImpl(
      provider(async () => {
        throw new Error("network");
      }),
    );
    const resDown = await down.getQuotes(["WEGE3"]);
    expect(resDown["WEGE3"]?.status).toBe("ERROR");

    const noToken = new MarketDataServiceImpl(
      provider(async (ts) =>
        ts.map((t) => ({
          status: "NOT_CONFIGURED" as const,
          ticker: t,
          quote: null,
          message: "Cotação não configurada.",
        })),
      ),
    );
    const res = await noToken.getQuotes(["WEGE3"]);
    expect(res["WEGE3"]?.status).toBe("NOT_CONFIGURED");
    expect(res["WEGE3"]?.quote).toBeNull();
  });

  it("erro de um ticker não impede os demais", async () => {
    const svc = new MarketDataServiceImpl(
      provider(async (ts) =>
        ts.map((t) =>
          t === "XYZ3"
            ? { status: "ERROR" as const, ticker: t, quote: null, message: "falhou" }
            : quoteOf(t, 10),
        ),
      ),
    );
    const res = await svc.getQuotes(["WEGE3", "PETR4", "XYZ3"]);
    expect(res["WEGE3"]?.status).toBe("FOUND");
    expect(res["PETR4"]?.status).toBe("FOUND");
    expect(res["XYZ3"]?.status).toBe("ERROR");
  });

  it("cache e deduplicação evitam chamadas repetidas ao provider", async () => {
    const spy = vi.fn(async (ts: string[]) => ts.map((t) => quoteOf(t, 35)));
    const svc = new MarketDataServiceImpl(provider(spy));

    const [a, b] = await Promise.all([
      svc.getQuotes(["WEGE3", "WEGE3"]),
      svc.getQuotes(["wege3"]),
    ]);
    expect(a["WEGE3"]?.status).toBe("FOUND");
    expect(b["WEGE3"]?.status).toBe("FOUND");
    expect(spy).toHaveBeenCalledTimes(1);

    await svc.getQuotes(["WEGE3"]);
    expect(spy).toHaveBeenCalledTimes(1);

    svc.clearQuoteCache();
    await svc.getQuotes(["WEGE3"]);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe("Sprint 4.11 — valorização da posição", () => {
  const movements = [buy({})];

  function effective(a: Asset, balances: Record<string, number> = {}) {
    return AssetValuationServiceImpl.effectiveAssets([a], movements, balances);
  }

  it("usa a quantidade reconstruída pelo AssetValuationService", () => {
    const [eff] = effective(asset({}));
    expect(eff!.effective_quantity).toBe(100);
    expect(eff!.position.cost).toBe(3000);
    expect(MarketQuotationServiceImpl.tickersToQuote([eff!])).toEqual(["WEGE3"]);
  });

  it("valor atual = quantidade × cotação, com valorização em R$ e %", () => {
    const [eff] = effective(asset({}));
    const [q] = MarketQuotationServiceImpl.applyQuotes([eff!], {
      WEGE3: quoteOf("WEGE3", 35),
    });
    expect(q!.cost_basis).toBe(3000);
    expect(q!.market_value).toBe(3500);
    expect(q!.current_value).toBe(3500);
    expect(q!.appreciation).toBe(500);
    expect(q!.appreciation_percent).toBeCloseTo(16.67, 2);
  });

  it("sem cotação mantém o valor da origem e não zera o patrimônio", () => {
    const [eff] = effective(asset({}));
    const [q] = MarketQuotationServiceImpl.applyQuotes([eff!], {
      WEGE3: { status: "ERROR", ticker: "WEGE3", quote: null, message: "falhou" },
    });
    expect(q!.market_value).toBeNull();
    expect(q!.current_value).toBe(eff!.effective_value);
    expect(q!.appreciation).toBeNull();
  });

  it("ativo MANUAL sem ticker continua com o valor informado", () => {
    const manual = asset({
      id: "a2",
      valuation_source: AssetValuationSource.MANUAL,
      asset_type: AssetType.CDB,
      ticker: null,
      current_value: 5000,
      acquisition_value: 4000,
    });
    const [eff] = AssetValuationServiceImpl.effectiveAssets([manual], [], {});
    const [q] = MarketQuotationServiceImpl.applyQuotes([eff!], {
      WEGE3: quoteOf("WEGE3", 35),
    });
    expect(q!.quotable).toBe(false);
    expect(q!.current_value).toBe(5000);
    expect(q!.market_value).toBeNull();
  });

  it("ativo ACCOUNT (caixinha) não recebe cotação e não conta em dobro", () => {
    const caixinha = asset({
      id: "a3",
      valuation_source: AssetValuationSource.ACCOUNT,
      asset_type: AssetType.ACAO,
      ticker: "WEGE3",
      account_id: "acc1",
    });
    const [eff] = AssetValuationServiceImpl.effectiveAssets([caixinha], [], { acc1: 900 });
    const [q] = MarketQuotationServiceImpl.applyQuotes([eff!], {
      WEGE3: quoteOf("WEGE3", 35),
    });
    expect(q!.quotable).toBe(false);
    expect(q!.market_value).toBeNull();
    expect(q!.current_value).toBe(900);
    expect(PatrimonyServiceImpl.totalAssetsValue([q!])).toBe(0);
  });

  it("cotação não cria movimentação e não altera as operações do ativo", () => {
    const [eff] = effective(asset({}));
    const before = JSON.stringify(movements);
    MarketQuotationServiceImpl.applyQuotes([eff!], { WEGE3: quoteOf("WEGE3", 35) });
    expect(JSON.stringify(movements)).toBe(before);
    expect(movements.every((m) => m.is_historical)).toBe(true);
  });

  it("composição patrimonial usa o valor de mercado e bate com o snapshot", () => {
    const [eff] = effective(asset({}));
    const caixinhaSrc = asset({
      id: "a3",
      name: "Caixinha",
      valuation_source: AssetValuationSource.ACCOUNT,
      asset_type: AssetType.CAIXINHA,
      ticker: null,
      account_id: "acc1",
    });
    const [caixinha] = AssetValuationServiceImpl.effectiveAssets([caixinhaSrc], [], {
      acc1: 1000,
    });
    const quoted = MarketQuotationServiceImpl.applyQuotes([eff!, caixinha!], {
      WEGE3: quoteOf("WEGE3", 35),
    });

    const accounts = [{ id: "acc1", name: "Nubank", institution: "Nubank" }];
    const balances = { acc1: 1000 };
    const composition = PatrimonyServiceImpl.composition({
      accounts,
      balances,
      assets: quoted,
    });
    const snapshot = PatrimonyServiceImpl.snapshot({
      cashBalance: 1000,
      assets: quoted,
      invoices: [],
    });

    expect(snapshot.assets).toBe(3500);
    expect(snapshot.totalAssets).toBe(4500);
    expect(composition.total).toBe(snapshot.totalAssets);
    // A caixinha aparece uma única vez (bucket próprio, conta removida de "Contas").
    const contas = composition.buckets.find((b) => b.key === "CONTAS");
    expect(contas).toBeUndefined();
  });
});
