import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({ meta: [
      { name: "description", content: "Relatórios financeiros de contas, cartões e investimentos no Finance OS." },
      { property: "og:title", content: "Relatórios — Finance OS" },
      { property: "og:description", content: "Relatórios financeiros de contas, cartões e investimentos no Finance OS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
{ title: "Relatórios — Finance OS" }] }),
  component: () => <PlaceholderPage title="Relatórios" />,
});
