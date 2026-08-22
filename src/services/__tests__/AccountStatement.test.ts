// Sprint 4.9.2 — Extrato individual por conta (saldo corrido).
import { describe, expect, it } from "vitest";
import { AccountStatementService } from "../AccountStatementService";
import { MovementStatus, MovementType, AccountType } from "@/constants/enums";
import type { Account, Movement } from "@/models";

const account = (over: Partial<Account> = {}): Account => ({
  id: "acc1",
  workspace_id: "w",
  name: "Conta Corrente",
  institution: null,
  account_type: AccountType.CHECKING,
  currency: "BRL",
  initial_balance: 1000,
  color: "#000",
  icon: "wallet",
  display_order: 0,
  is_active: true,
  created_at: "",
  updated_at: "",
  deleted_at: null,
  ...over,
});

let seq = 0;
const mov = (over: Partial<Movement> = {}): Movement => ({
  id: `m${++seq}`,
  workspace_id: "w",
  account_id: "acc1",
  transfer_account_id: null,
  category_id: null,
  subcategory_id: null,
  card_id: null,
  invoice_id: null,
  asset_id: null,
  import_id: null,
  transfer_group_id: null,
  type: MovementType.EXPENSE,
  status: MovementStatus.CLEARED,
  description: "Mov",
  notes: null,
  amount: 100,
  transaction_date: "2026-03-10",
  competence_date: null,
  due_date: null,
  tags: [],
  attachments: [],
  duplicate_hash: null,
  is_historical: false,
  quantity: null,
  unit_price: null,
  external_ref: null,
  created_at: "2026-03-10T00:00:00Z",
  updated_at: "",
  deleted_at: null,
  ...over,
});

describe("AccountStatementService", () => {
  it("filtra movimentações da conta incluindo transferências recebidas", () => {
    const list = [
      mov(),
      mov({ account_id: "acc2" }),
      mov({
        account_id: "acc2",
        transfer_account_id: "acc1",
        type: MovementType.TRANSFER,
      }),
    ];
    expect(AccountStatementService.forAccount(list, "acc1")).toHaveLength(2);
  });

  it("saldo anterior soma apenas movimentações antes do período", () => {
    const acc = account();
    const list = [
      mov({ transaction_date: "2026-01-05", type: MovementType.INCOME, amount: 500 }),
      mov({ transaction_date: "2026-02-20", amount: 200 }),
      mov({ transaction_date: "2026-03-01", amount: 999 }),
    ];
    // 1000 + 500 - 200
    expect(AccountStatementService.openingBalance(acc, list, "2026-03-01")).toBe(1300);
    // Sem recorte, apenas o saldo inicial.
    expect(AccountStatementService.openingBalance(acc, list)).toBe(1000);
  });

  it("saldo corrido acumula em ordem cronológica e fecha no saldo final", () => {
    const st = AccountStatementService.build(
      "acc1",
      [
        mov({ transaction_date: "2026-03-05", type: MovementType.INCOME, amount: 300 }),
        mov({ transaction_date: "2026-03-02", amount: 100 }),
      ],
      1000,
    );
    expect(st.rows.map((r) => r.balance)).toEqual([900, 1200]);
    expect(st.rows[0].outflow).toBe(100);
    expect(st.rows[1].inflow).toBe(300);
    expect(st.closingBalance).toBe(1200);
  });

  it("transferência debita a origem e credita o destino", () => {
    const t = mov({
      type: MovementType.TRANSFER,
      account_id: "acc1",
      transfer_account_id: "acc2",
      amount: 250,
    });
    expect(AccountStatementService.build("acc1", [t], 1000).closingBalance).toBe(750);
    expect(AccountStatementService.build("acc2", [t], 0).closingBalance).toBe(250);
  });

  it("compra no cartão não altera o saldo da conta; pagamento de fatura altera", () => {
    const compra = mov({ card_id: "card1", account_id: null, amount: 400 });
    const pagamento = mov({ type: MovementType.CARD_PAYMENT, amount: 400 });
    expect(AccountStatementService.build("acc1", [compra], 1000).closingBalance).toBe(1000);
    expect(AccountStatementService.build("acc1", [pagamento], 1000).closingBalance).toBe(600);
  });

  it("operações históricas têm impacto zero no saldo corrido", () => {
    const h = mov({ is_historical: true, asset_id: "a1", type: MovementType.INVESTMENT, amount: 5000 });
    const st = AccountStatementService.build("acc1", [h], 1000);
    expect(st.rows[0].impact).toBe(0);
    expect(st.closingBalance).toBe(1000);
  });

  it("saldo atual equivale ao saldo inicial mais todos os impactos", () => {
    const acc = account({ initial_balance: 100 });
    const list = [
      mov({ type: MovementType.INCOME, amount: 50 }),
      mov({ amount: 20 }),
      mov({ is_historical: true, asset_id: "a1", type: MovementType.INVESTMENT, amount: 900 }),
    ];
    expect(AccountStatementService.currentBalance(acc, list)).toBe(130);
  });
});
