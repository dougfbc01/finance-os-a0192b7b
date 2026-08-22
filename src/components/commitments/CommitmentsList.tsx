// Lista de compromissos com parcelas expansíveis.
// Nenhum cálculo aqui: tudo vem pronto do CommitmentService via useCommitments.
import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCancelCommitment, useToggleInstallmentPaid } from "@/hooks/useCommitments";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  COMMITMENT_STATUS_LABELS,
  COMMITMENT_TYPE_LABELS,
  INSTALLMENT_DISPLAY_LABELS,
  type CommitmentView,
  type InstallmentDisplayStatus,
} from "@/models/Commitment";

const BADGE_VARIANT: Record<
  InstallmentDisplayStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  FORECAST: "outline",
  OVERDUE: "destructive",
  POSTED: "secondary",
  PAID: "default",
  CANCELLED: "secondary",
};

interface Props {
  views: CommitmentView[];
  categoryName: (id: string | null) => string;
  onEdit: (view: CommitmentView) => void;
}

export function CommitmentsList({ views, categoryName, onEdit }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const cancelMut = useCancelCommitment();
  const toggleMut = useToggleInstallmentPaid();

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleCancel = async (id: string, name: string) => {
    if (!window.confirm(`Cancelar o compromisso "${name}" e suas parcelas em aberto?`)) return;
    try {
      await cancelMut.mutateAsync(id);
      toast.success("Compromisso cancelado. Nenhum lançamento foi alterado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível cancelar.");
    }
  };

  const handleToggle = async (id: string, paid: boolean) => {
    try {
      await toggleMut.mutateAsync({ id, paid });
      toast.success(
        paid
          ? "Parcela marcada como paga. Nenhuma movimentação foi criada."
          : "Parcela devolvida para prevista.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível atualizar a parcela.");
    }
  };

  if (!views.length) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nenhum compromisso cadastrado. Use “Novo compromisso” para registrar financiamentos,
          parcelamentos e assinaturas — sem afetar o saldo atual.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {views.map((v) => {
        const c = v.commitment;
        const open = expanded.has(c.id);
        return (
          <Card key={c.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      aria-label={open ? "Recolher parcelas" : "Expandir parcelas"}
                      onClick={() => toggle(c.id)}
                    >
                      {open ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                    <span className="font-medium">{c.name}</span>
                    <Badge variant={c.status === "ACTIVE" ? "default" : "secondary"}>
                      {COMMITMENT_STATUS_LABELS[c.status]}
                    </Badge>
                    {v.overdueCount > 0 && (
                      <Badge variant="destructive">{v.overdueCount} atrasada(s)</Badge>
                    )}
                  </div>
                  <p className="mt-1 pl-8 text-sm text-muted-foreground">
                    {COMMITMENT_TYPE_LABELS[c.commitment_type]}
                    {c.category_id ? ` · ${categoryName(c.category_id)}` : ""} ·{" "}
                    {v.paidCount}/{c.installments_count} parcelas pagas
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => onEdit(v)}>
                    Editar
                  </Button>
                  {c.status !== "CANCELLED" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCancel(c.id, c.name)}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid gap-3 pl-8 sm:grid-cols-4">
                <Info label="Valor total" value={formatCurrency(c.total_amount)} />
                <Info label="Restante" value={formatCurrency(v.remainingAmount)} />
                <Info
                  label="Próxima parcela"
                  value={v.next ? `${v.next.label} · ${formatCurrency(v.next.amount)}` : "—"}
                />
                <Info
                  label="Vencimento"
                  value={v.next ? formatDate(v.next.due_date) : "—"}
                />
              </div>

              {open && (
                <div className="pl-8">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Parcela</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {v.installments.map((i) => (
                        <TableRow key={i.id}>
                          <TableCell>{i.label}</TableCell>
                          <TableCell>{formatDate(i.due_date)}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(i.amount)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={BADGE_VARIANT[i.display_status]}>
                              {INSTALLMENT_DISPLAY_LABELS[i.display_status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {i.display_status !== "CANCELLED" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleToggle(i.id, i.display_status !== "PAID")
                                }
                              >
                                {i.display_status === "PAID" ? "Desfazer baixa" : "Marcar paga"}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
