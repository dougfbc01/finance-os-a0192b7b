// WorkspaceResetService — apaga fisicamente os dados do próprio workspace via
// função SQL autenticada (reset_workspace_data). A verificação de dono, a ordem
// de FK, a transação e a auditoria ficam no banco.
import { BaseService } from "./BaseService";
import type { UUID } from "@/models";

export type WorkspaceResetMode = "MOVEMENTS_AND_INVESTMENTS" | "ALL";
export type WorkspaceResetCounts = Record<string, number>;

export const WORKSPACE_RESET_TABLE_LABELS: Record<string, string> = {
  reconciliation_decisions: "Decisões de conciliação",
  invoice_reconciliation_actions: "Ações de conciliação de fatura",
  dedup_audits: "Auditorias de duplicidade",
  movement_import_exclusions: "Hashes de importação excluídos",
  b3_import_items: "Itens de importação B3",
  commitment_installments: "Parcelas de compromissos",
  commitments: "Compromissos",
  monthly_closing_events: "Eventos de fechamento",
  monthly_closings: "Fechamentos mensais",
  market_price_history: "Cotações",
  movements: "Movimentações",
  card_invoices: "Faturas",
  imports: "Importações",
  assets: "Ativos",
  financial_goal_accounts: "Contas vinculadas a metas",
  financial_goal_contributions: "Aportes em metas",
  financial_goals: "Metas",
  monthly_budget_items: "Itens de planejamento",
  monthly_budgets: "Planejamentos",
  classification_rules: "Regras de classificação",
  subcategories: "Subcategorias",
  categories: "Categorias",
  cards: "Cartões",
  accounts: "Contas",
};

export class WorkspaceResetServiceImpl extends BaseService {
  protected readonly serviceName = "WorkspaceResetService";

  async preview(workspaceId: UUID, mode: WorkspaceResetMode): Promise<WorkspaceResetCounts> {
    return this.call(workspaceId, mode, true, "preview");
  }

  /** reseed: no modo ALL, recria as categorias padrão ao final. */
  async execute(workspaceId: UUID, mode: WorkspaceResetMode, reseed = false): Promise<WorkspaceResetCounts> {
    return this.call(workspaceId, mode, false, "execute", reseed);
  }

  /** O botão destrutivo só habilita com o nome exato do workspace. */
  static canConfirm(typed: string, workspaceName: string | null | undefined): boolean {
    return !!workspaceName && typed === workspaceName;
  }

  private async call(workspaceId: UUID, mode: WorkspaceResetMode, dryRun: boolean, ctx: string, reseed = false) {
    const { data, error } = await this.client.rpc("reset_workspace_data", {
      _workspace_id: workspaceId,
      _mode: mode,
      _dry_run: dryRun,
      _reseed: reseed,
    });
    if (error) this.handleError(error, ctx);
    return (data ?? {}) as WorkspaceResetCounts;
  }
}

export const WorkspaceResetService = new WorkspaceResetServiceImpl();
