// Sprint 4.14 — Execução do diagnóstico de conciliação de fatura.
// A conciliação é somente leitura: nenhuma query financeira é invalidada.
import { useMutation, useQuery } from "@tanstack/react-query";
import { CardInvoiceReconciliationService } from "@/services/CardInvoiceReconciliationService";
import { CardInvoiceService } from "@/services/CardInvoiceService";
import type { UUID } from "@/models";
import type { OfficialInvoiceLine } from "@/models/CardInvoiceReconciliation";

export function useCardInvoice(invoiceId: UUID | undefined) {
  return useQuery({
    queryKey: ["card_invoice", invoiceId],
    queryFn: () => CardInvoiceService.getById(invoiceId as UUID),
    enabled: !!invoiceId,
  });
}

export function useRunInvoiceReconciliation() {
  return useMutation({
    mutationFn: (params: {
      invoiceId: UUID;
      officialLines?: OfficialInvoiceLine[];
      officialTotal?: number | null;
    }) => CardInvoiceReconciliationService.run(params),
  });
}
