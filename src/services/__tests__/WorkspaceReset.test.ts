import { describe, it, expect, vi } from "vitest";
import { WorkspaceResetServiceImpl } from "@/services/WorkspaceResetService";

function svc() {
  const rpc = vi.fn().mockResolvedValue({ data: { movements: 3 }, error: null });
  return { rpc, service: new WorkspaceResetServiceImpl({ rpc } as never) };
}

describe("WorkspaceResetService", () => {
  it("habilita apenas com o nome exato do workspace", () => {
    expect(WorkspaceResetServiceImpl.canConfirm("Meu Workspace", "Meu Workspace")).toBe(true);
    expect(WorkspaceResetServiceImpl.canConfirm("meu workspace", "Meu Workspace")).toBe(false);
    expect(WorkspaceResetServiceImpl.canConfirm("Meu Workspace ", "Meu Workspace")).toBe(false);
    expect(WorkspaceResetServiceImpl.canConfirm("", "")).toBe(false);
  });

  it("execute chama a função com o modo e sem dry run", async () => {
    const { rpc, service } = svc();
    await service.execute("ws1", "ALL");
    expect(rpc).toHaveBeenCalledWith("reset_workspace_data", { _workspace_id: "ws1", _mode: "ALL", _dry_run: false, _reseed: false });
  });

  it("preview chama a função em dry run com o modo escolhido", async () => {
    const { rpc, service } = svc();
    const counts = await service.preview("ws1", "MOVEMENTS_AND_INVESTMENTS");
    expect(rpc).toHaveBeenCalledWith("reset_workspace_data", {
      _workspace_id: "ws1", _mode: "MOVEMENTS_AND_INVESTMENTS", _dry_run: true, _reseed: false,
    });
    expect(counts).toEqual({ movements: 3 });
  });
  it("Zerar tudo pode recriar categorias padrão (reseed)", async () => {
    const { rpc, service } = svc();
    await service.execute("ws1", "ALL", true);
    expect(rpc).toHaveBeenCalledWith("reset_workspace_data", { _workspace_id: "ws1", _mode: "ALL", _dry_run: false, _reseed: true });
  });
});
