import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, CreditCard as CreditCardIcon, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { CardCard } from "@/components/cards/CardCard";
import { CardFormDialog } from "@/components/cards/CardFormDialog";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAccounts } from "@/hooks/useAccounts";
import { useCards } from "@/hooks/useCards";
import {
  useCardInvoices,
  useInvoiceMovements,
  useMarkInvoicePaid,
} from "@/hooks/useCardInvoices";
import { formatCurrency, formatDate } from "@/lib/format";
import { CARD_INVOICE_STATUS_LABELS } from "@/constants/enums";
import type { Card, CardInvoice } from "@/models";

export const Route = createFileRoute("/_authenticated/cartoes")({
  head: () => ({
    meta: [
      { title: "Cartões — Finance OS" },
      {
        name: "description",
        content:
          "Gerencie cartões de crédito, limites, faturas e pagamentos consolidados por competência.",
      },
    ],
  }),
  component: CartoesPage,
});

function CartoesPage() {
  const { data: ws } = useWorkspace();
  const wsId = ws?.id;
  const { data: cards = [], isLoading } = useCards(wsId);
  const { data: accounts = [] } = useAccounts(wsId);
  const { data: allInvoices = [] } = useCardInvoices(wsId);

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Card | null>(null);
  const [invoicesOpen, setInvoicesOpen] = useState<Card | null>(null);
  const [payingInvoice, setPayingInvoice] = useState<CardInvoice | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? cards.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.brand ?? "").toLowerCase().includes(q) ||
            (c.holder_name ?? "").toLowerCase().includes(q),
        )
      : cards;
  }, [cards, search]);

  const invoicesByCard = useMemo(() => {
    const map = new Map<string, CardInvoice[]>();
    for (const inv of allInvoices) {
      const arr = map.get(inv.card_id) ?? [];
      arr.push(inv);
      map.set(inv.card_id, arr);
    }
    return map;
  }, [allInvoices]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cartões</h1>
          <p className="text-sm text-muted-foreground">
            Cadastre seus cartões de crédito e acompanhe faturas por competência.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Buscar cartão…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-64"
          />
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> Novo cartão
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <CreditCardIcon className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhum cartão ainda. Crie o primeiro para começar a acompanhar faturas.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <CardCard
              key={c.id}
              card={c}
              invoices={invoicesByCard.get(c.id) ?? []}
              onEdit={(card) => {
                setEditing(card);
                setFormOpen(true);
              }}
              onOpenInvoices={setInvoicesOpen}
            />
          ))}
        </div>
      )}

      {wsId && (
        <CardFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          workspaceId={wsId}
          accounts={accounts}
          card={editing}
        />
      )}

      <InvoicesDialog
        card={invoicesOpen}
        invoices={invoicesOpen ? invoicesByCard.get(invoicesOpen.id) ?? [] : []}
        onClose={() => setInvoicesOpen(null)}
        onPay={setPayingInvoice}
      />

      <PayInvoiceDialog
        invoice={payingInvoice}
        card={invoicesOpen}
        accounts={accounts}
        workspaceId={wsId}
        onClose={() => setPayingInvoice(null)}
      />
    </div>
  );
}

function InvoicesDialog({
  card,
  invoices,
  onClose,
  onPay,
}: {
  card: Card | null;
  invoices: CardInvoice[];
  onClose: () => void;
  onPay: (inv: CardInvoice) => void;
}) {
  return (
    <Dialog open={!!card} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Faturas — {card?.name}</DialogTitle>
          <DialogDescription>
            Compras agrupadas por competência com base no dia de fechamento do cartão.
          </DialogDescription>
        </DialogHeader>
        {invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Nenhuma fatura registrada. Importe a fatura ou lance compras neste cartão.
          </p>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {invoices.map((inv) => (
              <InvoiceRow key={inv.id} invoice={inv} onPay={() => onPay(inv)} />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InvoiceRow({
  invoice,
  onPay,
}: {
  invoice: CardInvoice;
  onPay: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { data: movements = [] } = useInvoiceMovements(open ? invoice.id : undefined);
  const statusVariant =
    invoice.status === "PAID"
      ? "default"
      : invoice.status === "OVERDUE"
        ? "destructive"
        : invoice.status === "CLOSED"
          ? "secondary"
          : "outline";
  return (
    <div className="rounded-md border">
      <button
        type="button"
        className="w-full flex items-center justify-between p-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div>
          <p className="font-medium">
            {new Date(`${invoice.competence}T00:00:00`).toLocaleDateString("pt-BR", {
              month: "long",
              year: "numeric",
            })}
          </p>
          <p className="text-xs text-muted-foreground">
            Fecha {formatDate(invoice.closing_date)} · Vence {formatDate(invoice.due_date)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="tabular-nums font-semibold">{formatCurrency(invoice.amount)}</span>
          <Badge variant={statusVariant as never}>
            {CARD_INVOICE_STATUS_LABELS[invoice.status]}
          </Badge>
        </div>
      </button>
      {open && (
        <div className="border-t p-3 space-y-2">
          {movements.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem compras vinculadas.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {movements.map((m) => (
                <li key={m.id} className="flex justify-between gap-2">
                  <span className="truncate">
                    {formatDate(m.transaction_date)} · {m.description}
                  </span>
                  <span className="tabular-nums">
                    {m.type === "REFUND" ? "-" : ""}
                    {formatCurrency(m.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {invoice.status !== "PAID" && (
            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={onPay}>
                <Check className="mr-1 h-3.5 w-3.5" /> Marcar como paga
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PayInvoiceDialog({
  invoice,
  card,
  accounts,
  workspaceId,
  onClose,
}: {
  invoice: CardInvoice | null;
  card: Card | null;
  accounts: { id: string; name: string }[];
  workspaceId: string | undefined;
  onClose: () => void;
}) {
  const [accountId, setAccountId] = useState<string>(card?.account_id ?? "");
  const [paidAt, setPaidAt] = useState<string>(
    invoice ? invoice.due_date : new Date().toISOString().slice(0, 10),
  );
  const mut = useMarkInvoicePaid();

  const handlePay = async () => {
    if (!invoice || !workspaceId) return;
    if (!accountId) {
      toast.error("Selecione a conta de pagamento");
      return;
    }
    try {
      await mut.mutateAsync({
        invoiceId: invoice.id,
        accountId,
        workspaceId,
        paidAt,
      });
      toast.success("Fatura marcada como paga");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open={!!invoice} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pagar fatura</DialogTitle>
          <DialogDescription>
            Registra um único movimento de pagamento na conta selecionada.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Conta</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Data do pagamento</Label>
            <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </div>
          <div className="text-sm text-muted-foreground">
            Valor: <strong>{invoice ? formatCurrency(invoice.amount) : "—"}</strong>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handlePay} disabled={mut.isPending}>
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
