import { describe, it, expect, vi } from "vitest";
import { MarketDataServiceImpl } from "@/services/MarketDataService";
import { inferAssetType, normalizeTicker } from "@/services/market/tickerMapping";
import { AssetType, AssetValuationSource } from "@/constants/enums";
import type { MarketDataLookupResult, MarketDataProvider } from "@/models/MarketData";
import type { Asset } from "@/models";

function found(ticker: string, name: string, type: AssetType | null): MarketDataLookupResult {
  return {
    status: "FOUND",
    ticker,
    message: null,
    data: {
      ticker,
      name,
      assetType: type,
      description: "Perfil da companhia",
      exchange: "B3",
      currency: "BRL",
      provider: "mock",
    },
  };
}

function mockProvider(impl: (t: string) => Promise<MarketDataLookupResult>): MarketDataProvider {
  return { name: "mock", lookup: impl };
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
    acquisition_date: null,
    is_active: true,
    notes: null,
    valuation_source: AssetValuationSource.MOVEMENTS,
    account_id: null,
    opening_value: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    ...partial,
  } as Asset;
}

describe("Sprint 4.10 — cadastro inteligente por ticker", () => {
  it("1. retorna dados quando o ticker é encontrado", async () => {
    const svc = new MarketDataServiceImpl(
      mockProvider(async (t) => found(t, "WEG S.A.", AssetType.ACAO)),
    );
    const res = await svc.lookup(" wege3 ");
    expect(res.status).toBe("FOUND");
    expect(res.data?.ticker).toBe("WEGE3");
    expect(res.data?.name).toBe("WEG S.A.");
  });

  it("2. mapeia tipos externos para os enums existentes", () => {
    expect(inferAssetType("WEGE3", "WEG S.A.")).toBe(AssetType.ACAO);
    expect(inferAssetType("petr4", "Petrobras PN")).toBe(AssetType.ACAO);
    expect(inferAssetType("HGLG11", "CSHG Logistica FII")).toBe(AssetType.FII);
    expect(inferAssetType("BOVA11", "iShares Ibovespa ETF")).toBe(AssetType.ETF);
    expect(inferAssetType("AAPL34", "Apple BDR")).toBe(AssetType.BDR);
    // Ambíguo: units 11 sem pista no nome não devem inventar tipo.
    expect(inferAssetType("SANB11", "Banco Santander Unit")).toBeNull();
    expect(normalizeTicker(" hglg11 ")).toBe("HGLG11");
  });

  it("3. informa ticker não encontrado sem quebrar o fluxo", async () => {
    const svc = new MarketDataServiceImpl(
      mockProvider(async (t) => ({
        status: "NOT_FOUND",
        ticker: t,
        data: null,
        message: "Ativo não encontrado.",
      })),
    );
    const res = await svc.lookup("XXXX9");
    expect(res.status).toBe("NOT_FOUND");
    expect(res.data).toBeNull();
    expect(res.message).toContain("não encontrado");
  });

  it("4. trata erro/timeout do provider", async () => {
    const svc = new MarketDataServiceImpl(
      mockProvider(async () => {
        throw new Error("timeout");
      }),
    );
    const res = await svc.lookup("WEGE3");
    expect(res.status).toBe("ERROR");
    expect(res.data).toBeNull();
  });

  it("4b. erro não é cacheado; sucesso é cacheado e evita chamadas duplicadas", async () => {
    const spy = vi.fn(async (t: string) => found(t, "WEG S.A.", AssetType.ACAO));
    const svc = new MarketDataServiceImpl(mockProvider(spy));
    const [a, b] = await Promise.all([svc.lookup("WEGE3"), svc.lookup("wege3")]);
    expect(a.status).toBe("FOUND");
    expect(b.status).toBe("FOUND");
    const third = await svc.lookup("WEGE3");
    expect(third.cached).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("5/6. a busca não cria ativo e os dados podem ser editados antes de salvar", async () => {
    const created: unknown[] = [];
    const svc = new MarketDataServiceImpl(
      mockProvider(async (t) => found(t, "WEG S.A.", AssetType.ACAO)),
    );
    const res = await svc.lookup("WEGE3");
    expect(created).toHaveLength(0); // nenhum efeito colateral de persistência

    // A prévia é apenas um objeto: o formulário pode sobrescrever qualquer campo.
    const draft = { ...res.data!, name: "WEG - carteira longo prazo", assetType: AssetType.FUNDO };
    expect(draft.name).toBe("WEG - carteira longo prazo");
    expect(draft.assetType).toBe(AssetType.FUNDO);
    expect(res.data?.name).toBe("WEG S.A.");
  });

  it("7. detecta ticker duplicado dentro do workspace", () => {
    const svc = new MarketDataServiceImpl(mockProvider(async (t) => found(t, "WEG", null)));
    const existing = svc.findExistingByTicker([asset({})], "wege3", "w1");
    expect(existing?.id).toBe("a1");
    expect(svc.findExistingByTicker([asset({ deleted_at: "2026-01-02T00:00:00Z" })], "WEGE3", "w1")).toBeNull();
  });

  it("8. mesmo ticker em outro workspace não gera conflito", () => {
    const svc = new MarketDataServiceImpl(mockProvider(async (t) => found(t, "WEG", null)));
    const other = svc.findExistingByTicker([asset({ workspace_id: "w2" })], "WEGE3", "w1");
    expect(other).toBeNull();
  });

  it("9. prévia é compatível com o fluxo de histórico (MOVEMENTS) sem alterar suas regras", async () => {
    const svc = new MarketDataServiceImpl(
      mockProvider(async (t) => found(t, "CSHG Logistica FII", AssetType.FII)),
    );
    const res = await svc.lookup("HGLG11");
    const draftAsset = asset({
      ticker: res.data!.ticker,
      name: res.data!.name,
      asset_type: res.data!.assetType!,
      valuation_source: AssetValuationSource.MOVEMENTS,
    });
    expect(draftAsset.valuation_source).toBe(AssetValuationSource.MOVEMENTS);
    expect(draftAsset.ticker).toBe("HGLG11");
  });

  it("10. provider sem credencial configurada devolve estado tratável", async () => {
    const svc = new MarketDataServiceImpl(
      mockProvider(async (t) => ({
        status: "NOT_CONFIGURED",
        ticker: t,
        data: null,
        message: "Consulta indisponível.",
      })),
    );
    const res = await svc.lookup("WEGE3");
    expect(res.status).toBe("NOT_CONFIGURED");
    expect(res.data).toBeNull();
  });

  it("permite trocar o provider sem alterar os consumidores", async () => {
    const svc = new MarketDataServiceImpl(mockProvider(async (t) => found(t, "A", null)));
    expect(svc.providerName).toBe("mock");
    svc.setProvider({ name: "outro", lookup: async (t) => found(t, "B", AssetType.ETF) });
    expect(svc.providerName).toBe("outro");
    const res = await svc.lookup("BOVA11");
    expect(res.data?.name).toBe("B");
  });
});
