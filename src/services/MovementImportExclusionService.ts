import { BaseService } from "./BaseService";
import type { UUID } from "@/models";

/**
 * Mantém um tombstone para hashes de importação que o usuário excluiu.
 * A exclusão lógica de uma movimentação não deve reabrir a porta para que o
 * mesmo lançamento volte em uma importação futura.
 */
class MovementImportExclusionServiceImpl extends BaseService {
  async listHashes(workspaceId: UUID): Promise<Set<string>> {
    const { data, error } = await this.client
      .from("movement_import_exclusions")
      .select("duplicate_hash")
      .eq("workspace_id", workspaceId);
    if (error) this.handleError(error, "listHashes");
    return new Set(
      (data ?? [])
        .map((row) => (row as { duplicate_hash: string | null }).duplicate_hash)
        .filter((hash): hash is string => !!hash),
    );
  }

  async record(params: {
    workspaceId: UUID;
    duplicateHash: string;
    movementId?: UUID | null;
    reason?: string | null;
  }): Promise<void> {
    if (!params.duplicateHash) return;
    const { error } = await this.client.from("movement_import_exclusions").upsert(
      {
        workspace_id: params.workspaceId,
        duplicate_hash: params.duplicateHash,
        movement_id: params.movementId ?? null,
        reason: params.reason ?? "MOVEMENT_SOFT_DELETE",
      } as never,
      { onConflict: "workspace_id,duplicate_hash" },
    );
    if (error) this.handleError(error, "record");
  }

  async recordMany(
    rows: Array<{
      workspace_id: UUID;
      duplicate_hash: string;
      movement_id?: UUID | null;
      reason?: string | null;
    }>,
  ): Promise<void> {
    const unique = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      if (row.duplicate_hash) unique.set(`${row.workspace_id}|${row.duplicate_hash}`, row);
    }
    const payload = Array.from(unique.values());
    if (!payload.length) return;
    const { error } = await this.client
      .from("movement_import_exclusions")
      .upsert(payload as never, { onConflict: "workspace_id,duplicate_hash" });
    if (error) this.handleError(error, "recordMany");
  }
}

export const MovementImportExclusionService = new MovementImportExclusionServiceImpl();
export { MovementImportExclusionServiceImpl };
