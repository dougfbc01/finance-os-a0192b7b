import { describe, it, expect } from "vitest";
import { WORKSPACE_BACKUP_TABLES, WorkspaceBackupServiceImpl } from "../WorkspaceBackupService";
describe("WorkspaceBackup", () => {
  it("inclui lançamentos, ativos e cotações", () => {
    for (const t of ["movements", "assets", "market_price_history", "accounts"]) expect(WORKSPACE_BACKUP_TABLES).toContain(t);
  });
  it("gera nome de arquivo com data", () => {
    expect(WorkspaceBackupServiceImpl.fileName("Meu Espaço", new Date("2026-11-07T12:00:00Z"))).toBe("finance-os-backup-meu-espaco-2026-11-07.json");
  });
});
