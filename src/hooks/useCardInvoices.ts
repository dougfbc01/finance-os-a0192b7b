import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CardInvoiceService } from "@/services/CardInvoiceService";
import type { UUID } from "@/models";

const KEY = "card_invoices";

export function useCardInvoices(workspaceId: UUID | undefined) {
  return useQuery({
    queryKey: [KEY, workspaceId],
    queryFn: () => CardInvoiceService.listByWorkspace(workspaceId as UUID),
    enabled: !!workspaceId,
  });
}

export function useCardInvoicesByCard(cardId: UUID | undefined) {
  return useQuery({
    queryKey: [KEY, "card", cardId],
    queryFn: () => CardInvoiceService.listByCard(cardId as UUID),
    enabled: !!cardId,
  });
}

export function useInvoiceMovements(invoiceId: UUID | undefined) {
  return useQuery({
    queryKey: [KEY, "movements", invoiceId],
    queryFn: () => CardInvoiceService.listMovements(invoiceId as UUID),
    enabled: !!invoiceId,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: [KEY] });
  qc.invalidateQueries({ queryKey: ["movements"] });
  qc.invalidateQueries({ queryKey: ["accounts"] });
  qc.invalidateQueries({ queryKey: ["dashboard"] });
}

export function useMarkInvoicePaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      invoiceId: UUID;
      accountId: UUID;
      workspaceId: UUID;
      paidAt: string;
      amount?: number;
    }) => CardInvoiceService.markPaid(params),
    onSuccess: () => invalidate(qc),
  });
}

export function useRecomputeInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invoiceId: UUID) => CardInvoiceService.recompute(invoiceId),
    onSuccess: () => invalidate(qc),
  });
}
