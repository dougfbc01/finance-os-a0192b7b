import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format";
import {
  AssetHistoryService,
  type AssetAcquisitionEntry,
} from "@/services/AssetHistoryService";

interface Props {
  entries: AssetAcquisitionEntry[];
  onChange: (entries: AssetAcquisitionEntry[]) => void;
  currency?: string;
}

const emptyEntry = (): AssetAcquisitionEntry => ({ date: "", quantity: 0, unit_price: 0 });

/**
 * Sprint 4.8.1 — cadastro em lote do histórico de aquisições de um ativo.
 * Cada linha vira uma movimentação histórica (não impacta caixa).
 */
export function AssetHistoryEditor({ entries, onChange, currency = "BRL" }: Props) {
  const totals = AssetHistoryService.totals(entries);

  const update = (index: number, patch: Partial<AssetAcquisitionEntry>) => {
    onChange(entries.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  };

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm">Histórico de aquisições</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...entries, emptyEntry()])}
        >
          <Plus className="h-4 w-4 mr-1" />
          Adicionar linha
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Operações anteriores ao início do controle. Não alteram o saldo das contas.
      </p>

      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma aquisição adicionada.</p>
      ) : (
        <div className="max-h-64 space-y-2 overflow-y-auto overscroll-contain pr-1">
          {entries.map((entry, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <Input
                className="col-span-4"
                type="date"
                value={entry.date}
                onChange={(e) => update(i, { date: e.target.value })}
              />
              <Input
                className="col-span-3"
                type="number"
                step="0.00000001"
                placeholder="Qtd."
                value={entry.quantity || ""}
                onChange={(e) => update(i, { quantity: Number(e.target.value) })}
              />
              <Input
                className="col-span-3"
                type="number"
                step="0.000001"
                placeholder="Preço unit."
                value={entry.unit_price || ""}
                onChange={(e) => update(i, { unit_price: Number(e.target.value) })}
              />
              <span className="col-span-1 text-right text-xs tabular-nums text-muted-foreground">
                {formatCurrency(AssetHistoryService.amountOf(entry), currency)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="col-span-1"
                onClick={() => onChange(entries.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {totals.count > 0 && (
        <div className="flex flex-wrap gap-4 border-t pt-2 text-xs tabular-nums">
          <span>Linhas: <strong>{totals.count}</strong></span>
          <span>Quantidade: <strong>{totals.quantity}</strong></span>
          <span>Custo total: <strong>{formatCurrency(totals.cost, currency)}</strong></span>
          <span>Preço médio: <strong>{formatCurrency(totals.averagePrice, currency)}</strong></span>
        </div>
      )}
    </div>
  );
}
