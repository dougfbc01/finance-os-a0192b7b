// ClassificationRuleService — CRUD e aplicação de regras de classificação.
// Regras casam por substring (case-insensitive) contra a descrição da movimentação.
import { BaseService } from "./BaseService";
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
}

export const ClassificationRuleService = new ClassificationRuleServiceImpl();
export { ClassificationRuleServiceImpl };
