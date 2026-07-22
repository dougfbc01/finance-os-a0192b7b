import { BaseService } from "./BaseService";
import type {
  Subcategory,
  CreateSubcategoryInput,
  UpdateSubcategoryInput,
  UUID,
} from "@/models";

class SubcategoryServiceImpl extends BaseService {
  private readonly table = "subcategories" as const;

  async getAll(workspaceId: UUID): Promise<Subcategory[]> {
    const { data, error } = await this.client
      .from(this.table)
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) this.handleError(error, "getAll");
    return (data ?? []) as Subcategory[];
  }

  async getByCategory(categoryId: UUID): Promise<Subcategory[]> {
    const { data, error } = await this.client
      .from(this.table)
      .select("*")
      .eq("category_id", categoryId)
      .is("deleted_at", null)
      .order("display_order", { ascending: true });

    if (error) this.handleError(error, "getByCategory");
    return (data ?? []) as Subcategory[];
  }

  async getById(id: UUID): Promise<Subcategory | null> {
    const { data, error } = await this.client
      .from(this.table)
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) this.handleError(error, "getById");
    return (data as Subcategory | null) ?? null;
  }

  async validateDuplicate(
    categoryId: UUID,
    name: string,
    excludeId?: UUID,
  ): Promise<boolean> {
    const trimmed = name.trim();
    if (!trimmed) return false;

    let query = this.client
      .from(this.table)
      .select("id")
      .eq("category_id", categoryId)
      .is("deleted_at", null)
      .ilike("name", trimmed);

    if (excludeId) query = query.neq("id", excludeId);

    const { data, error } = await query.limit(1);
    if (error) this.handleError(error, "validateDuplicate");
    return (data ?? []).length > 0;
  }

  async create(input: CreateSubcategoryInput): Promise<Subcategory> {
    const name = input.name.trim();
    if (!name) this.handleError(new Error("Nome é obrigatório"), "create");

    const duplicate = await this.validateDuplicate(input.category_id, name);
    if (duplicate) {
      this.handleError(
        new Error("Já existe uma subcategoria com este nome nesta categoria."),
        "create",
      );
    }

    const payload = {
      category_id: input.category_id,
      workspace_id: input.workspace_id,
      name,
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
    return data as Subcategory;
  }

  async update(id: UUID, input: UpdateSubcategoryInput): Promise<Subcategory> {
    const existing = await this.getById(id);
    if (!existing) this.handleError(new Error("Subcategoria não encontrada."), "update");

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) this.handleError(new Error("Nome é obrigatório"), "update");
      const duplicate = await this.validateDuplicate(existing!.category_id, name, id);
      if (duplicate) {
        this.handleError(
          new Error("Já existe uma subcategoria com este nome nesta categoria."),
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
    return data as Subcategory;
  }

  async setActive(id: UUID, isActive: boolean): Promise<Subcategory> {
    return this.update(id, { is_active: isActive });
  }

  async isInUse(_id: UUID): Promise<boolean> {
    return false;
  }
}

export const SubcategoryService = new SubcategoryServiceImpl();
