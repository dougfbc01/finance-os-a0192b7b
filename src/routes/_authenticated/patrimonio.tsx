import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Wallet, Landmark, TrendingUp, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  KpiWidget,
  NetWorthWidget,
  AssetsByClassWidget,
  AssetsByInstitutionWidget,
  LiabilitiesWidget,
  BalanceEvolutionWidget,
  PatrimonyCompositionWidget,
} from "@/components/dashboard/widgets";
import { AssetCard, AssetFormDialog, AssetDetailDialog } from "@/components/assets";
import { useWorkspace } from "@/hooks/useWorkspace";
import { usePatrimony } from "@/hooks/usePatrimony";
import type { Asset } from "@/models";

export const Route = createFileRoute("/_authenticated/patrimonio")({
  head: () => ({
    meta: [
      { title: "Patrimônio — Finance OS" },
      {
        name: "description",
        content:
          "Consolide seus ativos, passivos e patrimônio líquido em um único painel.",
      },
    ],
  }),
  component: PatrimonioPage,
});

function PatrimonioPage() {
  const { data: ws } = useWorkspace();
  const wsId = ws?.id;
  const {
    assets,
    invoices,
    snapshot,
    byClass,
    byInstitution,
    composition,
    movements,
    cashflow,
    isLoading,
  } = usePatrimony();
  const [detailId, setDetailId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);

  const filtered = assets.filter((a) =>
    a.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Patrimônio</h1>
          <p className="text-sm text-muted-foreground">
            Ativos + Caixa − Passivos. Ativos declarados nunca são despesa.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          disabled={!wsId}
        >
          <Plus className="mr-1 h-4 w-4" /> Novo ativo
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <NetWorthWidget snapshot={snapshot} />
            </div>
            <LiabilitiesWidget invoices={invoices} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KpiWidget title="Caixa disponível" value={snapshot.cash} icon={Wallet} />
            <KpiWidget title="Ativos declarados" value={snapshot.assets} icon={Landmark} />
            <KpiWidget
              title="Rentabilidade"
              value={snapshot.assetProfit}
              icon={TrendingUp}
              tone={snapshot.assetProfit >= 0 ? "positive" : "negative"}
            />
            <KpiWidget
              title="Passivos"
              value={snapshot.liabilities}
              icon={ShieldAlert}
              tone="negative"
            />
          </div>

          <PatrimonyCompositionWidget composition={composition} onSelectAsset={setDetailId} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AssetsByClassWidget data={byClass} />
            <AssetsByInstitutionWidget data={byInstitution} />
          </div>

          <div>
            <BalanceEvolutionWidget data={cashflow} />
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-lg font-semibold">Ativos cadastrados</h2>
            <Input
              placeholder="Buscar ativo…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full md:w-64"
            />
          </div>

          {filtered.length === 0 ? (
            <div className="flex min-h-[20vh] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {assets.length === 0
                  ? "Cadastre seu primeiro ativo para começar a acompanhar seu patrimônio."
                  : "Nenhum ativo corresponde à busca."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((a) => (
                <AssetCard
                  key={a.id}
                  asset={a}
                  onEdit={(as) => {
                    setEditing(as);
                    setFormOpen(true);
                  }}
                  onOpenDetail={(as) => setDetailId(as.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <AssetDetailDialog
        open={!!detailId}
        onOpenChange={(o) => !o && setDetailId(null)}
        asset={assets.find((a) => a.id === detailId) ?? null}
        movements={movements}
      />

      {wsId && (
        <AssetFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          workspaceId={wsId}
          asset={editing}
        />
      )}
    </div>
  );
}
