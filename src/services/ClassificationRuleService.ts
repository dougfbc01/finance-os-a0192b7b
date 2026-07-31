// ClassificationRuleService — CRUD e aplicação de regras de classificação.
// Regras casam por substring (case-insensitive) contra a descrição da movimentação.
import { BaseService } from "./BaseService";
import { logFinanceError } from "@/lib/logger";
import type {
  ClassificationRule,
  CreateClassificationRuleInput,
  UpdateClassificationRuleInput,
  UUID,
} from "@/models";

type Row = Record<string, unknown>;

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
    // Se já existir, apenas atualiza a classificação.
    const existing = await this.client
      .from(this.table)
      .select("*")
      .eq("workspace_id", params.workspaceId)
      .ilike("text_pattern", pattern)
      .is("deleted_at", null)
      .maybeSingle();
    if (existing.data) {
      return this.update((existing.data as { id: UUID }).id, {
        category_id: params.categoryId,
        subcategory_id: params.subcategoryId,
        enabled: true,
      });
    }
    return this.create({
      workspace_id: params.workspaceId,
      text_pattern: pattern,
      category_id: params.categoryId,
      subcategory_id: params.subcategoryId,
    });
  }

  /** Aplica lista de regras a uma descrição, retornando a de maior prioridade que casar. */
  static match(
    description: string,
    rules: ClassificationRule[],
  ): ClassificationRule | null {
    const text = (description ?? "").toLowerCase();
    if (!text) return null;
    const sorted = [...rules]
      .filter((r) => r.enabled && !r.deleted_at)
      .sort((a, b) => b.priority - a.priority);
    for (const rule of sorted) {
      const needle = rule.text_pattern.trim().toLowerCase();
      if (!needle) continue;
      if (text.includes(needle)) return rule;
    }
    return null;
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
  async findUnclassifiedMatches(
    workspaceId: UUID,
    pattern: string,
  ): Promise<UUID[]> {
    const needle = pattern.trim().toLowerCase();
    if (!needle) return [];
    const { data, error } = await this.client
      .from("movements")
      .select("id, description, type")
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
   * DRY RUN (Sprint 3.6) — simula o reprocessamento sem gravar nada.
   * Só considera movimentações SEM categoria; nunca sobrescreve classificação manual.
   */
  async dryRunReprocess(workspaceId: UUID): Promise<ReprocessReport> {
    const t0 = Date.now();
    const rules = (await this.list(workspaceId)).filter((r) => r.enabled);

    const { data, error } = await this.client
      .from("movements")
      .select("id, description")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .is("category_id", null)
      .not("type", "in", "(TRANSFER,CARD_PAYMENT)");
    if (error) {
      logFinanceError("rules", "dryRunReprocess", error);
      this.handleError(error, "dryRunReprocess");
    }

    const rows = (data ?? []) as { id: UUID; description: string }[];
    const plan = new Map<UUID, { category_id: UUID | null; subcategory_id: UUID | null }>();
    for (const row of rows) {
      const match = ClassificationRuleServiceImpl.match(row.description, rules);
      if (match && match.category_id) {
        plan.set(row.id, {
          category_id: match.category_id,
          subcategory_id: match.subcategory_id,
        });
      }
    }

    return {
      analyzed: rows.length,
      withoutCategory: rows.length,
      wouldClassify: plan.size,
      wouldRemain: rows.length - plan.size,
      classified: 0,
      elapsedMs: Date.now() - t0,
      applied: false,
    };
  }

  /**
   * Reprocessa as regras contra movimentações SEM categoria do workspace.
   * Nunca sobrescreve classificação manual. Retorna relatório completo.
   */
  async reprocessAll(workspaceId: UUID): Promise<ReprocessReport> {
    const t0 = Date.now();
    const dry = await this.dryRunReprocess(workspaceId);
    const rules = (await this.list(workspaceId)).filter((r) => r.enabled);

    let classified = 0;
    for (const rule of rules) {
      if (!rule.category_id) continue;
      try {
        const ids = await this.findUnclassifiedMatches(workspaceId, rule.text_pattern);
        if (!ids.length) continue;
        classified += await this.bulkClassify(ids, {
          category_id: rule.category_id,
          subcategory_id: rule.subcategory_id,
        });
      } catch (e) {
        logFinanceError("rules", `reprocessAll:${rule.text_pattern}`, e);
        throw e;
      }
    }

    return {
      analyzed: dry.analyzed,
      withoutCategory: dry.withoutCategory,
      wouldClassify: dry.wouldClassify,
      wouldRemain: Math.max(0, dry.analyzed - classified),
      classified,
      elapsedMs: Date.now() - t0,
      applied: true,
    };
  }
}

export const ClassificationRuleService = new ClassificationRuleServiceImpl();
export { ClassificationRuleServiceImpl };
