// AssetService — CRUD de ativos patrimoniais.
// Regras: nunca inclui o saldo bancário; representa apenas ativos declarados
// (investimentos, caixinhas, previdência, etc.).
import { BaseService } from "./BaseService";
import { AssetValuationSource } from "@/constants/enums";
import type { Asset, CreateAssetInput, UpdateAssetInput, UUID } from "@/models";

type Row = Record<string, unknown>;

class AssetServiceImpl extends BaseService {
  private readonly table = "assets" as const;

  private mapRow(r: Row): Asset {
    return {
      ...(r as unknown as Asset),
      quantity: Number((r as { quantity: unknown }).quantity ?? 0),
      unit_price: Number((r as { unit_price: unknown }).unit_price ?? 0),
      current_value: Number((r as { current_value: unknown }).current_value ?? 0),
      acquisition_value: Number((r as { acquisition_value: unknown }).acquisition_value ?? 0),
      opening_value: Number((r as { opening_value?: unknown }).opening_value ?? 0),
      valuation_source:
        ((r as { valuation_source?: AssetValuationSource }).valuation_source ??
          AssetValuationSource.MANUAL) as AssetValuationSource,
      account_id: ((r as { account_id?: UUID | null }).account_id ?? null) as UUID | null,
    };
  }


  async list(workspaceId: UUID): Promise<Asset[]> {
    const { data, error } = await this.client
      .from(this.table)
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("asset_type", { ascending: true })
      .order("name", { ascending: true });
    if (error) this.handleError(error, "list");
    return (data ?? []).map((r) => this.mapRow(r as Row));
  }

  async getById(id: UUID): Promise<Asset | null> {
    const { data, error } = await this.client
      .from(this.table)
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) this.handleError(error, "getById");
    return data ? this.mapRow(data as Row) : null;
  }

  private validate(input: Partial<CreateAssetInput>) {
    if (input.name !== undefined && !input.name.trim())
      this.handleError(new Error("Nome do ativo é obrigatório."), "validate");
    if (input.current_value !== undefined && input.current_value < 0)
      this.handleError(new Error("Valor atual não pode ser negativo."), "validate");
    if (input.quantity !== undefined && input.quantity < 0)
      this.handleError(new Error("Quantidade não pode ser negativa."), "validate");
    if (input.valuation_source === AssetValuationSource.ACCOUNT && !input.account_id)
      this.handleError(
        new Error("Selecione a conta que este ativo deve espelhar."),
        "validate",
      );
    if (input.valuation_source && input.valuation_source !== AssetValuationSource.ACCOUNT && input.account_id)
      this.handleError(
        new Error("A conta vinculada só se aplica a ativos que espelham uma conta."),
        "validate",
      );
  }

  async create(input: CreateAssetInput): Promise<Asset> {
    this.validate(input);
    const source = input.valuation_source ?? AssetValuationSource.MANUAL;
    const payload: Row = {
      workspace_id: input.workspace_id,
      name: input.name.trim(),
      asset_type: input.asset_type,
      institution: input.institution?.trim() || null,
      currency: input.currency ?? "BRL",
      quantity: input.quantity ?? 0,
      unit_price: input.unit_price ?? 0,
      current_value: input.current_value,
      acquisition_value: input.acquisition_value ?? input.current_value,
      acquisition_date: input.acquisition_date ?? null,
      notes: input.notes ?? null,
      is_active: true,
      valuation_source: source,
      account_id: source === AssetValuationSource.ACCOUNT ? (input.account_id ?? null) : null,
      opening_value:
        source === AssetValuationSource.MOVEMENTS
          ? (input.opening_value ?? 0)
          : 0,
    };

    const { data, error } = await this.client
      .from(this.table)
      .insert(payload as never)
      .select("*")
      .single();
    if (error) this.handleError(error, "create");
    return this.mapRow(data as Row);
  }

  async update(id: UUID, input: UpdateAssetInput): Promise<Asset> {
    this.validate(input);
    const payload: Row = { ...input };
    if (typeof payload.name === "string") payload.name = (payload.name as string).trim();
    if (typeof payload.institution === "string")
      payload.institution = (payload.institution as string).trim() || null;
    if (input.valuation_source && input.valuation_source !== AssetValuationSource.ACCOUNT) {
      payload.account_id = null;
    }
    if (input.valuation_source && input.valuation_source !== AssetValuationSource.MOVEMENTS) {
      payload.opening_value = 0;
    }

    const { data, error } = await this.client
      .from(this.table)
      .update(payload as never)
      .eq("id", id)
      .select("*")
      .single();
    if (error) this.handleError(error, "update");
    return this.mapRow(data as Row);
  }

  async setActive(id: UUID, isActive: boolean): Promise<void> {
    const { error } = await this.client
      .from(this.table)
      .update({ is_active: isActive } as never)
      .eq("id", id);
    if (error) this.handleError(error, "setActive");
  }

  async softDelete(id: UUID): Promise<void> {
    const { error } = await this.client
      .from(this.table)
      .update({ deleted_at: new Date().toISOString() } as never)
      .eq("id", id);
    if (error) this.handleError(error, "softDelete");
  }

  // -------------------------------------------------------------------------
  // Derivados
  // -------------------------------------------------------------------------

  /** Rentabilidade absoluta = valor atual − valor de aquisição. */
  static profit(asset: Asset): number {
    return Number((asset.current_value - asset.acquisition_value).toFixed(2));
  }

  /** Rentabilidade percentual em relação ao valor de aquisição. */
  static profitPercent(asset: Asset): number {
    if (!asset.acquisition_value) return 0;
    return Number((((asset.current_value - asset.acquisition_value) / asset.acquisition_value) * 100).toFixed(2));
  }
}

export const AssetService = new AssetServiceImpl();
export { AssetServiceImpl };
