import { describe, expect, it } from "vitest";
import { ClassificationRuleServiceImpl } from "@/services/ClassificationRuleService";
import { MovementServiceImpl } from "@/services/MovementService";
import { MovementType } from "@/constants/enums";
import type { ClassificationRule, Movement } from "@/models";

const rule = (p: Partial<ClassificationRule>): ClassificationRule =>
  ({
    id: "r",
    workspace_id: "w",
    text_pattern: "uber",
    category_id: "cat",
    subcategory_id: null,
    priority: 100,
    enabled: true,
    last_matched_at: null,
    created_at: "",
    updated_at: "",
    deleted_at: null,
    ...p,
  }) as ClassificationRule;

describe("ClassificationRuleService.match", () => {
  it("casa por substring case-insensitive", () => {
    expect(ClassificationRuleServiceImpl.match("UBER *TRIP", [rule({})])?.category_id).toBe("cat");
  });

  it("respeita a prioridade", () => {
    const rules = [
      rule({ id: "a", text_pattern: "uber", category_id: "baixa", priority: 10 }),
      rule({ id: "b", text_pattern: "uber", category_id: "alta", priority: 900 }),
    ];
    expect(ClassificationRuleServiceImpl.match("uber eats", rules)?.category_id).toBe("alta");
  });

  it("ignora regras desabilitadas", () => {
    expect(ClassificationRuleServiceImpl.match("uber", [rule({ enabled: false })])).toBeNull();
  });

  it("sem regra compatível retorna null (nunca 'Outros')", () => {
    expect(ClassificationRuleServiceImpl.match("padaria", [rule({})])).toBeNull();
  });

  it("suggestPattern remove datas e números", () => {
    expect(ClassificationRuleServiceImpl.suggestPattern("Uber *Trip 12/03 1234")).toBe("uber trip");
  });
});

const mov = (p: Partial<Movement>): Movement =>
  ({
    id: "m",
    workspace_id: "w",
    account_id: "acc",
    transfer_account_id: null,
    card_id: null,
    invoice_id: null,
    amount: 100,
    type: MovementType.EXPENSE,
    ...p,
  }) as Movement;

describe("MovementService.impactOnAccount", () => {
  it("compra no cartão não afeta o saldo da conta", () => {
    expect(MovementServiceImpl.impactOnAccount(mov({ card_id: "c" }), "acc")).toBe(0);
  });

  it("pagamento de fatura debita a conta", () => {
    expect(
      MovementServiceImpl.impactOnAccount(
        mov({ card_id: "c", type: MovementType.CARD_PAYMENT }),
        "acc",
      ),
    ).toBeLessThan(0);
  });

  it("transferência debita origem e credita destino (saldo total inalterado)", () => {
    const t = mov({ type: MovementType.TRANSFER, transfer_account_id: "dest" });
    const out = MovementServiceImpl.impactOnAccount(t, "acc");
    const inn = MovementServiceImpl.impactOnAccount(t, "dest");
    expect(out).toBe(-100);
    expect(inn).toBe(100);
    expect(out + inn).toBe(0);
  });

  it("transferência não impacta contas não envolvidas", () => {
    const t = mov({ type: MovementType.TRANSFER, transfer_account_id: "dest" });
    expect(MovementServiceImpl.impactOnAccount(t, "outra")).toBe(0);
  });
});
