import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/patrimonio")({
  head: () => ({ meta: [{ title: "Patrimônio — Finance OS" }] }),
  component: () => <PlaceholderPage title="Patrimônio" />,
});
