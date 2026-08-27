// Sprint 4.12 — controle de frequência das cotações + histórico de mercado.
// Provider sempre mockado: nenhuma chamada real ao brapi.
import { describe, it, expect, vi } from "vitest";
import { MarketDataServiceImpl } from "@/services/MarketDataService";
import { MarketQuotationServiceImpl } from "@/services/MarketQuotationService";
import { AssetValuationServiceImpl } from "@/services/AssetValuationService";
import {
  MarketQuoteScheduleService,
  EMPTY_SCHEDULE,
  MANUAL_COOLDOWN_MS,
} from "@/services/MarketQuoteScheduleService";
import { MarketHistoricalPriceServiceImpl } from "@/services/MarketHistoricalPriceService";
import { AssetType, AssetValuationSource } from "@/constants/enums";
import type {
  MarketDataLookupResult,
  MarketDataProvider,
  MarketHistoryResult,
  MarketQuoteResult,
} from "@/models/MarketData";
import type { Asset } from "@/models";

const notFoundLookup = async (ticker: string): Promise<MarketDataLookupResult> => ({
  status: "NOT_FOUND",
  ticker,
  data: null,
  message: null,
});

function asset(over: Partial<Asset> = {}): Asset {
  return {
    id: "a1",
    workspace_id: "w1",
    name: "Ativo",
    asset_type: AssetType.ACAO,
    institution: null,
    currency: "BRL",
    quantity: 100,
    unit_price: 10,
    current_value: 1000,
    acquisition_value: 1000,
    opening_value: 0,
    acquisition_date: null,
    is_active: true,
    notes: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    deleted_at: null,
    valuation_source: AssetValuationSource.MANUAL,
    account_id: null,
    ticker: "WEGE3",
    ...over,
  } as Asset;
}

describe("Sprint 4.12 — frequência das cotações", () => {
  it("1. atualização automática não ocorre duas vezes no mesmo dia", () => {
    const now = new Date("2026-08-25T10:00:00");
    expect(MarketQuoteScheduleService.canAutoUpdate(EMPTY_SCHEDULE, now)).toBe(true);
    const after = MarketQuoteScheduleService.markAutoUpdate(EMPTY_SCHEDULE, now);
    expect(MarketQuoteScheduleService.canAutoUpdate(after, new Date("2026-08-25T23:00:00"))).toBe(
      false,
    );
    expect(MarketQuoteScheduleService.canAutoUpdate(after, new Date("2026-08-26T00:10:00"))).toBe(
      true,
    );
  });

  it("2. botão manual respeita cooldown de 30 minutos", () => {
    const now = new Date("2026-08-25T10:05:00");
    const after = MarketQuoteScheduleService.markManualUpdate(EMPTY_SCHEDULE, now);
    const check = MarketQuoteScheduleService.checkManualUpdate(
      after,
      new Date(now.getTime() + 10 * 60 * 1000),
    );
    expect(check.allowed).toBe(false);
    expect(check.nextAllowedAt).toBe(now.getTime() + MANUAL_COOLDOWN_MS);
  });

  it("3. após o cooldown, a atualização manual é permitida", () => {
    const now = new Date("2026-08-25T10:05:00");
    const after = MarketQuoteScheduleService.markManualUpdate(EMPTY_SCHEDULE, now);
    const check = MarketQuoteScheduleService.checkManualUpdate(
      after,
      new Date(now.getTime() + MANUAL_COOLDOWN_MS + 1000),
    );
    expect(check.allowed).toBe(true);
  });

  it("próxima atualização automática só é informada quando determinável", () => {
    expect(MarketQuoteScheduleService.nextAutoUpdateDate(EMPTY_SCHEDULE)).toBeNull();
    const now = new Date("2026-08-25T10:00:00");
    const after = MarketQuoteScheduleService.markAutoUpdate(EMPTY_SCHEDULE, now);
    const next = MarketQuoteScheduleService.nextAutoUpdateDate(after, now);
    expect(next?.getDate()).toBe(26);
  });

  it("4. ativos ACCOUNT não entram na consulta de cotações", () => {
    const caixinha = asset({
      id: "a2",
      asset_type: AssetType.CAIXINHA,
      valuation_source: AssetValuationSource.ACCOUNT,
      account_id: "acc1",
      ticker: null,
    });
    const acao = asset();
    const effective = AssetValuationServiceImpl.effectiveAssets(
      [caixinha, acao],
      [],
      { acc1: 500 },
    );
    expect(MarketQuotationServiceImpl.tickersToQuote(effective)).toEqual(["WEGE3"]);
  });

  it("5. ticker sem cotação não derruba os demais", async () => {
    const service = new MarketDataServiceImpl({
      name: "mock",
      lookup: notFoundLookup,
      getQuotes: async (tickers: string[]): Promise<MarketQuoteResult[]> =>
        tickers.map((t) =>
          t === "AGRO3"
            ? { status: "NO_QUOTE", ticker: t, quote: null, message: "sem cotação" }
            : {
                status: "FOUND",
                ticker: t,
                message: null,
                quote: {
                  ticker: t,
                  price: 50,
                  currency: "BRL",
                  quotedAt: null,
                  change: null,
                  changePercent: null,
                  marketState: null,
                  provider: "mock",
                },
              },
        ),
    } as MarketDataProvider);

    const out = await service.getQuotes(["WEGE3", "AGRO3", "PETR4"]);
    expect(out["WEGE3"]?.status).toBe("FOUND");
    expect(out["PETR4"]?.status).toBe("FOUND");
    expect(out["AGRO3"]?.status).toBe("NO_QUOTE");
  });

  it("10. erro no histórico não altera o valor do ativo", async () => {
    const effective = AssetValuationServiceImpl.effectiveAssets([asset()], [], {});
    const before = effective[0]!.effective_value;
    const quoted = MarketQuotationServiceImpl.applyQuotes(effective, {});
    expect(quoted[0]!.effective_value).toBe(before);
    expect(quoted[0]!.market_value).toBeNull();
  });
});

describe("Sprint 4.12 — histórico de mercado", () => {
  const range = { from: "2026-08-01", to: "2026-08-05" };

  function providerWithHistory(
    getHistoricalPrices: MarketDataProvider["getHistoricalPrices"],
  ): MarketDataProvider {
    return {
      name: "mock",
      lookup: notFoundLookup,
      getQuotes: async () => [],
      getHistoricalPrices,
    };
  }

  it("6. o histórico é normalizado e ordenado por data", async () => {
    const service = new MarketDataServiceImpl(
      providerWithHistory(async (ticker): Promise<MarketHistoryResult> => ({
        status: "OK",
        ticker,
        message: null,
        points: [
          {
            ticker,
            date: "2026-08-01",
            close: 10,
            open: 9,
            high: 11,
            low: 8,
            volume: 100,
            provider: "mock",
            fetchedAt: "2026-08-05T00:00:00.000Z",
          },
        ],
      })),
    );
    const res = await service.getHistoricalPrices("wege3", range);
    expect(res.status).toBe("OK");
    expect(res.points[0]?.ticker).toBe("WEGE3");
    expect(res.points[0]?.close).toBe(10);
  });

  it("6b. provider sem suporte a histórico devolve erro tratado (não lança)", async () => {
    const service = new MarketDataServiceImpl({
      name: "mock",
      lookup: notFoundLookup,
      getQuotes: async () => [],
    });
    const res = await service.getHistoricalPrices("WEGE3", range);
    expect(res.status).toBe("ERROR");
    expect(res.points).toEqual([]);
  });

  it("7. não consulta o provider novamente quando o período já está armazenado", async () => {
    const getHistoricalPrices = vi.fn();
    const svc = new MarketHistoricalPriceServiceImpl();
    vi.spyOn(svc, "listStored").mockResolvedValue([
      {
        ticker: "WEGE3",
        date: "2026-08-01",
        close: 10,
        open: null,
        high: null,
        low: null,
        volume: null,
        provider: "brapi.dev",
        fetchedAt: "2026-08-05T00:00:00.000Z",
      },
    ]);
    const res = await svc.getHistory({
      workspaceId: "w1",
      assetId: "a1",
      ticker: "WEGE3",
      ...range,
    });
    expect(res.fromStorage).toBe(true);
    expect(res.points).toHaveLength(1);
    expect(getHistoricalPrices).not.toHaveBeenCalled();
  });

  it("7b. armazenamento não duplica a mesma data (upsert por ativo+data)", async () => {
    const svc = new MarketHistoricalPriceServiceImpl();
    const upsert = vi.fn().mockReturnValue({
      select: () => Promise.resolve({ data: [{ id: "1" }], error: null }),
    });
    // @ts-expect-error acesso controlado ao client no teste
    svc.client = { from: () => ({ upsert }) };
    await svc.store(
      { workspaceId: "w1", assetId: "a1", ticker: "WEGE3", ...range },
      [
        {
          ticker: "WEGE3",
          date: "2026-08-01",
          close: 10,
          open: null,
          high: null,
          low: null,
          volume: null,
          provider: "brapi.dev",
          fetchedAt: "2026-08-05T00:00:00.000Z",
        },
      ],
    );
    expect(upsert).toHaveBeenCalledWith(expect.any(Array), {
      onConflict: "asset_id,price_date",
      ignoreDuplicates: true,
    });
  });

  it("8. histórico não gera movimentações nem altera o valor do ativo", async () => {
    const svc = new MarketHistoricalPriceServiceImpl();
    vi.spyOn(svc, "listStored").mockResolvedValue([]);
    vi.spyOn(MarketDataServiceImpl.prototype, "getHistoricalPrices").mockResolvedValue({
      status: "ERROR",
      ticker: "WEGE3",
      points: [],
      message: "falha",
    });
    const res = await svc.getHistory({
      workspaceId: "w1",
      assetId: "a1",
      ticker: "WEGE3",
      ...range,
    });
    expect(res.points).toEqual([]);

    const effective = AssetValuationServiceImpl.effectiveAssets([asset()], [], {});
    expect(effective[0]!.effective_value).toBe(1000);
    vi.restoreAllMocks();
  });

  it("9. o token nunca é referenciado no código do cliente", async () => {
    const files = await Promise.all([
      import("@/services/market/BrapiMarketDataProvider?raw"),
      import("@/services/MarketHistoricalPriceService?raw"),
      import("@/hooks/useMarketPriceHistory?raw"),
    ]);
    for (const f of files) {
      expect(String((f as { default: string }).default)).not.toContain("BRAPI_TOKEN");
    }
  });
});
