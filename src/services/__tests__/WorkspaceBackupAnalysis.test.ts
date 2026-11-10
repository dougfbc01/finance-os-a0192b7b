import { describe, it, expect } from "vitest";
import { WorkspaceBackupAnalysisService } from "../WorkspaceBackupAnalysisService";
import type { WorkspaceBackup } from "../WorkspaceBackupService";

const WS = "11111111-1111-1111-1111-111111111111";
const backup = (tables: Record<string, unknown[]>, wsId = WS): WorkspaceBackup => ({
  format: "finance-os-backup", version: 1, exported_at: "2026-01-01T00:00:00Z",
  workspace: { id: wsId }, counts: {}, tables,
});

describe("WorkspaceBackupAnalysisService.profile", () => {
  it("aponta movimentação que referencia conta ausente", () => {
    const p = WorkspaceBackupAnalysisService.profile(backup({
      accounts: [{ id: "a1", workspace_id: WS }],
      movements: [{ id: "m1", workspace_id: WS, account_id: "a2", transaction_date: "2025-03-01" }],
    }), WS);
    expect(p.issues).toContain("movements: 1 registro(s) apontam para accounts ausente(s) (account_id)");
    expect(p.tables.find((t) => t.table === "movements")?.firstDate).toBe("2025-03-01");
  });

  it("aponta backup de outro workspace", () => {
    const p = WorkspaceBackupAnalysisService.profile(backup({ accounts: [] }, "other"), WS);
    expect(p.sameWorkspace).toBe(false);
  });

  it("sem problemas quando o arquivo é coerente", () => {
    const p = WorkspaceBackupAnalysisService.profile(backup({ accounts: [{ id: "a1", workspace_id: WS }] }), WS);
    expect(p.issues).toEqual([]);
  });
});

import { describe as d2, it as i2, expect as e2 } from "vitest";
import { WorkspaceBackupAnalysisService as S2 } from "../WorkspaceBackupAnalysisService";
d2("compare", () => {
  i2("compares current and backup counts, biggest difference first", () => {
    const rows = S2.compare({ exportedAt: null, sameWorkspace: true, issues: [], tables: [
      { table: "movements", rows: 10, softDeleted: 0, firstDate: null, lastDate: null },
      { table: "accounts", rows: 3, softDeleted: 0, firstDate: null, lastDate: null },
    ] }, { movements: 100, accounts: 3, assets: 5 });
    e2(rows[0]).toEqual({ table: "movements", current: 100, backup: 10, delta: -90 });
    e2(rows.find((r) => r.table === "assets")).toEqual({ table: "assets", current: 5, backup: 0, delta: -5 });
  });
});
