// ImportService — Orquestra a leitura de arquivos, geração de preview e a
// gravação das movimentações. Toda regra de conciliação vive aqui.
import { BaseService } from "./BaseService";
import { ImporterFactory } from "./importers/ImporterFactory";
import { ImportHistoryService } from "./ImportHistoryService";
import { ClassificationRuleService, ClassificationRuleServiceImpl } from "./ClassificationRuleService";
import { ReconciliationService } from "./ReconciliationService";
import { MovementService } from "./MovementService";
import { CardService, CardServiceImpl } from "./CardService";
import { CardInvoiceService } from "./CardInvoiceService";
import {
  SimilarityServiceImpl,
  AUTO_RESOLVE_THRESHOLD,
  REVIEW_THRESHOLD,
} from "./SimilarityService";

import { fileHash as computeFileHash } from "./importers/utils";
import type { ImportContext, PreviewResult, PreviewRow } from "./importers/types";
import type { Account, Movement, UUID } from "@/models";
import type { ImportRecord, ImportSource, ImportLogEntry } from "@/models/Import";
import { MovementStatus } from "@/constants/enums";
import { logFinanceError } from "@/lib/logger";
import { MovementImportExclusionService } from "./MovementImportExclusionService";

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
  /** Sprint 4.14 — possíveis transferências detectadas (nunca confirmadas sozinhas). */
  suggestedTransfers: number;
}

class ImportServiceImpl extends BaseService {
  static computeFileHash(text: string): string {
    return computeFileHash(text);
  }

  /**
   * Busca hashes de duplicidade existentes no workspace para bloquear reimportação.
   */
  async loadExistingHashes(workspaceId: UUID): Promise<Set<string>> {
    const set = new Set<string>();
    for (let offset = 0; ; offset += 500) {
      // Deleted rows also block reimport, including deletions predating tombstones.
      const { data, error } = await this.client.from("movements")
        .select("id, duplicate_hash").eq("workspace_id", workspaceId)
        .not("duplicate_hash", "is", null).order("id").range(offset, offset + 499);
      if (error) this.handleError(error, "loadExistingHashes");
      for (const row of data ?? []) {
        if (row.duplicate_hash) set.add(row.duplicate_hash);
      }
      if ((data ?? []).length < 500) break;
    }
    return set;
  }

  /** Base recente do workspace usada pela detecção inteligente de duplicidade. */
  async loadRecentMovements(workspaceId: UUID): Promise<Movement[]> {
    return MovementService.listAll(workspaceId);
  }

  async buildPreview(params: BuildPreviewParams): Promise<PreviewResult & { existingImport: ImportRecord | null }> {
    const importer = ImporterFactory.create(params.source);
    const fileHash = computeFileHash(params.fileText);
    const [existingHashes, excludedHashes, existingImport, rules, existingMovements] = await Promise.all([
      this.loadExistingHashes(params.workspaceId),
      MovementImportExclusionService.listHashes(params.workspaceId),
      ImportHistoryService.findByHash(params.workspaceId, fileHash),
      ClassificationRuleService.list(params.workspaceId),
      this.loadRecentMovements(params.workspaceId),
    ]);
    for (const hash of excludedHashes) existingHashes.add(hash);

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
      const match = ClassificationRuleServiceImpl.match(
        {
          description: row.description,
          type: row.type,
          amount: row.amount,
          account_id: row.account_id ?? params.accountId ?? null,
          card_id: row.card_id ?? params.cardId ?? null,
        },
        rules,
      );
      if (match) {
        row.category_id = match.category_id;
        row.subcategory_id = match.subcategory_id;
      }
    }

    // Sprint 4.1.1 — Smart Duplicate Detection.
    // A data isolada nunca decide: fingerprint + valor + cartão/conta + janela.
    let smartDuplicates = 0;
    for (const row of preview.rows) {
      if (row.isInvalid) continue;
      const best = SimilarityServiceImpl.bestMatch(
        {
          account_id: row.account_id ?? params.accountId ?? null,
          card_id: row.card_id ?? params.cardId ?? null,
          description: row.description,
          amount: row.amount,
          transaction_date: row.transaction_date,
          duplicate_hash: row.duplicate_hash,
          type: row.type,
        },
        existingMovements,
      );
      if (!best) continue;
      row.confidence_match = best.score.confidence_match;
      row.duplicateReason = best.score.label;
      row.matchedMovementId = best.movement.id;
      if (best.score.confidence_match >= AUTO_RESOLVE_THRESHOLD) {
        if (!row.isDuplicate) smartDuplicates++;
        row.isDuplicate = true;
        row.needsReview = false;
      } else if (best.score.confidence_match >= REVIEW_THRESHOLD) {
        // Nunca consolida automaticamente nessa faixa.
        row.needsReview = true;
      }
    }
    if (smartDuplicates > 0) {
      preview.totals.duplicated += smartDuplicates;
      preview.totals.valid = Math.max(0, preview.totals.valid - smartDuplicates);
    }

    return { ...preview, existingImport };
  }


  /**
   * Efetiva a importação: cria o registro em `imports`, insere as movimentações
   * válidas e atualiza o status/log. Nunca duplica movimentações.
   */
  async commit(params: CommitParams): Promise<CommitResult> {
    const t0 = Date.now();
    const { preview, workspaceId, accountId, cardId, importedBy, selectedIndexes } = params;

    // A preview may be stale: reload deletion/dedup guards before any write.
    const [existingHashes, excludedHashes] = await Promise.all([
      this.loadExistingHashes(workspaceId),
      MovementImportExclusionService.listHashes(workspaceId),
    ]);
    for (const hash of excludedHashes) existingHashes.add(hash);

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
    const selected = selectedSet ? eligible.filter((r) => selectedSet.has(r.index)) : eligible;
    const toInsert = selected.filter((row) => {
      if (existingHashes.has(row.duplicate_hash)) return false;
      existingHashes.add(row.duplicate_hash);
      return true;
    });

    const log: ImportLogEntry[] = [];
    let inserted = 0;
    let duplicated = selected.length - toInsert.length;
    let ignored = 0;
    const invoiceIds = new Set<UUID>();

    for (const row of preview.rows) {
      if (row.isInvalid) { ignored++; log.push({ level: "warn", message: `Linha ${row.index + 1} inválida: ${row.errors.join(", ")}`, at: new Date().toISOString(), row: row.index + 1 }); }
      else if (row.isDuplicate) { duplicated++; }
    }

    // Se for importação de cartão, garante fatura correspondente por linha.
    // Pagamentos de fatura e transferências NUNCA recebem invoice_id — caso
    // contrário abatem o total da fatura (causa raiz das faturas zeradas).
    const card = cardId ? await CardService.getById(cardId) : null;
    const rowInvoiceMap = new Map<number, UUID>();
    if (card) {
      for (const r of toInsert) {
        if (r.type === "CARD_PAYMENT" || r.type === "TRANSFER") continue;
        try {
          const invId = await CardInvoiceService.ensureInvoice(card, r.transaction_date);
          rowInvoiceMap.set(r.index, invId);
          invoiceIds.add(invId);
        } catch (e) {
          logFinanceError("imports", "ensureInvoice", e);
          log.push({
            level: "error",
            message: `Falha ao criar fatura para ${r.transaction_date}: ${String((e as Error).message ?? e)}`,
            at: new Date().toISOString(),
            row: r.index + 1,
          });
          throw e;
        }
      }
    }

    // Compra em cartão = linha vinculada a um cartão que não é pagamento nem transferência.
    const isCardPurchase = (r: PreviewRow) =>
      !!card && r.type !== "CARD_PAYMENT" && r.type !== "TRANSFER";

    if (toInsert.length) {
      const payload = toInsert.map((r: PreviewRow) => ({
        workspace_id: workspaceId,
        account_id: r.account_id,
        card_id: r.card_id ?? (card ? card.id : null),
        invoice_id: rowInvoiceMap.get(r.index) ?? null,
        transfer_account_id: r.transfer_account_id,
        category_id: r.category_id,
        subcategory_id: r.subcategory_id,
        type: r.type,
        status: r.status ?? (isCardPurchase(r) ? MovementStatus.PENDING : MovementStatus.CLEARED),
        description: r.description,
        amount: r.amount,
        transaction_date: r.transaction_date,
        // Sprint 4.0.1 — competência/vencimento nunca ficam vazios na importação.
        competence_date: r.transaction_date,
        due_date: isCardPurchase(r)
          ? CardServiceImpl.computeInvoicePeriod(card, r.transaction_date).due_date
          : r.transaction_date,
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
          const msg = String(error.message ?? error);
          if (error.code === "23505" || /duplicate key/i.test(msg)) {
            // One conflict rolls the entire batch back; retry each row so new
            // movements are not silently discarded alongside the duplicate.
            for (const item of chunk) {
              const result = await this.client.from("movements").insert(item as never).select("id");
              if (result.error?.code === "23505") { duplicated++; continue; }
              if (result.error) {
                await ImportHistoryService.finalize(record.id, {
                  status: "FAILED", total_rows: preview.totals.total,
                  imported_rows: inserted, ignored_rows: ignored, duplicated_rows: duplicated, log,
                });
                this.handleError(result.error, "commit.retry");
              }
              inserted += result.data?.length ?? 1;
            }
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

    // Recalcula os totais das faturas afetadas.
    for (const invId of invoiceIds) {
      try {
        await CardInvoiceService.recompute(invId);
      } catch (e) {
        logFinanceError("invoices", "recompute", e);
        log.push({
          level: "error",
          message: `Falha ao recalcular fatura ${invId}: ${String((e as Error).message ?? e)}`,
          at: new Date().toISOString(),
        });
      }
    }

    // Sprint 4.14 — a importação NUNCA confirma transferências automaticamente.
    // Apenas sinaliza possíveis transferências para conciliação manual,
    // respeitando as decisões MATCH/REJECT já persistidas.
    let suggestedTransfers = 0;
    try {
      const candidates = await ReconciliationService.listCandidatesForImport(workspaceId, record.id);
      suggestedTransfers = candidates.length;
      if (suggestedTransfers > 0) {
        log.push({ level: "info", message: `${suggestedTransfers} possível(is) transferência(s) entre contas aguardando confirmação manual.`, at: new Date().toISOString() });
      }
    } catch (e) {
      log.push({ level: "warn", message: `Falha ao detectar possíveis transferências: ${String((e as Error).message ?? e)}`, at: new Date().toISOString() });
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

    return { importRecord: finalized, inserted, duplicated, ignored, autoReconciled: 0, suggestedTransfers };
  }
}

export const ImportService = new ImportServiceImpl();
