import { describe, it, expect } from "vitest";
import { AccountType, AssetType, AssetValuationSource, MovementType, MovementStatus } from "@/constants/enums";
import type { Account, Asset, Movement } from "@/models";
import { accountMirrorRows, accountMirrorValue, capitalVsMarketMonthly, investmentMonthlyBase, isAccountMirrorInvestment, monthlyInvestmentHistory } from "../InvestmentAnalysisService";
import { InvestmentServiceImpl } from "../InvestmentService";
import { AssetValuationServiceImpl } from "../AssetValuationService";
import { PatrimonyServiceImpl } from "../PatrimonyService";

const account: Account = { id: "acc", workspace_id: "w", name: "Caixinha Nubank", institution: "Nubank", account_type: AccountType.DIGITAL, currency: "BRL", initial_balance: 1000, color: "", icon: "", display_order: 0, is_active: true, created_at: "", updated_at: "", deleted_at: null };
const cdb: Asset = { id: "cdb", workspace_id: "w", name: "CDB Caixinha", asset_type: AssetType.CDB, ticker: null, institution: "Nubank", currency: "BRL", quantity: 0, unit_price: 0, current_value: 0, acquisition_value: 0, acquisition_date: null, is_active: true, notes: null, valuation_source: AssetValuationSource.ACCOUNT, account_id: "acc", opening_value: 0, created_at: "", updated_at: "", deleted_at: null };
const movement = (override: Partial<Movement> = {}): Movement => ({ id: "m", workspace_id: "w", account_id: null, transfer_account_id: null, category_id: null, subcategory_id: null, card_id: null, asset_id: null, import_id: null, transfer_group_id: null, type: MovementType.TRANSFER, status: MovementStatus.CLEARED, description: "Mov", notes: null, amount: 0, transaction_date: "2026-01-10", competence_date: null, due_date: null, tags: [], attachments: [], created_at: "", updated_at: "", deleted_at: null, duplicate_hash: null, invoice_id: null, is_historical: false, quantity: null, unit_price: null, external_ref: null, ...override });
// Aporte: transferência recebida na conta da caixinha.
const aporte = (date: string, amount: number, id = `ap-${date}`) => movement({ id, transaction_date: date, amount, transfer_account_id: "acc" });
// Resgate: transferência enviada da conta da caixinha.
const resgate = (date: string, amount: number, id = `rg-${date}`) => movement({ id, transaction_date: date, amount, account_id: "acc" });
// Rendimento conciliado: creditado na própria conta, vinculado ao ativo.
const rendimento = (date: string, amount: number, id = `yd-${date}`) => movement({ id, transaction_date: date, amount, account_id: "acc", asset_id: "cdb", type: MovementType.INTEREST, tags: ["op:RENDIMENTO", "recon:rendimento"] });

const movements = [aporte("2026-01-10", 500), resgate("2026-02-05", 200), rendimento("2026-02-20", 30)];

describe("Ativos espelhados em conta (caixinha/CDB) na Análise", () => {
  it("identifica somente classes de investimento espelhadas; caixa puro continua fora", () => {
    expect(isAccountMirrorInvestment(cdb)).toBe(true);
    for (const type of [AssetType.BANK, AssetType.CASH, AssetType.CAIXINHA, AssetType.OUTRO]) {
      expect(isAccountMirrorInvestment({ ...cdb, asset_type: type })).toBe(false);
    }
    expect(isAccountMirrorInvestment({ ...cdb, account_id: null })).toBe(false);
    expect(isAccountMirrorInvestment({ ...cdb, valuation_source: AssetValuationSource.MOVEMENTS })).toBe(false);
  });

  it("valor e capital no fim do mês batem com o extrato da conta (aporte, resgate, conciliação)", () => {
    const jan = accountMirrorValue(cdb, account, movements, "2026-01-31");
    expect(jan).toMatchObject({ value: 1500, capital: 1500, yields: 0 });
    const fev = accountMirrorValue(cdb, account, movements, "2026-02-28");
    expect(fev).toMatchObject({ value: 1330, capital: 1300, yields: 30 });
    expect(fev.lastReconciliation).toMatchObject({ date: "2026-02-20", amount: 30 });
  });

  it("base mensal usa o saldo da conta, mantém mês sem movimento e sinaliza a conciliação", () => {
    const rows = investmentMonthlyBase({ assets: [cdb], movements, prices: {}, from: "2026-01-01", to: "2026-03-20", accounts: [account] });
    expect(rows.map((r) => [r.month, r.totalValue, r.cost])).toEqual([["2026-01", 1500, 1500], ["2026-02", 1330, 1300], ["2026-03", 1330, 1300]]);
    expect(rows.every((r) => r.status === "ACCOUNT_RECONCILED" && r.valueOrigin === "ACCOUNT")).toBe(true);
    expect(rows[0]?.lastReconciliationDate).toBeNull();
    expect(rows[1]?.lastReconciliationDate).toBe("2026-02-20");
    expect(rows[2]?.lastReconciliationDate).toBe("2026-02-20");
  });

  it("a conciliação gera degrau na data: o rendimento não é rateado entre meses", () => {
    const antes = accountMirrorValue(cdb, account, movements, "2026-02-19");
    const depois = accountMirrorValue(cdb, account, movements, "2026-02-20");
    expect(antes.value).toBe(1300);
    expect(depois.value).toBe(1330);
    expect(depois.value - antes.value).toBe(30);
  });

  it("entra no Capital × Mercado como avaliado, com capital e cobertura", () => {
    const result = capitalVsMarketMonthly({ assets: [cdb], movements, prices: {}, from: "2026-01-01", to: "2026-02-28", accounts: [account] });
    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({ capitalTotal: 1300, valorMercadoAvaliados: 1330, custoAvaliados: 1300, ativosAvaliados: 1, cobertura: 1, coberturaCapital: 1, completo: true, ganhoNaoRealizado: 30 });
    expect(result[1]?.assets[0]).toMatchObject({ status: "ACCOUNT", assetType: AssetType.CDB, marketValue: 1330, cost: 1300, quoteDate: "2026-02-20" });
  });

  it("rentabilidade do grupo usa valor e capital dos ativos espelhados avaliados", () => {
    const base = investmentMonthlyBase({ assets: [cdb], movements, prices: {}, from: "2026-01-01", to: "2026-02-28", accounts: [account] });
    const points = monthlyInvestmentHistory(base, "2026-01-01", "2026-02-28");
    const fev = points.find((p) => p.date === "2026-02-28");
    expect(fev?.returns["CDB_BRL"]).toBeCloseTo((30 / 1300) * 100, 6);
    expect(fev?.missingAssets).toBe(0);
    expect(fev?.value).toBe(1330);
  });

  it("composição atual mostra o saldo da conta, não R$ 0,00", () => {
    const rows = accountMirrorRows([cdb], [account], movements, "2026-03-20");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ invested: 1300, current: 1330, profit: 30, economicReturn: 30, accumulatedIncome: 30 });
  });

  it("Patrimônio e totais não mudam: ativo espelhado continua fora do total de ativos", () => {
    expect(AssetValuationServiceImpl.countsInTotal(cdb)).toBe(false);
    expect(InvestmentServiceImpl.filterInvestments([cdb])).toHaveLength(0);
    expect(PatrimonyServiceImpl.countableAssets([cdb])).toHaveLength(0);
  });

  it("classes excluídas não entram na base mensal nem no comparativo", () => {
    const caixinha = { ...cdb, id: "cx", asset_type: AssetType.CAIXINHA };
    const base = investmentMonthlyBase({ assets: [caixinha], movements, prices: {}, from: "2026-01-01", to: "2026-02-28", accounts: [account] });
    expect(base).toHaveLength(0);
    expect(capitalVsMarketMonthly({ assets: [caixinha], movements, prices: {}, from: "2026-01-01", to: "2026-02-28", accounts: [account] })).toHaveLength(0);
  });

  it("Tesouro carrega o tipo para o rótulo 'A custo' nas visões da aba", () => {
    const tesouro: Asset = { ...cdb, id: "td", name: "Tesouro Selic 2029", asset_type: AssetType.TESOURO, valuation_source: AssetValuationSource.MOVEMENTS, account_id: null };
    const compra = movement({ id: "td-buy", asset_id: "td", type: MovementType.INVESTMENT, amount: 500, quantity: 0.5, unit_price: 1000, transaction_date: "2026-01-05", tags: ["op:APORTE"], is_historical: true });
    const base = investmentMonthlyBase({ assets: [tesouro], movements: [compra], prices: {}, from: "2026-01-01", to: "2026-01-31", accounts: [] });
    expect(base[0]).toMatchObject({ assetType: AssetType.TESOURO, status: "NO_VALUATION" });
    const cvm = capitalVsMarketMonthly({ assets: [tesouro], movements: [compra], prices: {}, from: "2026-01-01", to: "2026-01-31", accounts: [] });
    expect(cvm[0]?.assets[0]).toMatchObject({ assetType: AssetType.TESOURO, status: "COST_ONLY", cost: 500, marketValue: null });
  });
});
