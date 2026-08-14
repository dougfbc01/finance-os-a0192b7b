import { toast } from "sonner";
import { Pencil, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ASSET_TYPE_LABELS } from "@/constants/enums";
import { AssetServiceImpl } from "@/services/AssetService";
import { useDeleteAsset } from "@/hooks/useAssets";
import { formatCurrency } from "@/lib/format";
import type { Asset } from "@/models";

interface Props {
  asset: Asset;
  onEdit: (a: Asset) => void;
  onOpenDetail?: (a: Asset) => void;
}

export function AssetCard({ asset, onEdit, onOpenDetail }: Props) {
  const del = useDeleteAsset();
  const profit = AssetServiceImpl.profit(asset);
  const pct = AssetServiceImpl.profitPercent(asset);
  const positive = profit >= 0;

  const handleDelete = async () => {
    if (!confirm(`Excluir o ativo "${asset.name}"?`)) return;
    try {
      await del.mutateAsync(asset.id);
      toast.success("Ativo excluído");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Card className={asset.is_active ? "" : "opacity-60"}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {onOpenDetail ? (
              <button
                type="button"
                className="truncate font-semibold hover:underline"
                onClick={() => onOpenDetail(asset)}
              >
                {asset.name}
              </button>
            ) : (
              <p className="font-semibold truncate">{asset.name}</p>
            )}
            <p className="text-xs text-muted-foreground truncate">
              {asset.institution || "—"}
            </p>
          </div>
          <Badge variant="secondary" className="whitespace-nowrap">
            {ASSET_TYPE_LABELS[asset.asset_type]}
          </Badge>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Valor atual</p>
            <p className="font-semibold tabular-nums">
              {formatCurrency(asset.current_value, asset.currency)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Aquisição</p>
            <p className="tabular-nums">
              {formatCurrency(asset.acquisition_value, asset.currency)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Qtd. / PU</p>
            <p className="tabular-nums">
              {Number(asset.quantity).toLocaleString("pt-BR", { maximumFractionDigits: 8 })} ·{" "}
              {formatCurrency(asset.unit_price, asset.currency)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Rentabilidade</p>
            <p
              className={`flex items-center gap-1 tabular-nums font-medium ${
                positive ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {positive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {formatCurrency(profit, asset.currency)} ({pct.toFixed(2)}%)
            </p>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => onEdit(asset)}>
            <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDelete} className="text-red-600">
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Excluir
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
