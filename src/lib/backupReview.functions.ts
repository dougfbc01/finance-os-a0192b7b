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
  comparison: z.array(z.object({
    table: z.string().max(80), current: z.number(), backup: z.number(), delta: z.number(),
  })).max(100).optional(),
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
          "O campo comparison traz, por tabela, quantos registros existem hoje no workspace (current) e no backup (backup). A restauração APAGA todos os dados atuais e os troca pelos do backup. Explique o que seria substituído e destaque diferenças notáveis (perdas grandes, tabelas que ficariam vazias, ganhos). " +
          'Retorne SOMENTE JSON: {"summary": string, "inconsistencies": [{"severity": "alta"|"média"|"baixa", "description": string}], "recommendation": string, "replacement": string, "differences": [string]}.',
        input: JSON.stringify(data.profile),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = ((res as any).output ?? []).flatMap((o: any) => o.content ?? []).filter((c: any) => c.type === "output_text").map((c: any) => c.text).join("");
      const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
      const parsed = JSON.parse(json) as BackupAiReview;
      return { review: { summary: parsed.summary ?? "", inconsistencies: parsed.inconsistencies ?? [], recommendation: parsed.recommendation ?? "", replacement: parsed.replacement ?? "", differences: Array.isArray(parsed.differences) ? parsed.differences : [] }, error: null };
    } catch (e) {
      console.error("reviewBackupFn", e);
      if (e instanceof GatewayError && e.httpStatus === 402) return { review: null, error: "Créditos de IA esgotados." };
      if (e instanceof GatewayError && e.httpStatus === 429) return { review: null, error: "Muitas análises seguidas. Tente em instantes." };
      return { review: null, error: "Não foi possível analisar o backup agora." };
    }
  });

// Perguntas livres sobre o backup: responde só a partir do resumo/comparação.
export const askBackupQuestionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    workspaceId: z.string().uuid(),
    profile: profileSchema,
    question: z.string().trim().min(3).max(500),
    history: z.array(z.object({ q: z.string().max(500), a: z.string().max(4000) })).max(6).optional(),
  }))
  .handler(async ({ data, context }): Promise<{ answer: string | null; error: string | null }> => {
    const { data: ws } = await context.supabase.from("workspaces").select("owner_id").eq("id", data.workspaceId).maybeSingle();
    if (!ws || ws.owner_id !== context.userId) throw new Error("Somente o dono do workspace pode consultar backups");
    const { generateResponse, GatewayError } = await import("@lovable.dev/ai-gateway");
    try {
      const res = await generateResponse({
        model: "openai/gpt-6-astra",
        instructions:
          "Você responde perguntas sobre um backup de um app de finanças pessoais antes da restauração. Use SOMENTE os dados do JSON 'profile' (contagens por tabela, datas, problemas detectados e comparison: current = hoje, backup = arquivo). " +
          "A restauração apaga todos os dados atuais e os troca pelos do backup. Você não tem valores, nomes nem lançamentos individuais: se a pergunta exigir isso, diga claramente que essa informação não está disponível na comparação. " +
          "Nunca invente números. Responda em português do Brasil, linguagem simples, curto (até 6 frases ou uma lista breve), texto puro sem markdown.",
        input: JSON.stringify({ profile: data.profile, previous: data.history ?? [], question: data.question }),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = ((res as any).output ?? []).flatMap((o: any) => o.content ?? []).filter((c: any) => c.type === "output_text").map((c: any) => c.text).join("").trim();
      return text ? { answer: text, error: null } : { answer: null, error: "A IA não retornou resposta." };
    } catch (e) {
      console.error("askBackupQuestionFn", e);
      if (e instanceof GatewayError && e.httpStatus === 402) return { answer: null, error: "Créditos de IA esgotados." };
      if (e instanceof GatewayError && e.httpStatus === 429) return { answer: null, error: "Muitas perguntas seguidas. Tente em instantes." };
      return { answer: null, error: "Não foi possível responder agora." };
    }
  });
