import { describe, it, expect, vi } from "vitest";
import { BACKUP_SCHEMA_VERSION, WORKSPACE_BACKUP_TABLES, WorkspaceBackupServiceImpl } from "../WorkspaceBackupService";
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
    const backup = WorkspaceBackupServiceImpl.parse(JSON.stringify({ format: "finance-os-backup", version: 1, schema_version: BACKUP_SCHEMA_VERSION, tables: { movements: [] } }));
    expect(await svc.restore("ws1", backup)).toEqual({ movements: 2 });
    expect(rpc).toHaveBeenCalledWith("restore_workspace_data", { _workspace_id: "ws1", _backup: backup });
  });
  it("recusa backup de outra versão do banco com mensagem clara", () => {
    const old = JSON.stringify({ format: "finance-os-backup", version: 1, schema_version: "0003_restore_workspace_data", tables: {} });
    expect(() => WorkspaceBackupServiceImpl.parse(old)).toThrow(/Versão do backup incompatível.*0003_restore_workspace_data/);
    const none = JSON.stringify({ format: "finance-os-backup", version: 1, tables: {} });
    expect(() => WorkspaceBackupServiceImpl.parse(none)).toThrow(/sem versão/);
  });
  it("export grava a versão do banco no arquivo", async () => {
    const q = { select: () => q, eq: () => q, order: () => q, maybeSingle: async () => ({ data: { id: "ws1" }, error: null }), range: async () => ({ data: [], error: null }) };
    const svc = new WorkspaceBackupServiceImpl();
    (svc as unknown as { client: unknown }).client = { from: () => q };
    expect((await svc.export("ws1")).schema_version).toBe(BACKUP_SCHEMA_VERSION);
  });
});
