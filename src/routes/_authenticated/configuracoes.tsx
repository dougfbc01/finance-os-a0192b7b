import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Finance OS" }] }),
  component: () => <PlaceholderPage title="Configurações" />,
});
