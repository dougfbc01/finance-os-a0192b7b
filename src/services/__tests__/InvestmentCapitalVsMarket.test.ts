import { describe, it, expect } from "vitest";
import { AssetType, AssetValuationSource, MovementType, MovementStatus } from "@/constants/enums";
import type { Asset, Movement } from "@/models";
import type { MarketPricePoint } from "@/models/MarketData";
import { capitalVsMarketMonthly } from "../InvestmentAnalysisService";
import { AssetValuationServiceImpl } from "../AssetValuationService";

const asset: Asset = { id: "a", workspace_id: "w", name: "A", asset_type: AssetType.ACAO, ticker: "TEST3", institution: null, currency: "BRL", quantity: 100, unit_price: 10, current_value: 1000, acquisition_value: 1000, acquisition_date: null, is_active: true, notes: null, valuation_source: AssetValuationSource.MOVEMENTS, account_id: null, opening_value: 0, created_at: "", updated_at: "", deleted_at: null };
const movement = (override: Partial<Movement> = {}): Movement => ({ id: "buy", workspace_id: "w", account_id: null, transfer_account_id: null, category_id: null, subcategory_id: null, card_id: null, asset_id: "a", import_id: null, transfer_group_id: null, type: MovementType.INVESTMENT, status: MovementStatus.CLEARED, description: "Compra", notes: null, amount: 100, transaction_date: "2026-01-15", competence_date: null, due_date: null, tags: ["op:APORTE"], attachments: [], created_at: "", updated_at: "", deleted_at: null, duplicate_hash: null, invoice_id: null, is_historical: true, quantity: 10, unit_price: 10, external_ref: null, ...override });
const price = (date: string, close: number): MarketPricePoint => ({ ticker: "TEST3", date, close, open: null, high: null, low: null, volume: null, provider: "test", fetchedAt: date });
const params = () => ({ assets: [asset], movements: [movement()], prices: { a: [price("2026-01-02", 11), price("2026-01-30", 12)] }, from: "2026-01-01", to: "2026-03-20" });

describe("Comparativo capital × mercado no fim do mês", () => {
  it("inclui compra no meio do mês e usa a última cotação dentro do mês", () => {
    const result = capitalVsMarketMonthly(params());
    expect(result[0]).toMatchObject({ date: "2026-01-31", capitalTotal: 100, valorMercadoAvaliados: 120, custoAvaliados: 100, ganhoNaoRealizado: 20, ganhoPct: 20, ativosAvaliados: 1, ativosComPosicao: 1, cobertura: 1, coberturaCapital: 1, completo: true });
    expect(result[0]?.assets[0]).toMatchObject({ quantity: 10, cost: 100, quoteDate: "2026-01-30", status: "MARKET" });
  });
  it("compra e venda parcial usam o preço médio de positionOf", () => {
    const input = params();
    input.movements.push(movement({ id: "second", amount: 200, transaction_date: "2026-01-16" }), movement({ id: "sale", tags: ["op:RESGATE"], amount: 90, quantity: 5, transaction_date: "2026-01-20" }));
    expect(capitalVsMarketMonthly(input)[0]).toMatchObject({ capitalTotal: 225, valorMercadoAvaliados: 180, custoAvaliados: 225, ganhoNaoRealizado: -45, ganhoPct: -20 });
  });
  it("sem cotação no mês entra apenas no capital e não carrega preço de outro mês", () => {
    const result = capitalVsMarketMonthly(params());
    expect(result[1]).toMatchObject({ capitalTotal: 100, capitalSomenteCusto: 100, valorMercadoAvaliados: null, custoAvaliados: null, ganhoNaoRealizado: null, ganhoPct: null, ativosAvaliados: 0, coberturaCapital: null, completo: false });
    expect(result[1]?.assets[0]).toMatchObject({ status: "COST_ONLY", marketValue: null, quoteDate: null });
  });
  it("renda fixa permanece somente a custo mesmo com preço salvo", () => {
    const input = params(); input.assets = [{ ...asset, asset_type: AssetType.CDB }];
    expect(capitalVsMarketMonthly(input)[0]).toMatchObject({ capitalTotal: 100, capitalSomenteCusto: 100, valorMercadoAvaliados: null });
  });
  it("ativo sem ticker permanece somente a custo", () => {
    const input = params(); input.assets = [{ ...asset, ticker: null }];
    expect(capitalVsMarketMonthly(input)[0]?.assets[0]).toMatchObject({ status: "COST_ONLY", cost: 100, marketValue: null });
  });
  it("posição legitimamente encerrada vale zero sem cotação e não usa aquisição estática", () => {
    const input = params(); input.movements.push(movement({ id: "sell", transaction_date: "2026-02-15", amount: 150, tags: ["op:RESGATE"] }));
    expect(capitalVsMarketMonthly(input)[1]).toMatchObject({ capitalTotal: 0, valorMercadoAvaliados: 0, custoAvaliados: 0, ganhoNaoRealizado: 0, ativosComPosicao: 0 });
  });
  it("NO_HISTORY fica fora do capital e é contado no aviso", () => {
    const input = params(); input.assets.push({ ...asset, id: "b" }); input.movements.push(movement({ id: "b", asset_id: "b", quantity: null }));
    expect(capitalVsMarketMonthly(input)[0]).toMatchObject({ capitalTotal: 100, ativosSemHistorico: 1 });
    expect(capitalVsMarketMonthly(input)[0]?.assets[1]).toMatchObject({ status: "NO_HISTORY", cost: null, marketValue: null });
  });
  it("histórico começando por saída é insuficiente", () => {
    const input = params(); input.movements = [movement({ tags: ["op:RESGATE"] })];
    expect(capitalVsMarketMonthly(input)[0]).toMatchObject({ capitalTotal: null, valorMercadoAvaliados: null, ativosSemHistorico: 1 });
  });
  it("separa moedas sem qualquer total misturado", () => {
    const input = params(); input.assets.push({ ...asset, id: "usd", currency: "USD" }); input.movements.push(movement({ id: "usd", asset_id: "usd", amount: 50 }));
    const january = capitalVsMarketMonthly(input).filter((r) => r.month === "2026-01");
    expect(january.map((r) => [r.currency, r.capitalTotal])).toEqual([["BRL", 100], ["USD", 50]]);
  });
  it("mês corrente usa hoje e exclui movimentos e cotações futuras", () => {
    const input = params(); input.to = "2026-01-20";
    input.movements.push(movement({ id: "future", transaction_date: "2026-01-21", amount: 900 }));
    expect(capitalVsMarketMonthly(input)[0]).toMatchObject({ date: "2026-01-20", capitalTotal: 100, valorMercadoAvaliados: 110 });
  });
  it("diferença usa somente o custo dos mesmos ativos avaliados", () => {
    const input = params(); input.assets.push({ ...asset, id: "b", asset_type: AssetType.CDB }); input.movements.push(movement({ id: "b", asset_id: "b", amount: 1000 }));
    const month = capitalVsMarketMonthly(input)[0];
    expect(month).toMatchObject({ capitalTotal: 1100, capitalSomenteCusto: 1000, custoAvaliados: 100, valorMercadoAvaliados: 120, ganhoNaoRealizado: 20, ganhoPct: 20, ativosAvaliados: 1, ativosComPosicao: 2, cobertura: 0.5, completo: false });
    expect(month?.coberturaCapital).toBeCloseTo(100 / 1100, 6);
  });
  it("somas mensais batem com linhas e custo de cada ativo é o de positionOf", () => {
    const input = params(); input.assets.push({ ...asset, id: "b" }); input.movements.push(movement({ id: "b", asset_id: "b", amount: 350, quantity: 7 }));
    const before = structuredClone(input);
    for (const month of capitalVsMarketMonthly(input)) {
      expect(month.capitalTotal).toBe(month.assets.reduce((s, r) => s + (r.cost ?? 0), 0));
      for (const row of month.assets) expect(row.cost).toBe(AssetValuationServiceImpl.positionOf(row.assetId, input.movements.filter((m) => m.transaction_date <= month.date)).cost);
    }
    expect(input).toEqual(before);
  });
  it("sem movimento não inventa mês nem zero e filtros de período são respeitados", () => {
    expect(capitalVsMarketMonthly({ ...params(), movements: [] })).toEqual([]);
    expect(capitalVsMarketMonthly({ ...params(), from: "2026-02-01" }).map((r) => r.month)).toEqual(["2026-02", "2026-03"]);
  });
  it("capital zero mantém ganho absoluto e percentual indisponível", () => {
    const input = params(); input.movements = [movement({ amount: 0, tags: ["op:AJUSTE_QUANTIDADE", "qty:INCREASE"] })];
    expect(capitalVsMarketMonthly(input)[0]).toMatchObject({ capitalTotal: 0, ganhoNaoRealizado: 120, ganhoPct: null });
  });
  it("ajustes corporativos preservam custo enquanto quantidade muda", () => {
    const input = params(); input.movements.push(movement({ id: "split", amount: 0, transaction_date: "2026-01-20", tags: ["op:AJUSTE_QUANTIDADE", "qty:INCREASE"] }));
    expect(capitalVsMarketMonthly(input)[0]).toMatchObject({ capitalTotal: 100, valorMercadoAvaliados: 240, ganhoNaoRealizado: 140 });
  });
});