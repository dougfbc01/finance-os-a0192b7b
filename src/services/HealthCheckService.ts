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

  /** Agendamento do workspace (null quando nunca configurado). */
  async getSchedule(workspaceId: UUID): Promise<HealthCheckSchedule | null> {
    const { data, error } = await this.client
      .from("health_check_schedules")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (error) {
      logFinanceError("health", "getSchedule", error);
      this.handleError(error, "getSchedule");
    }
    return (data as HealthCheckSchedule | null) ?? null;
  }

  async saveSchedule(
    workspaceId: UUID,
    input: { enabled: boolean; frequency: HealthCheckFrequency; hourUtc: number },
  ): Promise<HealthCheckSchedule> {
    const { data, error } = await this.client
      .from("health_check_schedules")
      .upsert(
        {
          workspace_id: workspaceId,
          enabled: input.enabled,
          frequency: input.frequency,
          hour_utc: input.hourUtc,
        },
        { onConflict: "workspace_id" },
      )
      .select("*")
      .single();
    if (error) {
      logFinanceError("health", "saveSchedule", error);
      this.handleError(error, "saveSchedule");
    }
    return data as HealthCheckSchedule;
  }

  /** Alertas gerados pelas execuções automáticas (mais recentes primeiro). */
  async listAlerts(workspaceId: UUID, limit = 10): Promise<HealthCheckAlert[]> {
    const { data, error } = await this.client
      .from("health_check_runs")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      logFinanceError("health", "listAlerts", error);
      this.handleError(error, "listAlerts");
    }
    return (data ?? []) as HealthCheckAlert[];
  }

  async acknowledgeAlert(alertId: UUID): Promise<void> {
    const { error } = await this.client
      .from("health_check_runs")
      .update({ acknowledged_at: new Date().toISOString() })
      .eq("id", alertId);
    if (error) {
      logFinanceError("health", "acknowledgeAlert", error);
      this.handleError(error, "acknowledgeAlert");
    }
  }

  /** Descreve os itens com problema de um relatório persistido. */
  static describeReport(report: Record<string, unknown>): HealthCheckItem[] {
    return Object.keys(LABELS)
      .map((key) => {
        const count = Number(report?.[key] ?? 0);
        return { key, label: LABELS[key], count, ok: count === 0 };
      })
      .filter((item) => !item.ok && !INFO_KEYS.has(item.key));
  }

  static isInfo(key: string): boolean {
    return INFO_KEYS.has(key);
  }
}

export const HealthCheckService = new HealthCheckServiceImpl();
export { HealthCheckServiceImpl };
