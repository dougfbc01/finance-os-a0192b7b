import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { B3ImportService } from "@/services/B3ImportService";
import type { B3AssetReference } from "@/models/B3Import";

const inputSchema = z.object({
  workspaceId: z.string().uuid(),
  fileName: z.string().min(1).max(255).refine((name) => name.toLowerCase().endsWith(".xlsx"), "Selecione um arquivo .xlsx."),
  fileBase64: z.string().min(1).max(20_000_000),
});

export const buildB3PreviewFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const estimatedBytes = Math.floor((data.fileBase64.length * 3) / 4);
    if (estimatedBytes > 12 * 1024 * 1024) throw new Error("O arquivo deve ter no máximo 12 MB.");

    const { data: workspace, error: workspaceError } = await context.supabase
      .from("workspaces")
      .select("id")
      .eq("id", data.workspaceId)
      .is("deleted_at", null)
      .maybeSingle();
    if (workspaceError) throw new Error("Não foi possível validar o workspace atual.");
    if (!workspace) throw new Error("Workspace não encontrado ou sem acesso.");

    const { data: assets, error: assetsError } = await context.supabase
      .from("assets")
      .select("id,ticker,name")
      .eq("workspace_id", data.workspaceId)
      .eq("is_active", true)
      .is("deleted_at", null);
    if (assetsError) throw new Error("Não foi possível consultar os ativos do workspace.");

    const { parseB3Workbook } = await import("./b3Import.server");
    const rows = parseB3Workbook(Uint8Array.from(Buffer.from(data.fileBase64, "base64")));
    return B3ImportService.buildPreview(data.fileName, rows, (assets ?? []) as B3AssetReference[]);
  });