import { describe, expect, it } from "vitest";
import {
  ClassificationRuleServiceImpl as Engine,
  SPECIFICITY_WEIGHTS,
} from "@/services/ClassificationRuleService";
import { RuleIntegrityServiceImpl } from "@/services/RuleIntegrityService";
import { MovementServiceImpl } from "@/services/MovementService";
import { MovementType } from "@/constants/enums";
import type { ClassificationRule, Movement } from "@/models";

const Integrity = new RuleIntegrityServiceImpl();

const rule = (p: Partial<ClassificationRule>): ClassificationRule =>
  ({
    id: "r",
    workspace_id: "w",
    text_pattern: "transferencia enviada pelo",
    counterparty_pattern: null,
    movement_type: null,
    direction: null,
    account_id: null,
    card_id: null,
    category_id: "educacao",
    subcategory_id: null,
    priority: 100,
    enabled: true,
    match_count: 0,
    last_matched_at: null,
    created_at: "",
    updated_at: "",
    deleted_at: null,
    ...p,
  }) as ClassificationRule;

const mov = (p: Partial<Movement>): Movement =>
  ({
    id: "m",
    workspace_id: "w",
    account_id: "acc",
    transfer_account_id: null,
    category_id: null,
    subcategory_id: null,
    card_id: null,
    type: MovementType.EXPENSE,
    amount: 100,
    description: "",
    transaction_date: "2026-08-10",
    deleted_at: null,
    ...p,
  }) as Movement;

const GENERIC_OUT = rule({
  id: "generica",
  text_pattern: "transferencia enviada pelo",
  category_id: "educacao",
  subcategory_id: "cursos",
});

const SPECIFIC_STEPHANIE = rule({
  id: "stephanie",
  text_pattern: "transferencia enviada pelo",
  counterparty_pattern: "Stephanie",
  category_id: "transporte",
  subcategory_id: "escolar",
});

const SPECIFIC_GRACA = rule({
  id: "graca",
  text_pattern: "transferencia enviada pelo",
  counterparty_pattern: "Comunidade da Graça",
  category_id: "familia",
  subcategory_id: "dizimos",
});

const D_STEPHANIE =
  "Transferência enviada pelo Pix - Stephanie Caroline Sant Anna Miranda - 123.456.789-00";
const D_GRACA =
  "Transferência enviada pelo Pix - Comunidade da Graça em Bragança Paulista - 11.222.333/0001-44";
const D_MARIA = "Transferência enviada pelo Pix - MARIA DO CARMO MIRANDA CORREIA - 999.888.777-66";
const D_BRUNA = "Transferência recebida pelo Pix - BRUNA MARIA RODRIGUES - 111.222.333-44";

describe("Motor de regras — especificidade (Sprint 4.5.1)", () => {
  it("regra genérica classifica quando é a única candidata", () => {
    const win = Engine.evaluate({ description: D_MARIA, type: MovementType.EXPENSE }, [GENERIC_OUT]);
    expect(win?.rule.id).toBe("generica");
  });

  it("regra específica vence a genérica", () => {
    const win = Engine.evaluate({ description: D_STEPHANIE, type: MovementType.EXPENSE }, [
      GENERIC_OUT,
      SPECIFIC_STEPHANIE,
    ]);
    expect(win?.rule.id).toBe("stephanie");
    expect(win?.specificityLabel).toBe("Alta");
  });

  it("mesma descrição base com contrapartes diferentes leva a categorias diferentes", () => {
    const rules = [GENERIC_OUT, SPECIFIC_STEPHANIE, SPECIFIC_GRACA];
    expect(Engine.evaluate(D_STEPHANIE, rules)?.rule.category_id).toBe("transporte");
    expect(Engine.evaluate(D_GRACA, rules)?.rule.category_id).toBe("familia");
    expect(Engine.evaluate(D_MARIA, rules)?.rule.category_id).toBe("educacao");
  });

  it("regra específica vence mesmo com prioridade menor", () => {
    const win = Engine.evaluate(D_STEPHANIE, [
      rule({ ...GENERIC_OUT, priority: 900 }),
      rule({ ...SPECIFIC_STEPHANIE, priority: 1 }),
    ]);
    expect(win?.rule.id).toBe("stephanie");
  });

  it("a prioridade decide quando a especificidade empata", () => {
    const win = Engine.evaluate("uber trip 123", [
      rule({ id: "a", text_pattern: "uber", category_id: "baixa", priority: 10 }),
      rule({ id: "b", text_pattern: "uber", category_id: "alta", priority: 900 }),
    ]);
    expect(win?.rule.category_id).toBe("alta");
  });

  it("empate total é resolvido de forma determinística (nunca aleatório)", () => {
    const a = rule({ id: "aaa", text_pattern: "uber", category_id: "x" });
    const b = rule({ id: "bbb", text_pattern: "uber", category_id: "y" });
    const first = Engine.evaluateAll("uber trip", [a, b]);
    const second = Engine.evaluateAll("uber trip", [b, a]);
    expect(first[0].rule.id).toBe(second[0].rule.id);
    expect(Engine.hasTie(first)).toBe(true);
  });

  it("score de especificidade soma os pesos das condições", () => {
    const win = Engine.evaluate({ description: D_STEPHANIE, type: MovementType.EXPENSE }, [
      rule({ ...SPECIFIC_STEPHANIE, movement_type: MovementType.EXPENSE, direction: "OUT" }),
    ]);
    expect(win?.specificity).toBe(
      SPECIFICITY_WEIGHTS.kind[win!.kind] +
        SPECIFICITY_WEIGHTS.counterparty +
        SPECIFICITY_WEIGHTS.movementType +
        SPECIFICITY_WEIGHTS.direction,
    );
  });

  it("sem regra aplicável retorna null (nunca 'Outros')", () => {
    expect(Engine.evaluate("padaria do bairro", [SPECIFIC_STEPHANIE])).toBeNull();
  });

  it("ignora regras desabilitadas", () => {
    expect(Engine.match(D_STEPHANIE, [rule({ ...SPECIFIC_STEPHANIE, enabled: false })])).toBeNull();
  });
});

describe("Direção e transferências entre contas próprias", () => {
  it("PIX recebido é entrada", () => {
    expect(Engine.direction({ description: D_BRUNA, type: MovementType.INCOME })).toBe("IN");
  });

  it("PIX enviado é saída", () => {
    expect(Engine.direction({ description: D_STEPHANIE, type: MovementType.EXPENSE })).toBe("OUT");
  });

  it("transferência entre contas próprias é INTERNAL e não casa com regras IN/OUT", () => {
    const ctx = {
      description: "Transferência enviada pelo Pix - Nubank Caixinha",
      type: MovementType.TRANSFER,
      account_id: "nubank",
      transfer_account_id: "caixinha",
    };
    expect(Engine.direction(ctx)).toBe("INTERNAL");
    expect(Engine.match(ctx, [rule({ ...GENERIC_OUT, direction: "OUT" })])).toBeNull();
  });

  it("regra de entrada não casa com movimentação de saída", () => {
    const r = rule({ id: "in", text_pattern: "transferencia", direction: "IN" });
    expect(Engine.match({ description: D_STEPHANIE, type: MovementType.EXPENSE }, [r])).toBeNull();
    expect(Engine.match({ description: D_BRUNA, type: MovementType.INCOME }, [r])?.id).toBe("in");
  });
});

describe("Dry-run / simulação", () => {
  it("informa regra vencedora, especificidade, prioridade e motivo", () => {
    const sim = Engine.simulate({ description: D_STEPHANIE, type: MovementType.EXPENSE }, [
      GENERIC_OUT,
      SPECIFIC_STEPHANIE,
    ]);
    expect(sim.rule?.id).toBe("stephanie");
    expect(sim.specificityLabel).toBe("Alta");
    expect(sim.priority).toBe(100);
    expect(sim.categoryId).toBe("transporte");
    expect(sim.reason).toContain("contraparte");
    expect(sim.candidates.length).toBe(2);
  });

  it("explica quando nenhuma regra se aplica", () => {
    const sim = Engine.simulate("padaria", [SPECIFIC_STEPHANIE]);
    expect(sim.rule).toBeNull();
    expect(sim.reason).toContain("Nenhuma regra");
  });
});

describe("Integridade das regras", () => {
  it("mesmo contexto com destinos diferentes é CONFLITO", () => {
    const report = Integrity.analyze([
      rule({ ...SPECIFIC_STEPHANIE, id: "a" }),
      rule({ ...SPECIFIC_STEPHANIE, id: "b", category_id: "educacao" }),
    ]);
    expect(report.conflicts.length).toBe(1);
    expect(report.duplicates.length).toBe(0);
  });

  it("mesmo contexto com mesmo destino é DUPLICIDADE", () => {
    const report = Integrity.analyze([
      rule({ ...SPECIFIC_STEPHANIE, id: "a" }),
      rule({ ...SPECIFIC_STEPHANIE, id: "b" }),
    ]);
    expect(report.duplicates.length).toBe(1);
    expect(report.conflicts.length).toBe(0);
  });

  it("contrapartes diferentes não geram conflito nem duplicidade", () => {
    const report = Integrity.analyze([SPECIFIC_STEPHANIE, SPECIFIC_GRACA]);
    expect(report.conflicts.length).toBe(0);
    expect(report.duplicates.length).toBe(0);
  });

  it("detecta regra genérica sobrepondo regra específica", () => {
    const report = Integrity.analyze([
      rule({ id: "g", text_pattern: "uber", category_id: "x" }),
      rule({ id: "e", text_pattern: "uber eats", category_id: "y" }),
    ]);
    expect(report.overlaps.length).toBeGreaterThan(0);
  });

  it("regra nunca utilizada aparece como INFO", () => {
    const report = Integrity.analyze([rule({ id: "n" })]);
    expect(report.unused.length).toBe(1);
  });

  it("identifica regra muito ampla com contrapartes distintas", () => {
    const names = [
      "Stephanie Caroline",
      "Comunidade da Graça",
      "MARIA DO CARMO",
      "VIVIANE APARECIDA",
      "BRUNA MARIA",
    ];
    const movements = Array.from({ length: 15 }, (_, i) =>
      mov({
        id: `m${i}`,
        description: `Transferência enviada pelo Pix - ${names[i % names.length]}`,
        type: MovementType.EXPENSE,
      }),
    );
    const report = Integrity.analyze([GENERIC_OUT], movements);
    expect(report.broad.length).toBe(1);
    expect(report.broadDetails[0].counterparties.length).toBeGreaterThanOrEqual(3);
    expect(report.broadDetails[0].movements).toBe(15);
    expect(report.broadDetails[0].recommendation).toContain("específica");
  });

  it("regra com contraparte definida nunca é considerada muito ampla", () => {
    const movements = Array.from({ length: 20 }, (_, i) =>
      mov({ id: `m${i}`, description: `${D_STEPHANIE} ${i}`, type: MovementType.EXPENSE }),
    );
    expect(Integrity.analyze([SPECIFIC_STEPHANIE], movements).broad.length).toBe(0);
  });
});

describe("Classificação manual preservada", () => {
  it("o plano de reprocessamento só considera movimentações sem categoria", () => {
    // Movimentação já classificada manualmente não entra na avaliação.
    const manual = mov({ id: "manual", category_id: "manual-cat", description: D_STEPHANIE });
    const pending = [mov({ id: "pend", description: D_STEPHANIE, type: MovementType.EXPENSE })];
    const candidates = [manual, ...pending].filter((m) => !m.category_id);
    expect(candidates.map((m) => m.id)).toEqual(["pend"]);
    expect(Engine.evaluate(candidates[0], [SPECIFIC_STEPHANIE])?.rule.category_id).toBe(
      "transporte",
    );
  });
});

describe("Totalizador de movimentações", () => {
  it("soma receitas, despesas e saldo líquido do conjunto filtrado", () => {
    const totals = MovementServiceImpl.totals([
      mov({ id: "1", type: MovementType.INCOME, amount: 1350 }),
      mov({ id: "2", type: MovementType.EXPENSE, amount: 2480 }),
      mov({ id: "3", type: MovementType.TRANSFER, amount: 500 }),
    ]);
    expect(totals.count).toBe(3);
    expect(totals.income).toBe(1350);
    expect(totals.expense).toBe(2480);
    expect(totals.net).toBe(-1130);
    expect(totals.transfers).toBe(500);
  });

  it("transferências não viram receita nem despesa", () => {
    const totals = MovementServiceImpl.totals([
      mov({ id: "1", type: MovementType.TRANSFER, amount: 900 }),
    ]);
    expect(totals.income).toBe(0);
    expect(totals.expense).toBe(0);
    expect(totals.net).toBe(0);
  });
});
