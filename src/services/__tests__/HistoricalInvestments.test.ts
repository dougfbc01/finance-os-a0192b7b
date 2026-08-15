// Sprint 4.7 — Operações históricas de investimento.
// Regra central: operação histórica reconstrói posição/patrimônio do ativo,
// mas NUNCA altera o saldo das contas nem a DRE do período.
import { describe, expect, it } from "vitest";
import { AssetValuationServiceImpl } from "../AssetValuationService";
import { MovementServiceImpl } from "../MovementService";
import { PatrimonyServiceImpl } from "../PatrimonyService";
import { InvestmentServiceImpl } from "../InvestmentService";
import {
  AssetType,
  AssetValuationSource,
  MovementStatus,
  MovementType,
} from "@/constants/enums";
import type { Asset, Movement } from "@/models";

const asset = (over: Partial<Asset> = {}): Asset => ({
  id: "a1",
  workspace_id: "w",
  name: "WEGE3",
  asset_type: AssetType.ACAO,
  institution: "Corretora",
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
  created_at: "",
  updated_at: "",
  deleted_at: null,
  ...over,
});

let seq = 0;
const mov = (over: Partial<Movement> = {}): Movement => ({
  id: `m${++seq}`,
  workspace_id: "w",
  account_id: null,
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
  description: "Compra",
  notes: null,
  amount: 1000,
  transaction_date: "2024-03-10",
  competence_date: null,
  due_date: null,
  tags: ["op:APORTE"],
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

const historical = (over: Partial<Movement> = {}) =>
  mov({ is_historical: true, account_id: null, ...over });

describe("Sprint 4.7 — operações históricas", () => {
  it("operação histórica aumenta a posição do ativo", () => {
    const movements = [
      historical({ amount: 1000, quantity: 20, transaction_date: "2024-03-10" }),
      historical({ amount: 1500, quantity: 25, transaction_date: "2024-08-15" }),
    ];
    const pos = AssetValuationServiceImpl.positionOf("a1", movements);
    expect(pos.quantity).toBe(45);
    expect(pos.cost).toBe(2500);
    expect(pos.historicalCost).toBe(2500);
    expect(pos.currentCost).toBe(0);
  });

  it("operação histórica não altera o saldo de nenhuma conta", () => {
    const h = historical({ amount: 1000, account_id: "acc1" as never });
    expect(MovementServiceImpl.impactOnAccount(h, "acc1")).toBe(0);
    expect(MovementServiceImpl.isExpense(h)).toBe(false);
    expect(MovementServiceImpl.isIncome(h)).toBe(false);
    expect(MovementServiceImpl.totals([h]).expense).toBe(0);
  });

  it("operação atual debita a conta e credita o ativo", () => {
    const atual = mov({ amount: 500, account_id: "acc1", quantity: 5 });
    expect(MovementServiceImpl.impactOnAccount(atual, "acc1")).toBe(-500);
    expect(AssetValuationServiceImpl.deltaForAsset(atual)).toBe(500);
  });

  it("histórico + operação atual produzem posição e preço médio corretos", () => {
    const movements = [
      historical({ amount: 1000, quantity: 10, transaction_date: "2024-03-10" }),
      historical({ amount: 1500, quantity: 10, transaction_date: "2024-08-15" }),
      historical({ amount: 800, quantity: 10, transaction_date: "2025-02-20" }),
      mov({ amount: 500, quantity: 10, account_id: "acc1", transaction_date: "2026-08-14" }),
    ];
    const pos = AssetValuationServiceImpl.positionOf("a1", movements);
    expect(pos.quantity).toBe(40);
    expect(pos.cost).toBe(3800);
    expect(pos.averagePrice).toBe(95);
    expect(pos.historicalCost).toBe(3300);
    expect(pos.currentCost).toBe(500);
    // Somente a operação atual toca o caixa.
    const cash = movements.reduce(
      (s, m) => s + MovementServiceImpl.impactOnAccount(m, "acc1"),
      0,
    );
    expect(cash).toBe(-500);
  });

  it("resgate reduz posição e custo mantendo preço médio coerente", () => {
    const movements = [
      historical({ amount: 1000, quantity: 10, transaction_date: "2024-03-10" }),
      mov({
        amount: 300,
        quantity: 3,
        type: MovementType.INCOME,
        tags: ["op:RESGATE"],
        account_id: "acc1",
        transaction_date: "2025-01-05",
      }),
    ];
    const pos = AssetValuationServiceImpl.positionOf("a1", movements);
    expect(pos.quantity).toBe(7);
    expect(pos.cost).toBe(700);
    expect(pos.averagePrice).toBe(100);
  });

  it("rendimento histórico sem conta soma ao ativo", () => {
    const y = historical({
      amount: 120,
      type: MovementType.INTEREST,
      tags: ["op:RENDIMENTO"],
    });
    expect(AssetValuationServiceImpl.deltaForAsset(y)).toBe(120);
    expect(MovementServiceImpl.impactOnAccount(y, "acc1")).toBe(0);
  });

  it("patrimônio não sofre dupla contagem com operações históricas", () => {
    const a = asset({ valuation_source: AssetValuationSource.MOVEMENTS, opening_value: 0 });
    const movements = [
      historical({ amount: 1000 }),
      mov({ amount: 500, account_id: "acc1" }),
    ];
    const [eff] = AssetValuationServiceImpl.effectiveAssets(
      [a],
      movements,
      {},
    );
    expect(eff.effective_value).toBe(1500);
    expect(eff.counts_in_total).toBe(true);
    // Caixa: apenas a operação atual saiu da conta.
    const cash = 10000 + movements.reduce(
      (s, m) => s + MovementServiceImpl.impactOnAccount(m, "acc1"),
      0,
    );
    const snapshotAssets = PatrimonyServiceImpl.totalAssetsValue([eff]);
    expect(cash).toBe(9500);
    expect(snapshotAssets).toBe(1500);
    expect(cash + snapshotAssets).toBe(11000); // 10000 + 1000 histórico
  });

  it("ativo ACCOUNT (caixinha) continua espelhando a conta sem somar duas vezes", () => {
    const caixinha = asset({
      id: "a2",
      name: "Caixinha",
      asset_type: AssetType.CAIXINHA,
      valuation_source: AssetValuationSource.ACCOUNT,
      account_id: "acc9",
    });
    const [eff] = AssetValuationServiceImpl.effectiveAssets([caixinha], [], { acc9: 2500 });
    expect(eff.effective_value).toBe(2500);
    expect(eff.counts_in_total).toBe(false);
    expect(PatrimonyServiceImpl.totalAssetsValue([eff])).toBe(0);
  });

  it("exclusão de operação histórica recalcula a posição", () => {
    const removida = historical({ amount: 1000, quantity: 10, deleted_at: "2026-08-15" });
    const mantida = historical({ amount: 500, quantity: 5 });
    const pos = AssetValuationServiceImpl.positionOf("a1", [removida, mantida]);
    expect(pos.quantity).toBe(5);
    expect(pos.cost).toBe(500);
  });

  it("detalhe do ativo separa operações históricas das atuais", () => {
    const a = asset({ current_value: 3800, acquisition_value: 3800 });
    const movements = [
      historical({ amount: 1000, quantity: 10 }),
      mov({ amount: 500, quantity: 5, account_id: "acc1" }),
    ];
    const detail = InvestmentServiceImpl.detail(a, movements);
    expect(detail.movements).toHaveLength(2);
    expect(detail.contributions).toBe(1500);
    expect(detail.historicalContributions).toBe(1000);
    expect(detail.currentContributions).toBe(500);
    expect(detail.position.historicalOperations).toBe(1);
  });
});
