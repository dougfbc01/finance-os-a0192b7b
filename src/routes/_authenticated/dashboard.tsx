import { createFileRoute } from "@tanstack/react-router";
import { DashboardGrid, dashboardWidgets } from "@/components/dashboard";
import { APP_NAME } from "@/constants";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Finance OS" },
      { name: "description", content: "Visão geral da sua vida financeira no Finance OS." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{APP_NAME}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Bem-vindo ao Finance OS</p>
      </div>
      <DashboardGrid widgets={dashboardWidgets} />
    </div>
  );
}
