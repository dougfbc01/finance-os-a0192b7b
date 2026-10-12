import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Finance OS — Controle financeiro" },
    { name: "description", content: "Controle financeiro de contas, cartões e investimentos no Finance OS." },
    { property: "og:title", content: "Finance OS — Controle financeiro" },
    { property: "og:description", content: "Controle financeiro de contas, cartões e investimentos no Finance OS." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
  component: () => null,
});
