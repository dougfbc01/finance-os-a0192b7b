import { BaseService } from "./BaseService";
import type {
  Category,
  CreateCategoryInput,
  UpdateCategoryInput,
  UUID,
} from "@/models";

class CategoryServiceImpl extends BaseService {
  private readonly table = "categories" as const;

  async getAll(workspaceId: UUID): Promise<Category[]> {
    const { data, error } = await this.client
      .from(this.table)
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) this.handleError(error, "getAll");
    return (data ?? []) as Category[];
  }

  async getById(id: UUID): Promise<Category | null> {
    const { data, error } = await this.client
      .from(this.table)
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) this.handleError(error, "getById");
    return (data as Category | null) ?? null;
  }

  async validateDuplicate(
    workspaceId: UUID,
    name: string,
    excludeId?: UUID,
  ): Promise<boolean> {
    const trimmed = name.trim();
    if (!trimmed) return false;

    let query = this.client
      .from(this.table)
      .select("id")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .ilike("name", trimmed);

    if (excludeId) query = query.neq("id", excludeId);

    const { data, error } = await query.limit(1);
    if (error) this.handleError(error, "validateDuplicate");
    return (data ?? []).length > 0;
  }

  async create(input: CreateCategoryInput): Promise<Category> {
    const name = input.name.trim();
    if (!name) this.handleError(new Error("Nome é obrigatório"), "create");

    const duplicate = await this.validateDuplicate(input.workspace_id, name);
    if (duplicate) {
      this.handleError(
        new Error("Já existe uma categoria com este nome neste workspace."),
        "create",
      );
    }

    const payload = {
      workspace_id: input.workspace_id,
      name,
      type: input.type,
      color: input.color ?? "#7C3AED",
      icon: input.icon ?? "folder",
      display_order: input.display_order ?? 0,
      is_system: false,
      is_active: true,
    };

    const { data, error } = await this.client
      .from(this.table)
      .insert(payload)
      .select("*")
      .single();

    if (error) this.handleError(error, "create");
    return data as Category;
  }

  async update(id: UUID, input: UpdateCategoryInput): Promise<Category> {
    const existing = await this.getById(id);
    if (!existing) this.handleError(new Error("Categoria não encontrada."), "update");

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) this.handleError(new Error("Nome é obrigatório"), "update");
      const duplicate = await this.validateDuplicate(existing!.workspace_id, name, id);
      if (duplicate) {
        this.handleError(
          new Error("Já existe uma categoria com este nome neste workspace."),
          "update",
        );
      }
    }

    const payload: Record<string, unknown> = { ...input };
    if (payload.name && typeof payload.name === "string") {
      payload.name = (payload.name as string).trim();
    }

    const { data, error } = await this.client
      .from(this.table)
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) this.handleError(error, "update");
    return data as Category;
  }

  async setActive(id: UUID, isActive: boolean): Promise<Category> {
    return this.update(id, { is_active: isActive });
  }

  /**
   * Prepara validação de uso futuro. Como movimentações ainda não existem,
   * retorna sempre false — mas o ponto de extensão está pronto.
   */
  async isInUse(_id: UUID): Promise<boolean> {
    return false;
  }

  /**
   * Aciona o Seed inicial para um workspace. A função no banco é idempotente.
   * Chamada normalmente pelo trigger de novo usuário; aqui apenas expõe o gancho.
   */
  async createSeedCategories(_workspaceId: UUID): Promise<void> {
    // O seed é executado no servidor via trigger handle_new_user.
    // Este método existe para atender ao contrato e permitir chamadas futuras.
    return;
  }
}

export const CategoryService = new CategoryServiceImpl();
