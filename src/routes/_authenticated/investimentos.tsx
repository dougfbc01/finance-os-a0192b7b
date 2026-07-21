import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/investimentos")({
  head: () => ({ meta: [{ title: "Investimentos — Finance OS" }] }),
  component: () => <PlaceholderPage title="Investimentos" />,
});
