import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { B3ImportService } from "@/services/B3ImportService";
import { B3ImportCommitService } from "@/services/B3ImportCommitService";
import type { B3AssetReference, B3CommitItemResult, B3CommitResult } from "@/models/B3Import";
import type { Json } from "@/integrations/supabase/types";

const inputSchema = z.object({
  workspaceId: z.string().uuid(),
  fileName: z.string().min(1).max(255).refine((name) => name.toLowerCase().endsWith(".xlsx"), "Selecione um arquivo .xlsx."),
  fileBase64: z.string().min(1).max(20_000_000),
});

const commitSchema = inputSchema.extend({
  selectedIndexes: z.array(z.number().int().nonnegative()).min(1),
});

const validateWorkspace = async (supabase: Parameters<typeof validateWorkspace>[0], workspaceId: string) => {
  const { data, error } = await supabase
    .from("workspaces")
    .select("id")
    .eq("id", workspaceId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error("Não foi possível validar o workspace atual.");
  if (!data) throw new Error("Workspace não encontrado ou sem acesso.");
};

const loadAssets = async (supabase: Parameters<typeof validateWorkspace>[0], workspaceId: string) => {
  const { data, error } = await supabase
    .from("assets")
    .select("id,ticker,name")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .is("deleted_at", null);
  if (error) throw new Error("Não foi possível consultar os ativos do workspace.");
  return (data ?? []) as B3AssetReference[];
};

const parsePreview = async (fileName: string, fileBase64: string, assets: B3AssetReference[]) => {
  const estimatedBytes = Math.floor((fileBase64.length * 3) / 4);
  if (estimatedBytes > 12 * 1024 * 1024) throw new Error("O arquivo deve ter no máximo 12 MB.");
  const { parseB3Workbook } = await import("./b3Import.server");
  const rows = parseB3Workbook(Uint8Array.from(Buffer.from(fileBase64, "base64")));
  return B3ImportService.buildPreview(fileName, rows, assets);
};

export const buildB3PreviewFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    await validateWorkspace(context.supabase, data.workspaceId);
    return parsePreview(data.fileName, data.fileBase64, await loadAssets(context.supabase, data.workspaceId));
  });

export const commitB3ImportFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => commitSchema.parse(input))
  .handler(async ({ data, context }): Promise<B3CommitResult> => {
    await validateWorkspace(context.supabase, data.workspaceId);
    const assets = await loadAssets(context.supabase, data.workspaceId);
    const preview = await parsePreview(data.fileName, data.fileBase64, assets);
    const selected = new Set(data.selectedIndexes);
    const chosenRows = preview.rows.filter((row) => selected.has(row.index));
    if (!chosenRows.length) throw new Error("Selecione pelo menos uma linha para importar.");

    const bytes = new TextEncoder().encode(data.fileBase64);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const fileHash = Array.from(new Uint8Array(digest)).map((part) => part.toString(16).padStart(2, "0")).join("");
    const now = new Date();
    const batchRef = `B3_IMPORT_${now.toISOString().slice(0, 10).replace(/-/g, "_")}_${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
    const { data: importRecord, error: importError } = await context.supabase.from("imports").insert({
      workspace_id: data.workspaceId,
      account_id: null,
      source: "B3",
      file_name: data.fileName,
      file_hash: fileHash,
      imported_by: context.userId,
      batch_ref: batchRef,
      status: "PROCESSING",
    }).select("id").single();
    if (importError || !importRecord) throw new Error("Não foi possível iniciar o lote B3.");

    const results: B3CommitItemResult[] = [];
    let imported = 0;
    let alreadyImported = 0;
    let notImported = 0;

    for (const row of chosenRows) {
      const eligibility = B3ImportCommitService.eligibility(row);
      if (eligibility.status !== "IMPORTED") {
        notImported += 1;
        results.push({ index: row.index, fingerprint: row.fingerprint, status: eligibility.status, movementId: null, message: eligibility.message });
        continue;
      }

      const { data: existing } = await context.supabase
        .from("b3_import_items")
        .select("status,movement_id")
        .eq("workspace_id", data.workspaceId)
        .eq("fingerprint", row.fingerprint)
        .maybeSingle();
      if (existing?.movement_id) {
        alreadyImported += 1;
        results.push({ index: row.index, fingerprint: row.fingerprint, status: "ALREADY_IMPORTED", movementId: existing.movement_id, message: "Evento já importado anteriormente." });
        continue;
      }

      const itemPayload = {
        import_id: importRecord.id,
        workspace_id: data.workspaceId,
        row_index: row.index,
        raw_row: row.raw as unknown as Json,
        fingerprint: row.fingerprint,
        original_type: row.movementType,
        event: row.event,
        event_group: row.group,
        ticker: row.product.ticker,
        institution: row.product.institution,
        asset_id: row.product.assetId,
        status: "PENDING_REVIEW",
        error: null,
      };
      let itemId: string | null = null;
      if (existing) {
        const { data: retried, error } = await context.supabase.from("b3_import_items").update(itemPayload).eq("workspace_id", data.workspaceId).eq("fingerprint", row.fingerprint).select("id").single();
        if (error) {
          notImported += 1;
          results.push({ index: row.index, fingerprint: row.fingerprint, status: "ERROR", movementId: null, message: "Não foi possível reservar novamente esta linha." });
          continue;
        }
        itemId = retried.id;
      } else {
        const { data: insertedItem, error } = await context.supabase.from("b3_import_items").insert(itemPayload).select("id").single();
        if (error || !insertedItem) {
          alreadyImported += 1;
          results.push({ index: row.index, fingerprint: row.fingerprint, status: "ALREADY_IMPORTED", movementId: null, message: "Evento já reservado por outra importação." });
          continue;
        }
        itemId = insertedItem.id;
      }

      const movement = B3ImportCommitService.movement(row, data.workspaceId, importRecord.id);
      if (!movement || !itemId) continue;
      const { data: createdMovement, error: movementError } = await context.supabase.from("movements").insert(movement).select("id").single();
      if (movementError || !createdMovement) {
        notImported += 1;
        await context.supabase.from("b3_import_items").update({ status: "ERROR", error: "Falha ao gravar evento histórico." }).eq("id", itemId);
        results.push({ index: row.index, fingerprint: row.fingerprint, status: "ERROR", movementId: null, message: "Falha ao gravar evento histórico." });
        continue;
      }
      await context.supabase.from("b3_import_items").update({ status: "IMPORTED", movement_id: createdMovement.id, error: null }).eq("id", itemId);
      imported += 1;
      results.push({ index: row.index, fingerprint: row.fingerprint, status: "IMPORTED", movementId: createdMovement.id, message: "Evento histórico importado." });
    }

    const status = notImported > 0 || alreadyImported > 0 ? "PARTIAL" : "COMPLETED";
    await context.supabase.from("imports").update({
      status,
      total_rows: preview.totals.total,
      imported_rows: imported,
      ignored_rows: notImported,
      duplicated_rows: alreadyImported,
      log: [{ level: "info", message: `${batchRef}: ${imported} importadas, ${alreadyImported} existentes, ${notImported} não importadas.`, at: new Date().toISOString() }],
    }).eq("id", importRecord.id);

    return {
      importId: importRecord.id,
      batchRef,
      imported,
      alreadyImported,
      notImported,
      assetsFound: preview.totals.assetsFound,
      assetsNotFound: preview.totals.assetsNotFound,
      eventCounts: preview.eventCounts,
      cashMovementsCreated: 0,
      incomesCreated: 0,
      expensesCreated: 0,
      transfersCreated: 0,
      items: results,
    };
  });