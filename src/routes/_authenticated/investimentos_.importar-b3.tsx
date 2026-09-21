import { createFileRoute } from "@tanstack/react-router";
import { B3ImportPreview } from "@/components/assets/B3ImportPreview";

export const Route = createFileRoute("/_authenticated/investimentos_/importar-b3")({
  head: () => ({
    meta: [
      { title: "Importar B3 — Finance OS" },
      { name: "description", content: "Revise e importe eventos históricos de investimentos da B3 sem alterar o fluxo de caixa." },
      { property: "og:title", content: "Importar B3 — Finance OS" },
      { property: "og:description", content: "Importação auditável e segura do histórico de investimentos exportado pela B3." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: B3ImportPreview,
});