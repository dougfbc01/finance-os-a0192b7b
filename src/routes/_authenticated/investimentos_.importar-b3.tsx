import { createFileRoute } from "@tanstack/react-router";
import { B3ImportPreview } from "@/components/assets/B3ImportPreview";

export const Route = createFileRoute("/_authenticated/investimentos_/importar-b3")({
  head: () => ({
    meta: [
      { title: "Importar B3 — Finance OS" },
      { name: "description", content: "Analise e classifique o Excel de movimentações da B3 sem alterar seus dados financeiros." },
      { property: "og:title", content: "Importar B3 — Finance OS" },
      { property: "og:description", content: "Preview seguro e explicável das movimentações exportadas pela B3." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: B3ImportPreview,
});