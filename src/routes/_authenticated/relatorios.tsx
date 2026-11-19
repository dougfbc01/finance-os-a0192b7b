import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MonthlySummaryReport } from "@/components/reports/MonthlySummaryReport";
import { useMonthlySummary } from "@/hooks/useMonthlySummary";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({ meta: [
      { title: "Relatórios — Finance OS" },
      { name: "description", content: "Resumo do mês: resultado, patrimônio, categorias, cartões, orçamento e investimentos no Finance OS." },
      { property: "og:title", content: "Relatórios — Finance OS" },
      { property: "og:description", content: "Resumo do mês: resultado, patrimônio, categorias, cartões, orçamento e investimentos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
  ] }),
  component: RelatoriosPage,
});

function defaultMonth() {
  const d = new Date();
  const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
}

function RelatoriosPage() {
  const [value, setValue] = useState(defaultMonth());
  const [y, m] = value.split("-").map(Number);
  const { summary, isLoading } = useMonthlySummary(y, m);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
        <p className="mt-1 text-sm text-muted-foreground">Resumo do mês, calculado na hora a partir dos seus lançamentos.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Resumo do mês</CardTitle></CardHeader>
        <CardContent>
          <Input type="month" className="w-48" value={value} max={new Date().toISOString().slice(0, 7)}
            onChange={(e) => e.target.value && setValue(e.target.value)} aria-label="Mês do resumo" />
        </CardContent>
      </Card>
      {isLoading || !summary ? <p className="text-sm text-muted-foreground">Carregando…</p> : <MonthlySummaryReport summary={summary} />}
    </div>
  );
}
