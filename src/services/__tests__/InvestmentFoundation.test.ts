// Sprint 4.6 — Fundação do módulo de Investimentos + Visão Patrimonial.
import { describe, expect, it } from "vitest";
import { AssetValuationServiceImpl } from "../AssetValuationService";
import { PatrimonyServiceImpl } from "../PatrimonyService";
import { InvestmentServiceImpl } from "../InvestmentService";
import {
  AssetType,
  AssetValuationSource,
  assetTypeTraits,
  assetTypeToBucket,
  MovementStatus,
  MovementType,
  PatrimonyBucket,
} from "@/constants/enums";
import type { Asset, Movement } from "@/models";

const asset = (over: Partial<Asset> = {}): Asset => ({
  id: "a1",
  workspace_id: "w",
  name: "Ativo",
  asset_type: AssetType.CDB,
  institution: "Banco A",
  ticker: null,
  currency: "BRL",
  quantity: 0,
  unit_price: 0,
  current_value: 0,
  acquisition_value: 0,
  acquisition_date: null,
  is_active: true,
  notes: null,
  valuation_source: AssetValuationSource.MANUAL,
  account_id: null,
  opening_value: 0,
  created_at: "",
  updated_at: "",
  deleted_at: null,
  ...over,
});

const mov = (over: Partial<Movement> = {}): Movement => ({
  id: "m1",
  workspace_id: "w",
  account_id: "acc1",
  transfer_account_id: null,
  category_id: null,
  subcategory_id: null,
  card_id: null,
  invoice_id: null,
  asset_id: "a1",
  import_id: null,
  transfer_group_id: null,
  type: MovementType.INVESTMENT,
  status: MovementStatus.CLEARED,
  description: "Aplicação",
  notes: null,
  amount: 100,
  transaction_date: "2026-02-01",
  competence_date: null,
  due_date: null,
  tags: [],
  attachments: [],
  duplicate_hash: null,
  is_historical: false,
  quantity: null,
  unit_price: null,
  external_ref: null,
  created_at: "",
  updated_at: "",
  deleted_at: null,
  ...over,
});

const effective = (assets: Asset[], movements: Movement[] = [], balances = {}) =>
  AssetValuationServiceImpl.effectiveAssets(assets, movements, balances);

describe("Sprint 4.6 — tipos de ativo", () => {
  it("cria cada tipo de ativo e resolve seu bucket patrimonial", () => {
    const cases: [AssetType, PatrimonyBucket][] = [
      [AssetType.POUPANCA, PatrimonyBucket.POUPANCA],
      [AssetType.CDB, PatrimonyBucket.RENDA_FIXA],
      [AssetType.RENDA_FIXA, PatrimonyBucket.RENDA_FIXA],
      [AssetType.TESOURO, PatrimonyBucket.TESOURO],
      [AssetType.ACAO, PatrimonyBucket.ACOES],
      [AssetType.FII, PatrimonyBucket.FIIS],
      [AssetType.ETF, PatrimonyBucket.ETFS],
      [AssetType.CRIPTO, PatrimonyBucket.OUTROS],
    ];
    for (const [type, bucket] of cases) {
      const a = asset({ asset_type: type, current_value: 10 });
      expect(a.asset_type).toBe(type);
      expect(assetTypeToBucket(a.asset_type)).toBe(bucket);
    }
  });

  it("exige quantidade/ticker apenas para ativos negociados em cotas", () => {
    expect(assetTypeTraits(AssetType.POUPANCA)).toEqual({ hasQuantity: false, hasTicker: false });
    expect(assetTypeTraits(AssetType.CDB)).toEqual({ hasQuantity: false, hasTicker: false });
    expect(assetTypeTraits(AssetType.ACAO)).toEqual({ hasQuantity: true, hasTicker: true });
    expect(assetTypeTraits(AssetType.FII)).toEqual({ hasQuantity: true, hasTicker: true });
    expect(assetTypeTraits(AssetType.TESOURO).hasQuantity).toBe(true);
    expect(assetTypeTraits(AssetType.TESOURO).hasTicker).toBe(false);
  });
});

describe("Sprint 4.6 — origem do valor", () => {
  it("MANUAL usa o valor informado", () => {
    const [a] = effective([
      asset({ valuation_source: AssetValuationSource.MANUAL, current_value: 500 }),
    ]);
    expect(a.effective_value).toBe(500);
    expect(a.counts_in_total).toBe(true);
  });

  it("MOVEMENTS deriva o valor das movimentações", () => {
    const [a] = effective(
      [asset({ valuation_source: AssetValuationSource.MOVEMENTS, opening_value: 1000 })],
      [mov({ amount: 200, tags: ["op:APORTE"] })],
    );
    expect(a.effective_value).toBe(1200);
  });

  it("ACCOUNT espelha o saldo da conta e não conta no total", () => {
    const [a] = effective(
      [
        asset({
          valuation_source: AssetValuationSource.ACCOUNT,
          account_id: "acc1",
          asset_type: AssetType.CAIXINHA,
        }),
      ],
      [],
      { acc1: 750 },
    );
    expect(a.effective_value).toBe(750);
    expect(a.counts_in_total).toBe(false);
  });

  it("patrimônio sem movimentação usa apenas caixa e valores manuais", () => {
    const snap = PatrimonyServiceImpl.snapshot({
      cashBalance: 300,
      assets: effective([asset({ current_value: 200, acquisition_value: 200 })]),
      invoices: [],
    });
    expect(snap.totalAssets).toBe(500);
    expect(snap.netWorth).toBe(500);
  });
});

describe("Sprint 4.6 — aplicações, resgates e rendimentos", () => {
  const cdb = asset({
    valuation_source: AssetValuationSource.MOVEMENTS,
    opening_value: 0,
    asset_type: AssetType.CDB,
  });

  it("aplicação move valor da conta para o ativo sem alterar patrimônio líquido", () => {
    const aporte = mov({ amount: 1000, tags: ["op:APORTE"] });
    const [a] = effective([cdb], [aporte]);
    // Conta -1000 (fluxo) e ativo +1000 → patrimônio inalterado.
    const snap = PatrimonyServiceImpl.snapshot({
      cashBalance: 1000 - 1000,
      assets: [a],
      invoices: [],
    });
    expect(a.effective_value).toBe(1000);
    expect(snap.totalAssets).toBe(1000);
  });

  it("aplicação não é despesa nem receita", () => {
    const aporte = mov({ amount: 1000, tags: ["op:APORTE"] });
    expect(aporte.type).toBe(MovementType.INVESTMENT);
    expect(AssetValuationServiceImpl.deltaForAsset(aporte)).toBe(1000);
  });

  it("resgate devolve o valor para a conta e não vira receita", () => {
    const resgate = mov({ id: "m2", amount: 500, tags: ["op:RESGATE"] });
    const [a] = effective([{ ...cdb, opening_value: 1000 }], [resgate]);
    expect(AssetValuationServiceImpl.deltaForAsset(resgate)).toBe(-500);
    expect(a.effective_value).toBe(500);
    const snap = PatrimonyServiceImpl.snapshot({
      cashBalance: 500,
      assets: [a],
      invoices: [],
    });
    expect(snap.totalAssets).toBe(1000);
  });

  it("rendimento sem entrada em conta aumenta o valor patrimonial do ativo", () => {
    const rend = mov({
      id: "m3",
      account_id: null,
      amount: 80,
      type: MovementType.INTEREST,
      tags: ["op:RENDIMENTO"],
    });
    const [a] = effective([{ ...cdb, opening_value: 10000 }], [rend]);
    expect(a.effective_value).toBe(10080);
    expect(a.impact.yields).toBe(80);
  });

  it("rendimento creditado em conta não duplica patrimônio", () => {
    const rend = mov({
      id: "m4",
      account_id: "acc1",
      amount: 80,
      type: MovementType.INTEREST,
      tags: ["op:RENDIMENTO"],
    });
    const [a] = effective([{ ...cdb, opening_value: 10000 }], [rend]);
    expect(a.effective_value).toBe(10000);
  });
});

describe("Sprint 4.6 — composição patrimonial", () => {
  const accounts = [
    { id: "acc1", name: "Nubank", institution: "Nubank" },
    { id: "acc2", name: "Caixinha Viagem", institution: "Nubank" },
  ];
  const balances = { acc1: 2000, acc2: 1000 };
  const assets = effective(
    [
      asset({
        id: "cx",
        name: "Caixinha Viagem",
        asset_type: AssetType.CAIXINHA,
        valuation_source: AssetValuationSource.ACCOUNT,
        account_id: "acc2",
      }),
      asset({ id: "cdb1", name: "CDB Banco A", asset_type: AssetType.CDB, current_value: 15000 }),
      asset({ id: "cdb2", name: "CDB Banco B", asset_type: AssetType.CDB, current_value: 10000 }),
      asset({ id: "td", name: "Tesouro Selic", asset_type: AssetType.TESOURO, current_value: 5000 }),
      asset({ id: "pp", name: "Poupança", asset_type: AssetType.POUPANCA, current_value: 800 }),
      asset({
        id: "ac",
        name: "PETR4",
        asset_type: AssetType.ACAO,
        ticker: "PETR4",
        current_value: 3000,
      }),
    ],
    [],
    balances,
  );

  const comp = PatrimonyServiceImpl.composition({ accounts, balances, assets });
  const bucket = (k: PatrimonyBucket) => comp.buckets.find((b) => b.key === k);

  it("agrupa o patrimônio por tipo", () => {
    expect(bucket(PatrimonyBucket.CONTAS)?.amount).toBe(2000);
    expect(bucket(PatrimonyBucket.CAIXINHAS)?.amount).toBe(1000);
    expect(bucket(PatrimonyBucket.POUPANCA)?.amount).toBe(800);
    expect(bucket(PatrimonyBucket.RENDA_FIXA)?.amount).toBe(25000);
    expect(bucket(PatrimonyBucket.TESOURO)?.amount).toBe(5000);
    expect(bucket(PatrimonyBucket.ACOES)?.amount).toBe(3000);
  });

  it("não duplica caixinhas nem contas e bate com o snapshot", () => {
    const snap = PatrimonyServiceImpl.snapshot({
      cashBalance: 3000,
      assets,
      invoices: [],
    });
    expect(comp.total).toBe(snap.totalAssets);
    expect(comp.total).toBe(36800);
    // A conta espelhada não aparece no bucket Contas.
    expect(bucket(PatrimonyBucket.CONTAS)?.items.map((i) => i.id)).toEqual(["acc1"]);
  });

  it("permite drill-down até o ativo", () => {
    const rf = bucket(PatrimonyBucket.RENDA_FIXA);
    expect(rf?.items.map((i) => i.label)).toEqual(["CDB Banco A", "CDB Banco B"]);
    expect(rf?.items.every((i) => i.kind === "ASSET" && !!i.assetId)).toBe(true);
  });

  it("metas vinculadas a uma caixinha não geram segundo patrimônio", () => {
    // A meta consome o saldo da conta acc2; o ativo espelho continua fora do total.
    const goalBalance = balances.acc2;
    const snap = PatrimonyServiceImpl.snapshot({ cashBalance: 3000, assets, invoices: [] });
    expect(goalBalance).toBe(1000);
    expect(snap.totalAssets).toBe(36800);
  });
});

describe("Sprint 4.6 — drill-down do ativo", () => {
  it("detalha aportes, resgates, rendimentos e movimentações", () => {
    const movements = [
      mov({ id: "m1", amount: 1000, tags: ["op:APORTE"] }),
      mov({ id: "m2", amount: 300, tags: ["op:RESGATE"] }),
      mov({
        id: "m3",
        account_id: null,
        amount: 50,
        type: MovementType.INTEREST,
        tags: ["op:RENDIMENTO"],
      }),
      mov({ id: "outro", asset_id: "zzz", amount: 999 }),
    ];
    const [a] = effective(
      [asset({ valuation_source: AssetValuationSource.MOVEMENTS, opening_value: 0 })],
      movements,
    );
    const detail = InvestmentServiceImpl.detail(a, movements);
    expect(detail.movements).toHaveLength(3);
    expect(detail.contributions).toBe(1000);
    expect(detail.redemptions).toBe(300);
    expect(detail.yields).toBe(50);
    expect(detail.current).toBe(750);
    expect(detail.invested).toBe(700);
  });
});
