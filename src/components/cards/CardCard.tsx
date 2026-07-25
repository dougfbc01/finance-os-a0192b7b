import { useState } from "react";
import { toast } from "sonner";
import { CreditCard, Pencil, MoreVertical, Power, Trash2 } from "lucide-react";
import { Card as UiCard, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency } from "@/lib/format";
import { CardServiceImpl } from "@/services/CardService";
import { useToggleCardActive, useDeleteCard } from "@/hooks/useCards";
import type { Card, CardInvoice } from "@/models";

interface Props {
  card: Card;
  invoices: CardInvoice[];
  onEdit: (card: Card) => void;
  onOpenInvoices: (card: Card) => void;
}

export function CardCard({ card, invoices, onEdit, onOpenInvoices }: Props) {
  const [busy, setBusy] = useState(false);
  const toggle = useToggleCardActive();
  const del = useDeleteCard();

  const used = CardServiceImpl.computeUsedLimit(invoices);
  const pct = card.credit_limit > 0 ? Math.min(100, (used / card.credit_limit) * 100) : 0;

  const handleToggle = async () => {
    setBusy(true);
    try {
      await toggle.mutateAsync({ id: card.id, isActive: !card.is_active });
      toast.success(card.is_active ? "Cartão desativado" : "Cartão ativado");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Excluir este cartão? As faturas serão mantidas para histórico.")) return;
    setBusy(true);
    try {
      await del.mutateAsync(card.id);
      toast.success("Cartão excluído");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <UiCard className={card.is_active ? "" : "opacity-60"}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className="h-10 w-10 rounded-md flex items-center justify-center text-white shrink-0"
            style={{ backgroundColor: card.color }}
          >
            <CreditCard className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold truncate">{card.name}</p>
              {card.brand && (
                <Badge variant="outline" className="uppercase text-[10px]">
                  {card.brand}
                </Badge>
              )}
              {!card.is_active && <Badge variant="secondary">Inativo</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              {card.last_digits ? `•••• ${card.last_digits}` : "—"} · fecha dia {card.closing_day}{" "}
              · vence dia {card.due_day}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" disabled={busy}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(card)}>
                <Pencil className="mr-2 h-4 w-4" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleToggle}>
                <Power className="mr-2 h-4 w-4" />
                {card.is_active ? "Desativar" : "Ativar"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDelete} className="text-red-600">
                <Trash2 className="mr-2 h-4 w-4" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">Uso do limite</span>
            <span className="text-xs tabular-nums">
              {formatCurrency(used)} / {formatCurrency(card.credit_limit)}
            </span>
          </div>
          <Progress value={pct} />
        </div>

        <div className="mt-4 flex justify-end">
          <Button variant="outline" size="sm" onClick={() => onOpenInvoices(card)}>
            Ver faturas ({invoices.length})
          </Button>
        </div>
      </CardContent>
    </UiCard>
  );
}
