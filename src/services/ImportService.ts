// ImportService — Orquestra a leitura de arquivos, geração de preview e a
// gravação das movimentações. Toda regra de conciliação vive aqui.
import { BaseService } from "./BaseService";
import { ImporterFactory } from "./importers/ImporterFactory";
import { ImportHistoryService } from "./ImportHistoryService";
import { ClassificationRuleService, ClassificationRuleServiceImpl } from "./ClassificationRuleService";
import { ReconciliationService, ReconciliationServiceImpl } from "./ReconciliationService";
import { CardService } from "./CardService";
import { CardInvoiceService } from "./CardInvoiceService";
import { fileHash as computeFileHash } from "./importers/utils";
import type { ImportContext, PreviewResult, PreviewRow } from "./importers/types";
import type { Account, Movement, UUID } from "@/models";
import type { ImportRecord, ImportSource, ImportLogEntry } from "@/models/Import";
import { MovementStatus } from "@/constants/enums";

export interface BuildPreviewParams {
  source: ImportSource;
  fileName: string;
  fileText: string;
  workspaceId: UUID;
  accountId: UUID | null;
  cardId?: UUID | null;
  accounts: Account[];
  defaults: ImportContext["defaults"];
}

export interface CommitParams {
  preview: PreviewResult;
  workspaceId: UUID;
  accountId: UUID | null;
  cardId?: UUID | null;
  importedBy: UUID | null;
  /** Índices das linhas a importar (por padrão, todas as válidas e não duplicadas). */
  selectedIndexes?: number[];
}

export interface CommitResult {
  importRecord: ImportRecord;
  inserted: number;
  duplicated: number;
  ignored: number;
  autoReconciled: number;
}

class ImportServiceImpl extends BaseService {
  static computeFileHash(text: string): string {
    return computeFileHash(text);
  }

  /**
   * Busca hashes de duplicidade existentes no workspace para bloquear reimportação.
   */
  async loadExistingHashes(workspaceId: UUID): Promise<Set<string>> {
    const { data, error } = await this.client
      .from("movements")
      .select("duplicate_hash")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .not("duplicate_hash", "is", null);
    if (error) this.handleError(error, "loadExistingHashes");
    const set = new Set<string>();
    for (const r of data ?? []) {
      const h = (r as { duplicate_hash: string | null }).duplicate_hash;
      if (h) set.add(h);
    }
    return set;
  }

  async buildPreview(params: BuildPreviewParams): Promise<PreviewResult & { existingImport: ImportRecord | null }> {
    const importer = ImporterFactory.create(params.source);
    const fileHash = computeFileHash(params.fileText);
    const [existingHashes, existingImport, rules] = await Promise.all([
      this.loadExistingHashes(params.workspaceId),
      ImportHistoryService.findByHash(params.workspaceId, fileHash),
      ClassificationRuleService.list(params.workspaceId),
    ]);

    const preview = await importer.preview(
      params.fileText,
      {
        workspaceId: params.workspaceId,
        accountId: params.accountId,
        cardId: params.cardId ?? null,
        accounts: params.accounts,
        defaults: params.defaults,
        existingHashes,
      },
      params.fileName,
      fileHash,
    );

    // Aplica regras de classificação: só sobrescreve quando a linha ainda não
    // possui categoria manual do próprio importador.
    for (const row of preview.rows) {
      if (row.category_id) continue;
      const match = ClassificationRuleServiceImpl.match(row.description, rules);
      if (match) {
        row.category_id = match.category_id;
        row.subcategory_id = match.subcategory_id;
      }
    }

    return { ...preview, existingImport };
  }

  /**
   * Efetiva a importação: cria o registro em `imports`, insere as movimentações
   * válidas e atualiza o status/log. Nunca duplica movimentações.
   */
  async commit(params: CommitParams): Promise<CommitResult> {
    const t0 = Date.now();
    const { preview, workspaceId, accountId, importedBy, selectedIndexes } = params;

    const record = await ImportHistoryService.create({
      workspace_id: workspaceId,
      account_id: accountId,
      source: preview.source,
      file_name: preview.fileName,
      file_hash: preview.fileHash,
      imported_by: importedBy,
    });

    const eligible = preview.rows.filter((r) => !r.isInvalid && !r.isDuplicate);
    const selectedSet = selectedIndexes ? new Set(selectedIndexes) : null;
    const toInsert = selectedSet ? eligible.filter((r) => selectedSet.has(r.index)) : eligible;

    const log: ImportLogEntry[] = [];
    let inserted = 0;
    let duplicated = 0;
    let ignored = 0;

    for (const row of preview.rows) {
      if (row.isInvalid) { ignored++; log.push({ level: "warn", message: `Linha ${row.index + 1} inválida: ${row.errors.join(", ")}`, at: new Date().toISOString(), row: row.index + 1 }); }
      else if (row.isDuplicate) { duplicated++; }
    }

    if (toInsert.length) {
      const payload = toInsert.map((r: PreviewRow) => ({
        workspace_id: workspaceId,
        account_id: r.account_id,
        transfer_account_id: r.transfer_account_id,
        category_id: r.category_id,
        subcategory_id: r.subcategory_id,
        type: r.type,
        status: r.status ?? MovementStatus.CLEARED,
        description: r.description,
        amount: r.amount,
        transaction_date: r.transaction_date,
        tags: [],
        attachments: [],
        duplicate_hash: r.duplicate_hash,
        import_id: record.id,
      }));

      // Insere em lotes para evitar payloads grandes.
      const chunkSize = 200;
      for (let i = 0; i < payload.length; i += chunkSize) {
        const chunk = payload.slice(i, i + chunkSize);
        const { data, error } = await this.client
          .from("movements")
          .insert(chunk as never)
          .select("id");
        if (error) {
          // Conflito de hash único => marcar como duplicado; demais erros interrompem.
          const msg = String(error.message ?? error);
          if (/duplicate key/i.test(msg) || /movements_workspace_duphash_unique/i.test(msg)) {
            duplicated += chunk.length;
            log.push({ level: "warn", message: `Lote com duplicidade detectada no banco: ${msg}`, at: new Date().toISOString() });
            continue;
          }
          log.push({ level: "error", message: msg, at: new Date().toISOString() });
          await ImportHistoryService.finalize(record.id, {
            status: "FAILED",
            total_rows: preview.totals.total,
            imported_rows: inserted,
            ignored_rows: ignored,
            duplicated_rows: duplicated,
            log,
          });
          this.handleError(error, "commit.insert");
        }
        inserted += data?.length ?? chunk.length;
      }
    }

    const status = inserted === 0 && (duplicated > 0 || ignored > 0)
      ? "PARTIAL"
      : ignored > 0 || duplicated > 0
        ? "PARTIAL"
        : "COMPLETED";

    log.push({
      level: "info",
      message: `Importação concluída em ${(Date.now() - t0)}ms — inseridas: ${inserted}, duplicadas: ${duplicated}, ignoradas: ${ignored}.`,
      at: new Date().toISOString(),
    });

    const finalized = await ImportHistoryService.finalize(record.id, {
      status,
      total_rows: preview.totals.total,
      imported_rows: inserted,
      ignored_rows: ignored,
      duplicated_rows: duplicated,
      log,
    });

    return { importRecord: finalized, inserted, duplicated, ignored };
  }
}

export const ImportService = new ImportServiceImpl();
