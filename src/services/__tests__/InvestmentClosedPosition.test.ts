// Correção — valor de ativos encerrados e de ativos sem cotação (caso Tesouro).
// Regra: posição encerrada vale 0 e tem capital 0 (nunca negativo); o lucro
// realizado já saiu como caixa e não abate o valor dos ativos abertos. Ativo
// aberto sem cotação vale o custo da posição (positionOf), rotulado "A custo".
// valueOf segue inalterado; effectiveAssets (Patrimônio/Dashboard) aplica a regra
// a ativos com histórico de quantidade. Fechamentos gravados não mudam.
import { describe, expect, it } from "vitest";
import { AssetType, AssetValuationSource, MovementStatus, MovementType } from "@/constants/enums";
import type { Asset, Movement } from "@/models";
import type { QuotedAsset } from "@/services/MarketQuotationService";
import { AssetValuationServiceImpl } from "@/services/AssetValuationService";
import { InvestmentServiceImpl } from "@/services/InvestmentService";
import { summarizeInvestments } from "@/services/InvestmentAnalysisService";

const asset = (overrides: Partial<Asset & Partial<QuotedAsset>> = {}) =>
  ({
    id: "asset-1",
    workspace_id: "workspace-1",
    name: "Tesouro Prefixado 2029",
    asset_type: AssetType.TESOURO,
    institution: "Nu Invest",
    ticker: null,
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
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    deleted_at: null,
    ...overrides,
  }) as Asset & Partial<QuotedAsset>;

let sequence = 0;
const movement = (overrides: Partial<Movement> = {}): Movement => ({
  id: `movement-${++sequence}`,
  workspace_id: "workspace-1",
  account_id: "account-1",
  transfer_account_id: null,
  category_id: null,
  subcategory_id: null,
  card_id: null,
  invoice_id: null,
  asset_id: "asset-1",
  import_id: null,
  transfer_group_id: null,
  type: MovementType.INVESTMENT,
  status: MovementStatus.CLEARED,
  description: "Aplicação",
  notes: null,
  amount: 100,
  transaction_date: "2026-01-10",
  competence_date: "2026-01-10",
  due_date: null,
  tags: ["op:APORTE"],
  attachments: [],
  duplicate_hash: null,
  is_historical: true,
  quantity: 1,
  unit_price: 100,
  external_ref: null,
  created_at: "2026-01-10",
  updated_at: "2026-01-10",
  deleted_at: null,
  ...overrides,
});

const buy = (assetId: string, amount: number, quantity: number, date: string) =>
  movement({ asset_id: assetId, amount, quantity, unit_price: amount / quantity, transaction_date: date, tags: ["op:APORTE"] });
const sell = (assetId: string, amount: number, quantity: number, date: string) =>
  movement({ asset_id: assetId, amount, quantity, unit_price: amount / quantity, transaction_date: date, type: MovementType.INCOME, tags: ["op:RESGATE"] });

describe("Ativo encerrado com lucro (resgate integral)", () => {
  const closed = asset({ id: "tesouro-fechado" });
  const movements = [
    buy("tesouro-fechado", 145.39, 1, "2024-01-10"),
    sell("tesouro-fechado", 214.76, 1, "2025-06-10"), // lucro realizado 69,37
  ];

  it("tem valor 0 e capital 0, nunca negativo", () => {
    const [row] = InvestmentServiceImpl.rows([closed], movements);
    expect(row.current).toBe(0);
    expect(row.invested).toBe(0);
    expect(row.profit).toBe(0);
    expect(row.valueOrigin).toBe("CLOSED");
  });

  it("expõe o resultado realizado separadamente, sem somar ao valor", () => {
    const [row] = InvestmentServiceImpl.rows([closed], movements);
    expect(row.realizedResult).toBeCloseTo(69.37, 2);
    expect(row.current + row.realizedResult).not.toBe(row.current);
  });

  it("positionOf permanece inalterado (custo 0, resultado realizado 69,37)", () => {
    const position = AssetValuationServiceImpl.positionOf("tesouro-fechado", movements);
    expect(position.quantity).toBe(0);
    expect(position.cost).toBe(0);
    expect(position.realizedResult).toBeCloseTo(69.37, 2);
  });

  it("valueOf/effectiveAssets (Patrimônio, Dashboard, Fechamentos) permanecem inalterados", () => {
    const impact = AssetValuationServiceImpl.impactByAsset(movements).get("tesouro-fechado")!;
    const { value } = AssetValuationServiceImpl.valueOf(closed, impact);
    expect(value).toBeCloseTo(-69.37, 2); // regra antiga intencionalmente preservada fora da aba Investimentos
  });
});

describe("Dois abertos + um encerrado com lucro (caso Tesouro)", () => {
  const open1 = asset({ id: "prefixado-2029", name: "Tesouro Prefixado 2029" });
  const open2 = asset({ id: "selic-2027", name: "Tesouro Selic 2027" });
  const closed = asset({ id: "ipca-2026", name: "Tesouro IPCA+ 2026" });
  const movements = [
    buy("prefixado-2029", 145.39, 1, "2024-01-10"),
    buy("selic-2027", 932.7, 1, "2024-02-10"),
    buy("ipca-2026", 200, 1, "2023-01-10"),
    sell("ipca-2026", 269.37, 1, "2025-06-10"), // lucro 69,37
  ];

  it("o grupo soma apenas os abertos: 1.078,09", () => {
    const rows = InvestmentServiceImpl.rows([open1, open2, closed], movements);
    const [group] = summarizeInvestments(rows);
    expect(group.current).toBeCloseTo(1078.09, 2);
    expect(group.invested).toBeCloseTo(1078.09, 2);
    expect(group.realizedResult).toBeCloseTo(69.37, 2);
    expect(group.costBasedCount).toBe(2);
  });

  it("ativos abertos sem cotação são valorizados a custo", () => {
    const rows = InvestmentServiceImpl.rows([open1, open2, closed], movements);
    const r1 = rows.find((r) => r.asset.id === "prefixado-2029")!;
    const r2 = rows.find((r) => r.asset.id === "selic-2027")!;
    expect(r1.current).toBeCloseTo(145.39, 2);
    expect(r2.current).toBeCloseTo(932.7, 2);
    expect(r1.valueOrigin).toBe("COST");
    expect(r2.valueOrigin).toBe("COST");
  });
});

describe("Ativo encerrado com prejuízo", () => {
  it("tem valor 0 e capital 0, nunca positivo residual", () => {
    const closed = asset({ id: "prejuizo" });
    const movements = [buy("prejuizo", 500, 10, "2024-01-10"), sell("prejuizo", 300, 10, "2025-01-10")];
    const [row] = InvestmentServiceImpl.rows([closed], movements);
    expect(row.current).toBe(0);
    expect(row.invested).toBe(0);
    expect(row.realizedResult).toBeCloseTo(-200, 2);
    expect(row.valueOrigin).toBe("CLOSED");
  });
});

describe("Ativo aberto com cotação de mercado", () => {
  it("continua valorizado pelo mercado, não pelo custo", () => {
    const quoted = asset({ id: "wege", asset_type: AssetType.ACAO, ticker: "WEGE3", market_value: 560 });
    const movements = [buy("wege", 500, 10, "2024-01-10")];
    const [row] = InvestmentServiceImpl.rows([quoted], movements);
    expect(row.current).toBe(560);
    expect(row.invested).toBe(500);
    expect(row.valueOrigin).toBe("MARKET");
  });
});

describe("Ativo MOVEMENTS sem nenhuma operação vinculada", () => {
  it("mantém os valores declarados (sem evidência de posição)", () => {
    const orphan = asset({ id: "orfao", current_value: 120, acquisition_value: 100 });
    const [row] = InvestmentServiceImpl.rows([orphan], []);
    expect(row.current).toBe(120);
    expect(row.invested).toBe(100);
    expect(row.valueOrigin).toBe("MANUAL");
  });
});

describe("Patrimônio (effectiveAssets): posição por quantidade encerrada vale 0", () => {
  it("Tesouro encerrado com lucro: valor 0 (antes −69,37)", () => {
    const t = asset({ id: "pat-tesouro" });
    const ops = [buy("pat-tesouro", 100, 1, "2024-01-10"), sell("pat-tesouro", 169.37, 1, "2025-01-10")];
    const [eff] = AssetValuationServiceImpl.effectiveAssets([t], ops);
    expect(eff.effective_value).toBe(0);
    expect(eff.effective_acquisition).toBe(0);
  });

  it("FII encerrado com prejuízo: valor 0 (antes +33,60)", () => {
    const f = asset({ id: "pat-fii", asset_type: AssetType.FII, ticker: "BCFF11" });
    const ops = [buy("pat-fii", 133.6, 2, "2022-01-10"), sell("pat-fii", 100, 2, "2023-01-10")];
    const [eff] = AssetValuationServiceImpl.effectiveAssets([f], ops);
    expect(eff.effective_value).toBe(0);
  });

  it("Poupança sem quantidade mantém opening_value + delta", () => {
    const p = asset({ id: "pat-poup", asset_type: AssetType.POUPANCA, opening_value: 50 });
    const ops = [
      movement({ asset_id: "pat-poup", amount: 200, quantity: null, unit_price: null, tags: ["op:APORTE"] }),
      movement({ asset_id: "pat-poup", amount: 250, quantity: null, unit_price: null, type: MovementType.INCOME, tags: ["op:RESGATE"], transaction_date: "2026-02-10" }),
    ];
    const impact = AssetValuationServiceImpl.impactByAsset(ops).get("pat-poup")!;
    const [eff] = AssetValuationServiceImpl.effectiveAssets([p], ops);
    expect(eff.effective_value).toBe(AssetValuationServiceImpl.valueOf(p, impact).value);
    expect(eff.effective_value).toBe(0);
  });
});
