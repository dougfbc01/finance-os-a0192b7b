import { describe, it, expect, vi } from "vitest";
import { WORKSPACE_BACKUP_TABLES, WorkspaceBackupServiceImpl } from "../WorkspaceBackupService";
describe("WorkspaceBackup", () => {
  it("inclui lançamentos, ativos e cotações", () => {
    for (const t of ["movements", "assets", "market_price_history", "accounts"]) expect(WORKSPACE_BACKUP_TABLES).toContain(t);
  });
  it("gera nome de arquivo com data", () => {
    expect(WorkspaceBackupServiceImpl.fileName("Meu Espaço", new Date("2026-11-07T12:00:00Z"))).toBe("finance-os-backup-meu-espaco-2026-11-07.json");
  });
});

describe("WorkspaceBackup restore", () => {
  it("rejeita arquivo que não é backup", () => {
    expect(() => WorkspaceBackupServiceImpl.parse("{}")).toThrow("Arquivo de backup inválido");
    expect(() => WorkspaceBackupServiceImpl.parse("x")).toThrow("Arquivo de backup inválido");
  });
  it("chama a função de restauração com o workspace e o backup", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { movements: 2 }, error: null });
    const svc = new WorkspaceBackupServiceImpl();
    (svc as unknown as { client: unknown }).client = { rpc };
    const backup = WorkspaceBackupServiceImpl.parse(JSON.stringify({ format: "finance-os-backup", version: 1, tables: { movements: [] } }));
    expect(await svc.restore("ws1", backup)).toEqual({ movements: 2 });
    expect(rpc).toHaveBeenCalledWith("restore_workspace_data", { _workspace_id: "ws1", _backup: backup });
  });
});
