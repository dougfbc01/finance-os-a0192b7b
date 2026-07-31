// HealthCheckService — Integridade Financeira (Sprint 3.6).
// Toda a verificação roda no banco (função financial_health_check) para
// garantir que o diagnóstico use a mesma fonte de verdade dos triggers.
import { BaseService } from "./BaseService";
import { logFinanceError } from "@/lib/logger";
import type { UUID } from "@/models";

export interface HealthCheckItem {
  key: string;
  label: string;
  count: number;
  ok: boolean;
}

export interface HealthCheckReport {
  items: HealthCheckItem[];
  issues: number;
  checkedAt: string;
}

const LABELS: Record<string, string> = {
  invoices_orfas: "Faturas órfãs (cartão inexistente)",
  invoices_zeradas: "Faturas zeradas com lançamentos",
  invoices_divergentes: "Faturas com valor divergente",
  compras_sem_invoice: "Compras de cartão sem fatura",
  invoice_id_invalido: "Movimentações com fatura inexistente",
  assets_inconsistentes: "Ativos com valor inconsistente",
  investimentos_sem_asset: "Investimentos sem ativo vinculado",
  transferencias_incompletas: "Transferências incompletas",
  categorias_invalidas: "Subcategorias fora da categoria",
  imports_inconsistentes: "Importações com falha",
  movimentacoes_sem_categoria: "Movimentações sem categoria",
};

/** Itens informativos: não bloqueiam a homologação. */
const INFO_KEYS = new Set(["movimentacoes_sem_categoria", "imports_inconsistentes"]);

class HealthCheckServiceImpl extends BaseService {
  async run(workspaceId: UUID): Promise<HealthCheckReport> {
    const { data, error } = await this.client.rpc(
      "financial_health_check" as never,
      { _workspace_id: workspaceId } as never,
    );
    if (error) {
      logFinanceError("health", "run", error);
      this.handleError(error, "run");
    }
    const raw = (data ?? {}) as Record<string, unknown>;
    const items: HealthCheckItem[] = Object.keys(LABELS).map((key) => {
      const count = Number(raw[key] ?? 0);
      return { key, label: LABELS[key], count, ok: count === 0 };
    });
    const issues = items.filter((i) => !i.ok && !INFO_KEYS.has(i.key)).length;
    return {
      items,
      issues,
      checkedAt: String(raw.checked_at ?? new Date().toISOString()),
    };
  }

  /** Reconstrói o valor de todas as faturas do workspace. */
  async rebuildInvoices(workspaceId: UUID): Promise<number> {
    const { data, error } = await this.client.rpc(
      "recompute_workspace_invoices" as never,
      { _workspace_id: workspaceId } as never,
    );
    if (error) {
      logFinanceError("invoices", "rebuildInvoices", error);
      this.handleError(error, "rebuildInvoices");
    }
    return Number(data ?? 0);
  }

  static isInfo(key: string): boolean {
    return INFO_KEYS.has(key);
  }
}

export const HealthCheckService = new HealthCheckServiceImpl();
export { HealthCheckServiceImpl };
