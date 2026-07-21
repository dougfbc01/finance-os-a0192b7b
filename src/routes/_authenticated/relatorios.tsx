import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — Finance OS" }] }),
  component: () => <PlaceholderPage title="Relatórios" />,
});
