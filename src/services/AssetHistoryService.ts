// AssetHistoryService — Sprint 4.8.1
// Regras puras do cadastro em lote de histórico de aquisições de um ativo.
// Cada linha (data, quantidade, preço unitário) vira uma movimentação
// histórica (is_historical = true) vinculada ao ativo — sem tocar no caixa.
import { BaseService } from "./BaseService";
import {
  InvestmentOperation,
  INVESTMENT_OP_TAG_PREFIX,
  MovementStatus,
  MovementType,
} from "@/constants/enums";
import type { CreateMovementInput, Movement, UUID } from "@/models";

export interface AssetAcquisitionEntry {
  /** yyyy-mm-dd */
  date: string;
  quantity: number;
  unit_price: number;
}

export interface AssetAcquisitionTotals {
  count: number;
  quantity: number;
  cost: number;
  averagePrice: number;
}

export interface BuildHistoryResult {
  inputs: CreateMovementInput[];
  /** Linhas ignoradas por já existirem (mesma data, quantidade e preço). */
  duplicates: AssetAcquisitionEntry[];
  /** Linhas ignoradas por estarem incompletas/inválidas. */
  invalid: AssetAcquisitionEntry[];
}

const round2 = (n: number) => Number(n.toFixed(2));
const round8 = (n: number) => Number(n.toFixed(8));

class AssetHistoryServiceImpl extends BaseService {
  /** Valor financeiro da linha (quantidade × preço unitário). */
  static amountOf(entry: AssetAcquisitionEntry): number {
    return round2((Number(entry.quantity) || 0) * (Number(entry.unit_price) || 0));
  }

  static isValid(entry: AssetAcquisitionEntry): boolean {
    const qty = Number(entry.quantity);
    const price = Number(entry.unit_price);
    return (
      !!entry.date &&
      /^\d{4}-\d{2}-\d{2}$/.test(entry.date) &&
      Number.isFinite(qty) &&
      qty > 0 &&
      Number.isFinite(price) &&
      price > 0
    );
  }

  /** Totais consolidados das linhas válidas (quantidade, custo e preço médio). */
  static totals(entries: AssetAcquisitionEntry[]): AssetAcquisitionTotals {
    const valid = entries.filter(AssetHistoryServiceImpl.isValid);
    const quantity = round8(valid.reduce((s, e) => s + Number(e.quantity), 0));
    const cost = round2(valid.reduce((s, e) => s + AssetHistoryServiceImpl.amountOf(e), 0));
    return {
      count: valid.length,
      quantity,
      cost,
      averagePrice: quantity > 0 ? Number((cost / quantity).toFixed(6)) : 0,
    };
  }

  /** Já existe uma aquisição histórica idêntica registrada para o ativo? */
  static existsIn(entry: AssetAcquisitionEntry, assetId: UUID, movements: Movement[]): boolean {
    const amount = AssetHistoryServiceImpl.amountOf(entry);
    return movements.some(
      (m) =>
        m.asset_id === assetId &&
        !m.deleted_at &&
        m.is_historical &&
        m.transaction_date === entry.date &&
        round8(Number(m.quantity ?? 0)) === round8(Number(entry.quantity)) &&
        round2(Number(m.amount) || 0) === amount,
    );
  }

  /**
   * Converte as linhas em payloads de movimentações históricas de aporte.
   * Nada é persistido aqui: a decisão de gravar é do chamador.
   */
  static buildMovementInputs(params: {
    workspaceId: UUID;
    assetId: UUID;
    assetName: string;
    entries: AssetAcquisitionEntry[];
    existingMovements?: Movement[];
  }): BuildHistoryResult {
    const { workspaceId, assetId, assetName, entries, existingMovements = [] } = params;
    const inputs: CreateMovementInput[] = [];
    const duplicates: AssetAcquisitionEntry[] = [];
    const invalid: AssetAcquisitionEntry[] = [];
    const seen = new Set<string>();

    for (const entry of entries) {
      if (!AssetHistoryServiceImpl.isValid(entry)) {
        invalid.push(entry);
        continue;
      }
      const key = `${entry.date}|${round8(Number(entry.quantity))}|${AssetHistoryServiceImpl.amountOf(entry)}`;
      if (seen.has(key) || AssetHistoryServiceImpl.existsIn(entry, assetId, existingMovements)) {
        duplicates.push(entry);
        continue;
      }
      seen.add(key);
      inputs.push({
        workspace_id: workspaceId,
        asset_id: assetId,
        account_id: null,
        card_id: null,
        type: MovementType.INVESTMENT,
        status: MovementStatus.CLEARED,
        description: `Aquisição histórica — ${assetName}`,
        amount: AssetHistoryServiceImpl.amountOf(entry),
        transaction_date: entry.date,
        competence_date: entry.date,
        is_historical: true,
        quantity: round8(Number(entry.quantity)),
        unit_price: Number(Number(entry.unit_price).toFixed(6)),
        tags: [`${INVESTMENT_OP_TAG_PREFIX}${InvestmentOperation.APORTE}`],
      });
    }

    return { inputs, duplicates, invalid };
  }
}

export { AssetHistoryServiceImpl };
export const AssetHistoryService = AssetHistoryServiceImpl;
