// AccountService
// Regras de negócio das contas financeiras.
import { BaseService } from "./BaseService";
import type {
  Account,
  CreateAccountInput,
  UpdateAccountInput,
  UUID,
} from "@/models";

class AccountServiceImpl extends BaseService {
  private readonly table = "accounts" as const;

  /**
   * Lista todas as contas (ativas e inativas) do workspace,
   * excluindo apenas as apagadas logicamente.
   */
  async getAccounts(workspaceId: UUID): Promise<Account[]> {
    const { data, error } = await this.client
      .from(this.table)
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) this.handleError(error, "getAccounts");
    return (data ?? []) as Account[];
  }

  async getAccountById(id: UUID): Promise<Account | null> {
    const { data, error } = await this.client
      .from(this.table)
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) this.handleError(error, "getAccountById");
    return (data as Account | null) ?? null;
  }

  /**
   * Verifica se já existe uma conta com o mesmo nome no workspace.
   * Comparação case-insensitive. `excludeId` é usado em edição.
   */
  async validateDuplicateName(
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
    if (error) this.handleError(error, "validateDuplicateName");
    return (data ?? []).length > 0;
  }

  async createAccount(input: CreateAccountInput): Promise<Account> {
    const name = input.name.trim();
    if (!name) this.handleError(new Error("Nome é obrigatório"), "createAccount");

    const duplicate = await this.validateDuplicateName(input.workspace_id, name);
    if (duplicate) {
      this.handleError(
        new Error("Já existe uma conta com este nome neste workspace."),
        "createAccount",
      );
    }

    const payload = {
      workspace_id: input.workspace_id,
      name,
      institution: input.institution?.trim() || null,
      account_type: input.account_type,
      currency: input.currency,
      initial_balance: input.initial_balance,
      color: input.color,
      icon: input.icon,
      display_order: input.display_order ?? 0,
      is_active: true,
    };

    const { data, error } = await this.client
      .from(this.table)
      .insert(payload)
      .select("*")
      .single();

    if (error) this.handleError(error, "createAccount");
    return data as Account;
  }

  async updateAccount(id: UUID, input: UpdateAccountInput): Promise<Account> {
    const existing = await this.getAccountById(id);
    if (!existing) this.handleError(new Error("Conta não encontrada."), "updateAccount");

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) this.handleError(new Error("Nome é obrigatório"), "updateAccount");

      const duplicate = await this.validateDuplicateName(
        existing!.workspace_id,
        name,
        id,
      );
      if (duplicate) {
        this.handleError(
          new Error("Já existe uma conta com este nome neste workspace."),
          "updateAccount",
        );
      }
    }

    const payload: Record<string, unknown> = { ...input };
    if (payload.name && typeof payload.name === "string") {
      payload.name = (payload.name as string).trim();
    }
    if (payload.institution !== undefined && typeof payload.institution === "string") {
      payload.institution = (payload.institution as string).trim() || null;
    }

    const { data, error } = await this.client
      .from(this.table)
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) this.handleError(error, "updateAccount");
    return data as Account;
  }

  /**
   * Alterna o status ativo/inativo. Nunca remove do banco.
   */
  async setActive(id: UUID, isActive: boolean): Promise<Account> {
    return this.updateAccount(id, { is_active: isActive });
  }

  /**
   * Desativa a conta. Não remove fisicamente.
   */
  async deactivateAccount(id: UUID): Promise<Account> {
    return this.setActive(id, false);
  }

  /**
   * Reativa a conta.
   */
  async activateAccount(id: UUID): Promise<Account> {
    return this.setActive(id, true);
  }
}

export const AccountService = new AccountServiceImpl();
