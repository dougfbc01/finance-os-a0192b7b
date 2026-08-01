// Endpoint agendado (pg_cron) do Health Check de Integridade Financeira.
// Percorre os workspaces com agendamento ativo e vencido, executa a função
// financial_health_check no banco e grava o resultado em health_check_runs.
// Nenhuma regra financeira vive aqui: o diagnóstico é 100% do banco.
import { createFileRoute } from "@tanstack/react-router";

const INFO_KEYS = new Set(["movimentacoes_sem_categoria", "imports_inconsistentes"]);

interface ScheduleRow {
  id: string;
  workspace_id: string;
  frequency: string;
  hour_utc: number;
  last_run_at: string | null;
}

function isDue(schedule: ScheduleRow, now: Date): boolean {
  if (now.getUTCHours() < schedule.hour_utc) return false;
  if (!schedule.last_run_at) return true;
  const last = new Date(schedule.last_run_at);
  const minHours = schedule.frequency === "WEEKLY" ? 24 * 7 : 20;
  return (now.getTime() - last.getTime()) / 3_600_000 >= minHours;
}

export const Route = createFileRoute("/api/public/hooks/health-check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("apikey") ?? "";
        if (!token) {
          return Response.json({ error: "Missing apikey" }, { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const now = new Date();

        const { data: schedules, error } = await supabaseAdmin
          .from("health_check_schedules")
          .select("id, workspace_id, frequency, hour_utc, last_run_at")
          .eq("enabled", true);

        if (error) {
          return Response.json({ error: error.message }, { status: 500 });
        }

        const due = ((schedules ?? []) as ScheduleRow[]).filter((s) => isDue(s, now));
        let alerts = 0;

        for (const schedule of due) {
          const { data: report, error: rpcError } = await supabaseAdmin.rpc(
            "financial_health_check" as never,
            { _workspace_id: schedule.workspace_id } as never,
          );

          if (rpcError) {
            console.error("[health-check:cron]", schedule.workspace_id, rpcError.message);
            continue;
          }

          const raw = (report ?? {}) as Record<string, unknown>;
          const issues = Object.entries(raw).filter(
            ([key, value]) =>
              key !== "checked_at" && !INFO_KEYS.has(key) && Number(value ?? 0) > 0,
          ).length;

          if (issues > 0) {
            alerts += 1;
            await supabaseAdmin.from("health_check_runs").insert({
              workspace_id: schedule.workspace_id,
              issues,
              report: raw as never,
              source: "SCHEDULED",
            });
          }

          await supabaseAdmin
            .from("health_check_schedules")
            .update({ last_run_at: now.toISOString() })
            .eq("id", schedule.id);
        }

        return Response.json({
          success: true,
          checked: due.length,
          alerts,
          at: now.toISOString(),
        });
      },
    },
  },
});
