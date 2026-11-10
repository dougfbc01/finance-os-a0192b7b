// WorkspaceBackupAnalysisService — resumo determinístico de um arquivo de backup
// antes da restauração. Somente leitura; não altera dados nem calcula saldos.
import type { WorkspaceBackup } from "./WorkspaceBackupService";

export interface BackupTableProfile {
  table: string;
  rows: number;
  softDeleted: number;
  firstDate: string | null;
  lastDate: string | null;
}

export interface BackupProfile {
  exportedAt: string | null;
  sameWorkspace: boolean;
  tables: BackupTableProfile[];
  issues: string[];
}

export interface BackupAiReview {
  summary: string;
  inconsistencies: { severity: "alta" | "média" | "baixa"; description: string }[];
  recommendation: string;
}

const DATE_FIELDS = ["transaction_date", "date", "reference_date", "due_date", "created_at"];
/** Referências verificadas: coluna → tabela de destino. */
const REFERENCES: Record<string, string> = {
  account_id: "accounts",
  asset_id: "assets",
  card_id: "cards",
  invoice_id: "invoices",
  category_id: "categories",
};

type Row = Record<string, unknown>;

export class WorkspaceBackupAnalysisService {
  static profile(backup: WorkspaceBackup, workspaceId: string): BackupProfile {
    const issues: string[] = [];
    const tables: BackupTableProfile[] = [];
    const ids: Record<string, Set<string>> = {};

    for (const [table, raw] of Object.entries(backup.tables)) {
      const rows = (Array.isArray(raw) ? raw : []) as Row[];
      const seen = new Set<string>();
      let dup = 0, otherWs = 0, softDeleted = 0;
      let first: string | null = null, last: string | null = null;
      for (const r of rows) {
        const id = typeof r.id === "string" ? r.id : null;
        if (id) { if (seen.has(id)) dup++; seen.add(id); }
        if (r.workspace_id && r.workspace_id !== workspaceId) otherWs++;
        if (r.deleted_at) softDeleted++;
        const field = DATE_FIELDS.find((f) => typeof r[f] === "string");
        if (field) {
          const d = String(r[field]).slice(0, 10);
          if (!first || d < first) first = d;
          if (!last || d > last) last = d;
        }
      }
      ids[table] = seen;
      if (dup) issues.push(`${table}: ${dup} registro(s) com id repetido`);
      if (otherWs) issues.push(`${table}: ${otherWs} registro(s) de outro workspace`);
      tables.push({ table, rows: rows.length, softDeleted, firstDate: first, lastDate: last });
    }

    for (const [table, raw] of Object.entries(backup.tables)) {
      const rows = (Array.isArray(raw) ? raw : []) as Row[];
      for (const [col, target] of Object.entries(REFERENCES)) {
        if (!ids[target] || target === table) continue;
        const missing = rows.filter((r) => typeof r[col] === "string" && !ids[target].has(r[col] as string)).length;
        if (missing) issues.push(`${table}: ${missing} registro(s) apontam para ${target} ausente(s) (${col})`);
      }
    }

    const exportedAt = backup.exported_at ?? null;
    if (exportedAt && new Date(exportedAt).getTime() > Date.now()) issues.push("Data de exportação no futuro");
    const sameWorkspace = !backup.workspace || (backup.workspace as Row).id === workspaceId;
    if (!sameWorkspace) issues.push("Backup gerado em outro workspace");

    return { exportedAt, sameWorkspace, tables, issues };
  }
}
