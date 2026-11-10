// Revisão do backup por IA: recebe apenas o resumo (nunca os registros) e
// confirma que o chamador é dono do workspace.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { BackupAiReview } from "@/services/WorkspaceBackupAnalysisService";

const profileSchema = z.object({
  exportedAt: z.string().nullable(),
  sameWorkspace: z.boolean(),
  tables: z.array(z.object({
    table: z.string().max(80), rows: z.number(), softDeleted: z.number(),
    firstDate: z.string().nullable(), lastDate: z.string().nullable(),
  })).max(100),
  issues: z.array(z.string().max(300)).max(200),
});

export const reviewBackupFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ workspaceId: z.string().uuid(), profile: profileSchema }))
  .handler(async ({ data, context }): Promise<{ review: BackupAiReview | null; error: string | null }> => {
    const { data: ws } = await context.supabase.from("workspaces").select("owner_id").eq("id", data.workspaceId).maybeSingle();
    if (!ws || ws.owner_id !== context.userId) throw new Error("Somente o dono do workspace pode analisar backups");

    const { generateResponse, GatewayError } = await import("@lovable.dev/ai-gateway");
    try {
      const res = await generateResponse({
        model: "openai/gpt-6-astra",
        instructions:
          "Você revisa backups de um app de finanças pessoais antes da restauração. Recebe só um resumo estatístico por tabela e problemas já detectados. " +
          "Responda em português do Brasil, linguagem simples, sem inventar números. Aponte inconsistências plausíveis (tabelas vazias que deveriam ter dados, datas estranhas, referências ausentes, backup de outro workspace, muitos excluídos). " +
          'Retorne SOMENTE JSON: {"summary": string, "inconsistencies": [{"severity": "alta"|"média"|"baixa", "description": string}], "recommendation": string}.',
        input: JSON.stringify(data.profile),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = ((res as any).output ?? []).flatMap((o: any) => o.content ?? []).filter((c: any) => c.type === "output_text").map((c: any) => c.text).join("");
      const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
      const parsed = JSON.parse(json) as BackupAiReview;
      return { review: { summary: parsed.summary ?? "", inconsistencies: parsed.inconsistencies ?? [], recommendation: parsed.recommendation ?? "" }, error: null };
    } catch (e) {
      console.error("reviewBackupFn", e);
      if (e instanceof GatewayError && e.httpStatus === 402) return { review: null, error: "Créditos de IA esgotados." };
      if (e instanceof GatewayError && e.httpStatus === 429) return { review: null, error: "Muitas análises seguidas. Tente em instantes." };
      return { review: null, error: "Não foi possível analisar o backup agora." };
    }
  });
