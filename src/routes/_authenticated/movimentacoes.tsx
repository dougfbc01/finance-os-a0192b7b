import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/movimentacoes")({
  head: () => ({ meta: [{ title: "Movimentações — Finance OS" }] }),
  component: () => <PlaceholderPage title="Movimentações" />,
});
