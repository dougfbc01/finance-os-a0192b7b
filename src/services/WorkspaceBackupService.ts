// WorkspaceBackupService — exporta todos os dados do próprio workspace em JSON.
// Somente leitura, via client autenticado (RLS garante o escopo do dono).
import { BaseService } from "./BaseService";
import { fetchAllPages } from "@/lib/fetchAllPages";
import { WORKSPACE_RESET_TABLE_LABELS } from "./WorkspaceResetService";
import type { UUID } from "@/models";

/** Tabelas com workspace_id incluídas no backup. */
export const WORKSPACE_BACKUP_TABLES: string[] = [
  ...Object.keys(WORKSPACE_RESET_TABLE_LABELS),
  "health_check_runs",
  "health_check_schedules",
];

export interface WorkspaceBackup {
  format: "finance-os-backup";
  version: 1;
  exported_at: string;
  workspace: Record<string, unknown> | null;
  counts: Record<string, number>;
  tables: Record<string, unknown[]>;
}

export class WorkspaceBackupServiceImpl extends BaseService {
  protected readonly serviceName = "WorkspaceBackupService";

  async export(workspaceId: UUID, now: Date = new Date()): Promise<WorkspaceBackup> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = this.client as any;
    const { data: workspace, error } = await db.from("workspaces").select("*").eq("id", workspaceId).maybeSingle();
    if (error) this.handleError(error, "workspace");

    const tables: Record<string, unknown[]> = {};
    const counts: Record<string, number> = {};
    for (const table of WORKSPACE_BACKUP_TABLES) {
      const rows = await fetchAllPages<unknown>(
        (from, to) => db.from(table).select("*").eq("workspace_id", workspaceId).order("id").range(from, to),
        (e) => this.handleError(e, table),
      );
      tables[table] = rows;
      counts[table] = rows.length;
    }
    return { format: "finance-os-backup", version: 1, exported_at: now.toISOString(), workspace: workspace ?? null, counts, tables };
  }

  /** Lê e valida o arquivo de backup antes de enviar ao banco. */
  static parse(text: string): WorkspaceBackup {
    let data: unknown;
    try { data = JSON.parse(text); } catch { throw new Error("Arquivo de backup inválido"); }
    const b = data as Partial<WorkspaceBackup>;
    if (!b || b.format !== "finance-os-backup" || typeof b.tables !== "object" || b.tables === null) {
      throw new Error("Arquivo de backup inválido");
    }
    return b as WorkspaceBackup;
  }

  /** Substitui todos os dados do workspace pelo backup, numa única transação. */
  async restore(workspaceId: UUID, backup: WorkspaceBackup): Promise<Record<string, number>> {
    const { data, error } = await this.client.rpc("restore_workspace_data", {
      _workspace_id: workspaceId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      _backup: backup as any,
    });
    if (error) this.handleError(error, "restore");
    return (data ?? {}) as Record<string, number>;
  }

  static fileName(workspaceName: string | null | undefined, now: Date = new Date()): string {
    const slug = (workspaceName ?? "workspace").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "workspace";
    return `finance-os-backup-${slug}-${now.toISOString().slice(0, 10)}.json`;
  }
}

export const WorkspaceBackupService = new WorkspaceBackupServiceImpl();
