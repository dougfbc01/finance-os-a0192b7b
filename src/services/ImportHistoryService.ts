// ImportHistoryService — CRUD e consultas sobre a tabela `imports`.
import { BaseService } from "./BaseService";
import type { CreateImportInput, ImportLogEntry, ImportRecord, ImportStatus } from "@/models/Import";
import type { UUID } from "@/models";

class ImportHistoryServiceImpl extends BaseService {
  private readonly table = "imports" as const;

  async list(workspaceId: UUID): Promise<ImportRecord[]> {
    const { data, error } = await this.client
      .from(this.table)
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("imported_at", { ascending: false });
    if (error) this.handleError(error, "list");
    return (data ?? []) as unknown as ImportRecord[];
  }

  async findByHash(workspaceId: UUID, fileHash: string): Promise<ImportRecord | null> {
    const { data, error } = await this.client
      .from(this.table)
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("file_hash", fileHash)
      .order("imported_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) this.handleError(error, "findByHash");
    return (data as unknown as ImportRecord) ?? null;
  }

  async create(input: CreateImportInput): Promise<ImportRecord> {
    const { data, error } = await this.client
      .from(this.table)
      .insert({
        workspace_id: input.workspace_id,
        account_id: input.account_id,
        source: input.source,
        file_name: input.file_name,
        file_hash: input.file_hash,
        imported_by: input.imported_by ?? null,
        status: "PROCESSING",
      } as never)
      .select("*")
      .single();
    if (error) this.handleError(error, "create");
    return data as unknown as ImportRecord;
  }

  async finalize(
    id: UUID,
    patch: {
      status: ImportStatus;
      total_rows: number;
      imported_rows: number;
      ignored_rows: number;
      duplicated_rows: number;
      log: ImportLogEntry[];
    },
  ): Promise<ImportRecord> {
    const { data, error } = await this.client
      .from(this.table)
      .update(patch as never)
      .eq("id", id)
      .select("*")
      .single();
    if (error) this.handleError(error, "finalize");
    return data as unknown as ImportRecord;
  }

  async delete(id: UUID): Promise<void> {
    const { error } = await this.client.from(this.table).delete().eq("id", id);
    if (error) this.handleError(error, "delete");
  }
}

export const ImportHistoryService = new ImportHistoryServiceImpl();
