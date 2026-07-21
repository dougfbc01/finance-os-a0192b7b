import { createFileRoute } from "@tanstack/react-router";

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
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <h1 className="text-4xl font-bold tracking-tight">Finance OS</h1>
      <p className="mt-3 text-muted-foreground">Bem-vindo ao Finance OS</p>
    </div>
  );
}
