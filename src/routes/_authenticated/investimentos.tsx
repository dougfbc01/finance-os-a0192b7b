import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, TrendingUp, Wallet, PieChart as PieIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiWidget } from "@/components/dashboard/widgets";
import { AssetFormDialog, AssetDetailDialog } from "@/components/assets";
import { useWorkspace } from "@/hooks/useWorkspace";
import { usePatrimony } from "@/hooks/usePatrimony";
import { ASSET_TYPE_LABELS } from "@/constants/enums";
import { formatCurrency } from "@/lib/format";
import type { Asset } from "@/models";

export const Route = createFileRoute("/_authenticated/investimentos")({
  head: () => ({
    meta: [
      { title: "Investimentos — Finance OS" },
      {
        name: "description",
        content:
          "Acompanhe seus investimentos: quantidade, preço médio, valor atual e rentabilidade.",
      },
    ],
  }),
  component: InvestimentosPage,
});

function InvestimentosPage() {
  const { data: ws } = useWorkspace();
  const wsId = ws?.id;
  const { investments, investmentTotals, movements, isLoading } = usePatrimony();
  const [detailId, setDetailId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Investimentos</h1>
          <p className="text-sm text-muted-foreground">
            Ativos classificados como investimentos (renda fixa, ações, fundos, cripto…).
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          disabled={!wsId}
        >
          <Plus className="mr-1 h-4 w-4" /> Novo investimento
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KpiWidget title="Investido" value={investmentTotals.invested} icon={Wallet} />
            <KpiWidget title="Valor atual" value={investmentTotals.current} icon={PieIcon} />
            <KpiWidget
              title="Lucro/Prejuízo"
              value={investmentTotals.profit}
              icon={TrendingUp}
              tone={investmentTotals.profit >= 0 ? "positive" : "negative"}
            />
            <KpiWidget
              title="Rentabilidade"
              value={Number(investmentTotals.profitPercent.toFixed(2))}
              icon={TrendingUp}
              tone={investmentTotals.profitPercent >= 0 ? "positive" : "negative"}
              suffix="%"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Carteira ({investments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {investments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Nenhum investimento cadastrado ainda.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ativo</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead>Classe</TableHead>
                        <TableHead>Instituição</TableHead>
                        <TableHead className="text-right">Qtd.</TableHead>
                        <TableHead className="text-right">PM</TableHead>
                        <TableHead className="text-right">Investido</TableHead>
                        <TableHead className="text-right">Atual</TableHead>
                        <TableHead className="text-right">Rentab.</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {investments.map((r) => {
                        const positive = r.profit >= 0;
                        return (
                          <TableRow key={r.asset.id}>
                            <TableCell className="font-medium">
                              <button
                                type="button"
                                className="hover:underline"
                                onClick={() => setDetailId(r.asset.id)}
                              >
                                {r.asset.name}
                              </button>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {r.asset.ticker || "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {ASSET_TYPE_LABELS[r.asset.asset_type]}
                              </Badge>
                            </TableCell>
                            <TableCell>{r.asset.institution || "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {Number(r.asset.quantity).toLocaleString("pt-BR", {
                                maximumFractionDigits: 8,
                              })}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatCurrency(r.asset.unit_price, r.asset.currency)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatCurrency(r.invested, r.asset.currency)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatCurrency(r.current, r.asset.currency)}
                            </TableCell>
                            <TableCell
                              className={`text-right tabular-nums ${
                                positive ? "text-emerald-600" : "text-red-600"
                              }`}
                            >
                              {formatCurrency(r.profit, r.asset.currency)} (
                              {r.profitPercent.toFixed(2)}%)
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditing(r.asset);
                                  setFormOpen(true);
                                }}
                              >
                                Editar
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <AssetDetailDialog
        open={!!detailId}
        onOpenChange={(o) => !o && setDetailId(null)}
        asset={investments.find((r) => r.asset.id === detailId)?.asset ?? null}
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
