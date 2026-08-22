import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CommitmentFormDialog, CommitmentsList } from "@/components/commitments";
import { useCommitments } from "@/hooks/useCommitments";
import { useCategories } from "@/hooks/useCategories";
import { formatCurrency } from "@/lib/format";
import type { Commitment } from "@/models/Commitment";

export const Route = createFileRoute("/_authenticated/compromissos")({
  head: () => ({
    meta: [
      { title: "Compromissos e Parcelamentos — Finance OS" },
      {
        name: "description",
        content:
          "Cadastre financiamentos, parcelamentos e assinaturas e acompanhe as parcelas previstas sem afetar o saldo atual.",
      },
      { property: "og:title", content: "Compromissos e Parcelamentos — Finance OS" },
      {
        property: "og:description",
        content: "Obrigações futuras previstas, parcela a parcela, sem lançamentos artificiais.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CompromissosPage,
});

function CompromissosPage() {
  const { workspaceId, views, overdueCount, remainingTotal, monthlyTotal, isLoading } =
    useCommitments();
  const { data: categories = [] } = useCategories(workspaceId);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Commitment | null>(null);

  const categoryName = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c.name]));
    return (id: string | null) => (id ? (map.get(id) ?? "—") : "—");
  }, [categories]);

  const active = views.filter((v) => v.commitment.status !== "CANCELLED");
  const cancelled = views.filter((v) => v.commitment.status === "CANCELLED");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Compromissos</h1>
          <p className="text-sm text-muted-foreground">
            Obrigações futuras previstas. Parcelas são previsões — nenhuma movimentação é
            criada automaticamente.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          Novo compromisso
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label="Total restante" value={formatCurrency(remainingTotal)} />
        <Kpi label="Próximas parcelas" value={formatCurrency(monthlyTotal)} />
        <Kpi
          label="Parcelas atrasadas"
          value={String(overdueCount)}
          tone={overdueCount > 0 ? "text-destructive" : undefined}
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando compromissos...</p>
      ) : (
        <>
          <CommitmentsList
            views={active}
            categoryName={categoryName}
            onEdit={(v) => {
              setEditing(v.commitment);
              setOpen(true);
            }}
          />
          {cancelled.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">Cancelados</h2>
              <CommitmentsList
                views={cancelled}
                categoryName={categoryName}
                onEdit={(v) => {
                  setEditing(v.commitment);
                  setOpen(true);
                }}
              />
            </div>
          )}
        </>
      )}

      {workspaceId && (
        <CommitmentFormDialog
          open={open}
          onOpenChange={setOpen}
          workspaceId={workspaceId}
          commitment={editing}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-xl font-semibold ${tone ?? ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
