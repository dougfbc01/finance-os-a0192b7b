// ClassificationRuleService — CRUD e motor de classificação automática.
// Sprint 4.5.1: o motor passa a ser CONTEXTUAL. Além do texto, uma regra pode
// exigir contraparte, tipo, direção, conta e cartão. Vence sempre a regra mais
// ESPECÍFICA, de forma determinística. Nenhuma outra camada pode reimplementar
// essa lógica.
//
// ORDEM DE DECISÃO (determinística):
//   1. compatibilidade estrutural (tipo, direção, conta, cartão, contraparte);
//   2. especificidade (score numérico — ver `scoreSpecificity`);
//   3. prioridade manual (maior vence);
//   4. tamanho do padrão de texto (mais longo vence);
//   5. tamanho do padrão de contraparte;
//   6. id da regra (desempate estável — nunca aleatório).
import { BaseService } from "./BaseService";
import { logFinanceError } from "@/lib/logger";
import { TransactionFingerprintService as FP } from "./TransactionFingerprintService";
import { MovementType, INCOME_TYPES, EXPENSE_TYPES } from "@/constants/enums";
import type {
  ClassificationRule,
  CreateClassificationRuleInput,
  UpdateClassificationRuleInput,
  RuleDirection,
  UUID,
} from "@/models";

type Row = Record<string, unknown>;

/** Tipos de casamento textual, do mais específico para o mais genérico. */
export type RuleMatchKind = "FINGERPRINT" | "FULL" | "PARTIAL" | "KEYWORD";

export const RULE_KIND_ORDER: Record<RuleMatchKind, number> = {
  FINGERPRINT: 4,
  FULL: 3,
  PARTIAL: 2,
  KEYWORD: 1,
};

export const RULE_KIND_CONFIDENCE: Record<RuleMatchKind, number> = {
  FINGERPRINT: 100,
  FULL: 95,
  PARTIAL: 85,
  KEYWORD: 70,
};

export const RULE_KIND_LABEL: Record<RuleMatchKind, string> = {
  FINGERPRINT: "Fingerprint exato",
  FULL: "Descrição completa",
  PARTIAL: "Descrição parcial",
  KEYWORD: "Palavra-chave",
};

/** Peso de cada condição estrutural no cálculo da especificidade. */
export const SPECIFICITY_WEIGHTS = {
  kind: { FINGERPRINT: 40, FULL: 30, PARTIAL: 20, KEYWORD: 10 } as Record<RuleMatchKind, number>,
  counterparty: 50,
  movementType: 15,
  direction: 12,
  account: 10,
  card: 10,
} as const;

/** Contexto da movimentação avaliada. Só usa dados presentes no Movement. */
export interface RuleContext {
  description: string;
  type?: MovementType | null;
  amount?: number | null;
  account_id?: UUID | null;
  transfer_account_id?: UUID | null;
  card_id?: UUID | null;
}

/** Direção efetiva: entrada, saída ou transferência entre contas próprias. */
export type EffectiveDirection = RuleDirection | "INTERNAL" | null;

export interface RuleEvaluation {
  rule: ClassificationRule;
  kind: RuleMatchKind;
  fingerprint: string;
  counterparty: string;
  confidence: number;
  /** Score numérico de especificidade (quanto maior, mais específica). */
  specificity: number;
  /** Rótulo legível: Alta / Média / Baixa. */
  specificityLabel: "Alta" | "Média" | "Baixa";
  /** Condições que casaram — usado no dry-run para explicar a decisão. */
  matchedConditions: string[];
  reason: string;
}

export interface RuleSimulation {
  description: string;
  fingerprint: string;
  counterparty: string;
  rule: ClassificationRule | null;
  kind: RuleMatchKind | null;
  categoryId: UUID | null;
  subcategoryId: UUID | null;
  confidence: number;
  specificity: number;
  specificityLabel: "Alta" | "Média" | "Baixa" | null;
  priority: number | null;
  reason: string;
  /** Demais regras compatíveis, já ordenadas (transparência da decisão). */
  candidates: RuleEvaluation[];
}

/** Relatório de reprocessamento de regras (dry run ou aplicado). */
export interface ReprocessReport {
  /** Movimentações analisadas (sem categoria, exceto transferências/pagamentos). */
  analyzed: number;
  withoutCategory: number;
  /** Quantas seriam classificadas pelas regras atuais. */
  wouldClassify: number;
  /** Quantas continuariam sem categoria. */
  wouldRemain: number;
  /** Quantas foram efetivamente classificadas (0 no dry run). */
  classified: number;
  elapsedMs: number;
  applied: boolean;
  /** Quantidade por regra vencedora (Sprint 4.5.1). */
  byRule: Array<{ ruleId: UUID; pattern: string; count: number }>;
  /** Quantidade por categoria de destino. */
  byCategory: Array<{ categoryId: UUID; count: number }>;
  /** Movimentações em que houve empate estrutural entre regras divergentes. */
  conflicts: number;
}

class ClassificationRuleServiceImpl extends BaseService {
  private readonly table = "classification_rules" as const;

  private map(r: Row): ClassificationRule {
    return r as unknown as ClassificationRule;
  }

  async list(workspaceId: UUID): Promise<ClassificationRule[]> {
    const { data, error } = await this.client
      .from(this.table)
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) this.handleError(error, "list");
    return (data ?? []).map((r) => this.map(r as Row));
  }

  async create(input: CreateClassificationRuleInput): Promise<ClassificationRule> {
    const pattern = input.text_pattern.trim();
    if (!pattern) this.handleError(new Error("Padrão de texto obrigatório."), "create");
    const payload = {
      workspace_id: input.workspace_id,
      text_pattern: pattern,
      category_id: input.category_id ?? null,
      subcategory_id: input.subcategory_id ?? null,
      priority: input.priority ?? 100,
      enabled: input.enabled ?? true,
      counterparty_pattern: input.counterparty_pattern?.trim() || null,
      movement_type: input.movement_type ?? null,
      direction: input.direction ?? null,
      account_id: input.account_id ?? null,
      card_id: input.card_id ?? null,
    };
    const { data, error } = await this.client
      .from(this.table)
      .insert(payload as never)
      .select("*")
      .single();
    if (error) this.handleError(error, "create");
    return this.map(data as Row);
  }

  async update(id: UUID, input: UpdateClassificationRuleInput): Promise<ClassificationRule> {
    const payload: Row = { ...input };
    if (typeof input.text_pattern === "string") payload.text_pattern = input.text_pattern.trim();
    if (typeof input.counterparty_pattern === "string") {
      payload.counterparty_pattern = input.counterparty_pattern.trim() || null;
    }
    const { data, error } = await this.client
      .from(this.table)
      .update(payload as never)
      .eq("id", id)
      .select("*")
      .single();
    if (error) this.handleError(error, "update");
    return this.map(data as Row);
  }

  async softDelete(id: UUID): Promise<void> {
    const { error } = await this.client
      .from(this.table)
      .update({ deleted_at: new Date().toISOString() } as never)
      .eq("id", id);
    if (error) this.handleError(error, "softDelete");
  }

  /** Cria (ou reutiliza) regra a partir de uma classificação manual. */
  async rememberFromMovement(params: {
    workspaceId: UUID;
    description: string;
    categoryId: UUID | null;
    subcategoryId: UUID | null;
  }): Promise<ClassificationRule | null> {
    const pattern = ClassificationRuleServiceImpl.suggestPattern(params.description);
    if (!pattern) return null;
    // Contraparte torna a regra específica e evita "regras muito amplas".
    const counterparty = ClassificationRuleServiceImpl.suggestCounterpartyPattern(
      params.description,
    );
    const existing = await this.client
      .from(this.table)
      .select("*")
      .eq("workspace_id", params.workspaceId)
      .ilike("text_pattern", pattern)
      .is("deleted_at", null)
      .maybeSingle();
    if (existing.data) {
      const row = existing.data as unknown as ClassificationRule;
      const sameCounterparty = (row.counterparty_pattern ?? "") === (counterparty ?? "");
      if (sameCounterparty) {
        return this.update(row.id, {
          category_id: params.categoryId,
          subcategory_id: params.subcategoryId,
          enabled: true,
        });
      }
      // Mesma descrição base, contraparte diferente → nova regra específica.
    }
    return this.create({
      workspace_id: params.workspaceId,
      text_pattern: pattern,
      counterparty_pattern: counterparty,
      category_id: params.categoryId,
      subcategory_id: params.subcategoryId,
    });
  }

  // ---------------------------------------------------------------------------
  // Motor de regras (puro, sem I/O)
  // ---------------------------------------------------------------------------

  /**
   * Direção efetiva da movimentação.
   * Transferências entre contas próprias são INTERNAL e jamais viram
   * receita ou despesa por causa do texto da descrição.
   */
  static direction(ctx: RuleContext): EffectiveDirection {
    const type = ctx.type ?? null;
    if (type === MovementType.TRANSFER) return "INTERNAL";
    if (type && (INCOME_TYPES as readonly MovementType[]).includes(type)) return "IN";
    if (type && (EXPENSE_TYPES as readonly MovementType[]).includes(type)) return "OUT";
    if (typeof ctx.amount === "number" && ctx.amount !== 0) {
      return ctx.amount > 0 ? "IN" : "OUT";
    }
    const normalized = FP.normalize(ctx.description);
    if (/\brecebid[ao]\b/.test(normalized)) return "IN";
    if (/\benviad[ao]\b/.test(normalized)) return "OUT";
    return null;
  }

  /** Determina o tipo de casamento textual entre padrão e descrição (ou null). */
  static classifyMatch(params: {
    normalized: string;
    fingerprint: string;
    patternNormalized: string;
    patternFingerprint: string;
  }): RuleMatchKind | null {
    const { normalized, fingerprint, patternNormalized, patternFingerprint } = params;
    if (!patternNormalized) return null;
    if (patternFingerprint && fingerprint && patternFingerprint === fingerprint) {
      return "FINGERPRINT";
    }
    if (patternNormalized === normalized) return "FULL";
    if (!normalized.includes(patternNormalized)) return null;
    return patternNormalized.includes(" ") ? "PARTIAL" : "KEYWORD";
  }

  /** Score de especificidade da regra dentro de um casamento concreto. */
  static scoreSpecificity(rule: ClassificationRule, kind: RuleMatchKind): number {
    let score = SPECIFICITY_WEIGHTS.kind[kind];
    if (rule.counterparty_pattern) score += SPECIFICITY_WEIGHTS.counterparty;
    if (rule.movement_type) score += SPECIFICITY_WEIGHTS.movementType;
    if (rule.direction) score += SPECIFICITY_WEIGHTS.direction;
    if (rule.account_id) score += SPECIFICITY_WEIGHTS.account;
    if (rule.card_id) score += SPECIFICITY_WEIGHTS.card;
    return score;
  }

  static specificityLabel(score: number): "Alta" | "Média" | "Baixa" {
    if (score >= 70) return "Alta";
    if (score >= 30) return "Média";
    return "Baixa";
  }

  /** Todas as regras compatíveis com a movimentação, já ordenadas. */
  static evaluateAll(input: RuleContext | string, rules: ClassificationRule[]): RuleEvaluation[] {
    const ctx: RuleContext = typeof input === "string" ? { description: input } : input;
    const raw = (ctx.description ?? "").trim();
    if (!raw) return [];
    const normalized = FP.normalize(raw);
    const fingerprint = FP.build(raw);
    const counterparty = FP.counterpartyKey(raw);
    const direction = ClassificationRuleServiceImpl.direction(ctx);

    const candidates: RuleEvaluation[] = [];
    for (const rule of rules) {
      if (!rule.enabled || rule.deleted_at) continue;
      const pattern = rule.text_pattern.trim();
      if (!pattern) continue;

      // 1. Compatibilidade estrutural.
      if (rule.movement_type && ctx.type && rule.movement_type !== ctx.type) continue;
      if (rule.movement_type && !ctx.type) continue;
      if (rule.direction && rule.direction !== direction) continue;
      if (rule.account_id && rule.account_id !== ctx.account_id) continue;
      if (rule.card_id && rule.card_id !== ctx.card_id) continue;

      const matchedConditions: string[] = [];
      if (rule.counterparty_pattern) {
        const needle = FP.normalize(rule.counterparty_pattern);
        if (!needle) continue;
        const haystack = `${counterparty} ${normalized}`;
        if (!haystack.includes(needle)) continue;
        matchedConditions.push(`contraparte contém "${rule.counterparty_pattern}"`);
      }
      if (rule.movement_type) matchedConditions.push(`tipo ${rule.movement_type}`);
      if (rule.direction) {
        matchedConditions.push(rule.direction === "IN" ? "entrada" : "saída");
      }
      if (rule.account_id) matchedConditions.push("conta específica");
      if (rule.card_id) matchedConditions.push("cartão específico");

      const kind = ClassificationRuleServiceImpl.classifyMatch({
        normalized,
        fingerprint,
        patternNormalized: FP.normalize(pattern),
        patternFingerprint: FP.build(pattern),
      });
      if (!kind) continue;

      const specificity = ClassificationRuleServiceImpl.scoreSpecificity(rule, kind);
      candidates.push({
        rule,
        kind,
        fingerprint,
        counterparty,
        confidence: RULE_KIND_CONFIDENCE[kind],
        specificity,
        specificityLabel: ClassificationRuleServiceImpl.specificityLabel(specificity),
        matchedConditions,
        reason: [
          `${RULE_KIND_LABEL[kind]} em "${rule.text_pattern}"`,
          ...matchedConditions,
        ].join(" · "),
      });
    }

    // 2. especificidade → 3. prioridade → 4/5. tamanho dos padrões → 6. id.
    candidates.sort(
      (a, b) =>
        b.specificity - a.specificity ||
        b.rule.priority - a.rule.priority ||
        b.rule.text_pattern.length - a.rule.text_pattern.length ||
        (b.rule.counterparty_pattern?.length ?? 0) - (a.rule.counterparty_pattern?.length ?? 0) ||
        String(a.rule.id).localeCompare(String(b.rule.id)),
    );
    return candidates;
  }

  /** Regra vencedora (a mais específica). */
  static evaluate(
    input: RuleContext | string,
    rules: ClassificationRule[],
  ): RuleEvaluation | null {
    return ClassificationRuleServiceImpl.evaluateAll(input, rules)[0] ?? null;
  }

  /**
   * Há empate real quando duas regras têm a mesma especificidade e prioridade
   * mas destinos diferentes. O desempate continua determinístico, mas o
   * conflito é reportado ao usuário.
   */
  static hasTie(candidates: RuleEvaluation[]): boolean {
    const [a, b] = candidates;
    if (!a || !b) return false;
    if (a.specificity !== b.specificity || a.rule.priority !== b.rule.priority) return false;
    return (
      a.rule.category_id !== b.rule.category_id ||
      a.rule.subcategory_id !== b.rule.subcategory_id
    );
  }

  /** Simulador: descreve o que aconteceria com uma descrição/contexto. */
  static simulate(input: RuleContext | string, rules: ClassificationRule[]): RuleSimulation {
    const ctx: RuleContext = typeof input === "string" ? { description: input } : input;
    const candidates = ClassificationRuleServiceImpl.evaluateAll(ctx, rules);
    const top = candidates[0] ?? null;
    return {
      description: ctx.description,
      fingerprint: FP.build(ctx.description),
      counterparty: FP.counterparty(ctx.description),
      rule: top?.rule ?? null,
      kind: top?.kind ?? null,
      categoryId: top?.rule.category_id ?? null,
      subcategoryId: top?.rule.subcategory_id ?? null,
      confidence: top?.confidence ?? 0,
      specificity: top?.specificity ?? 0,
      specificityLabel: top?.specificityLabel ?? null,
      priority: top?.rule.priority ?? null,
      reason: top
        ? `${top.reason}${candidates.length > 1 ? ` · venceu ${candidates.length - 1} outra(s) regra(s)` : ""}`
        : "Nenhuma regra aplicável — a movimentação permanece sem categoria.",
      candidates,
    };
  }

  /** Compatibilidade: retorna apenas a regra vencedora. */
  static match(
    input: RuleContext | string,
    rules: ClassificationRule[],
  ): ClassificationRule | null {
    return ClassificationRuleServiceImpl.evaluate(input, rules)?.rule ?? null;
  }

  /**
   * Sugere um padrão razoável a partir de uma descrição livre:
   * pega os primeiros tokens significativos (>=3 chars), evitando datas e ruído.
   */
  static suggestPattern(description: string): string {
    const cleaned = (description ?? "")
      .replace(/\d{2}\/\d{2}(\/\d{2,4})?/g, " ")
      .replace(/\d{2,}/g, " ")
      .replace(/[^a-zA-ZÀ-ÿ\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned) return "";
    const tokens = cleaned.split(" ").filter((t) => t.length >= 3);
    return tokens.slice(0, 3).join(" ").toLowerCase();
  }

  /** Sugere a contraparte a memorizar junto com a regra (ou null). */
  static suggestCounterpartyPattern(description: string): string | null {
    const cp = FP.counterparty(description).trim();
    if (!cp) return null;
    const tokens = cp.split(/\s+/).filter((t) => t.length >= 3);
    if (!tokens.length) return null;
    const suggestion = tokens.slice(0, 3).join(" ");
    // Se a contraparte é igual ao próprio padrão de texto, não agrega.
    const pattern = ClassificationRuleServiceImpl.suggestPattern(description);
    if (FP.normalize(suggestion) === FP.normalize(pattern)) return null;
    return suggestion;
  }

  async incrementMatch(ids: UUID[]): Promise<void> {
    if (!ids.length) return;
    // Best-effort: atualiza contagem e last_matched_at sem falhar a operação principal.
    await this.client
      .from(this.table)
      .update({ last_matched_at: new Date().toISOString() } as never)
      .in("id", ids);
  }

  /**
   * Localiza movimentações sem categoria cuja descrição casa com um padrão.
   * Ignora transferências e pagamentos de cartão.
   */
  async findUnclassifiedMatches(workspaceId: UUID, pattern: string): Promise<UUID[]> {
    const needle = pattern.trim().toLowerCase();
    if (!needle) return [];
    const { data, error } = await this.client
      .from("movements")
      .select("id")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .is("category_id", null)
      .not("type", "in", "(TRANSFER,CARD_PAYMENT)")
      .ilike("description", `%${needle}%`);
    if (error) this.handleError(error, "findUnclassifiedMatches");
    return ((data ?? []) as { id: UUID }[]).map((r) => r.id);
  }

  /** Aplica categoria/subcategoria a um conjunto de movimentações. */
  async bulkClassify(
    ids: UUID[],
    patch: { category_id: UUID | null; subcategory_id: UUID | null },
  ): Promise<number> {
    if (!ids.length) return 0;
    const clean: Row = {
      category_id: patch.category_id,
      subcategory_id: patch.subcategory_id,
    };
    const { error } = await this.client
      .from("movements")
      .update(clean as never)
      .in("id", ids);
    if (error) this.handleError(error, "bulkClassify");
    return ids.length;
  }

  /**
   * Monta o plano de classificação (puro, sem gravar).
   * Só considera movimentações SEM categoria — classificação manual é intocável.
   */
  private async buildPlan(workspaceId: UUID): Promise<{
    rows: RuleContext[];
    plan: Map<UUID, { evaluation: RuleEvaluation; tie: boolean }>;
  }> {
    const rules = (await this.list(workspaceId)).filter((r) => r.enabled);
    const { data, error } = await this.client
      .from("movements")
      .select("id, description, type, amount, account_id, transfer_account_id, card_id")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .is("category_id", null)
      .not("type", "in", "(TRANSFER,CARD_PAYMENT)");
    if (error) {
      logFinanceError("rules", "buildPlan", error);
      this.handleError(error, "buildPlan");
    }

    const rows = ((data ?? []) as Array<RuleContext & { id: UUID }>).map((r) => ({
      ...r,
      amount: Number(r.amount ?? 0),
    }));
    const plan = new Map<UUID, { evaluation: RuleEvaluation; tie: boolean }>();
    for (const row of rows) {
      const candidates = ClassificationRuleServiceImpl.evaluateAll(row, rules);
      const top = candidates[0];
      if (!top || !top.rule.category_id) continue;
      plan.set((row as { id: UUID }).id, {
        evaluation: top,
        tie: ClassificationRuleServiceImpl.hasTie(candidates),
      });
    }
    return { rows, plan };
  }

  private static summarizePlan(
    plan: Map<UUID, { evaluation: RuleEvaluation; tie: boolean }>,
  ): Pick<ReprocessReport, "byRule" | "byCategory" | "conflicts"> {
    const byRule = new Map<UUID, { pattern: string; count: number }>();
    const byCategory = new Map<UUID, number>();
    let conflicts = 0;
    for (const { evaluation, tie } of plan.values()) {
      if (tie) conflicts++;
      const entry = byRule.get(evaluation.rule.id) ?? {
        pattern: evaluation.rule.text_pattern,
        count: 0,
      };
      entry.count++;
      byRule.set(evaluation.rule.id, entry);
      const cat = evaluation.rule.category_id as UUID;
      byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1);
    }
    return {
      byRule: [...byRule.entries()]
        .map(([ruleId, v]) => ({ ruleId, pattern: v.pattern, count: v.count }))
        .sort((a, b) => b.count - a.count),
      byCategory: [...byCategory.entries()]
        .map(([categoryId, count]) => ({ categoryId, count }))
        .sort((a, b) => b.count - a.count),
      conflicts,
    };
  }

  /**
   * DRY RUN — simula o reprocessamento sem gravar nada.
   * Nunca sobrescreve classificação manual.
   */
  async dryRunReprocess(workspaceId: UUID): Promise<ReprocessReport> {
    const t0 = Date.now();
    const { rows, plan } = await this.buildPlan(workspaceId);
    return {
      analyzed: rows.length,
      withoutCategory: rows.length,
      wouldClassify: plan.size,
      wouldRemain: rows.length - plan.size,
      classified: 0,
      elapsedMs: Date.now() - t0,
      applied: false,
      ...ClassificationRuleServiceImpl.summarizePlan(plan),
    };
  }

  /**
   * Reprocessa as regras contra movimentações SEM categoria do workspace.
   * Aplica exatamente o plano do dry-run (regra vencedora por movimentação).
   */
  async reprocessAll(workspaceId: UUID): Promise<ReprocessReport> {
    const t0 = Date.now();
    const { rows, plan } = await this.buildPlan(workspaceId);

    // Agrupa por destino para minimizar consultas.
    const groups = new Map<string, { ids: UUID[]; category_id: UUID; subcategory_id: UUID | null }>();
    for (const [id, { evaluation }] of plan) {
      const category_id = evaluation.rule.category_id as UUID;
      const subcategory_id = evaluation.rule.subcategory_id;
      const key = `${category_id}|${subcategory_id ?? ""}`;
      const g = groups.get(key) ?? { ids: [], category_id, subcategory_id };
      g.ids.push(id);
      groups.set(key, g);
    }

    let classified = 0;
    for (const g of groups.values()) {
      try {
        classified += await this.bulkClassify(g.ids, {
          category_id: g.category_id,
          subcategory_id: g.subcategory_id,
        });
      } catch (e) {
        logFinanceError("rules", "reprocessAll", e);
        throw e;
      }
    }
    await this.incrementMatch([...new Set([...plan.values()].map((p) => p.evaluation.rule.id))]);

    return {
      analyzed: rows.length,
      withoutCategory: rows.length,
      wouldClassify: plan.size,
      wouldRemain: Math.max(0, rows.length - classified),
      classified,
      elapsedMs: Date.now() - t0,
      applied: true,
      ...ClassificationRuleServiceImpl.summarizePlan(plan),
    };
  }
}

export const ClassificationRuleService = new ClassificationRuleServiceImpl();
export { ClassificationRuleServiceImpl };
