// Sprint 4.15A — Ações confirmadas da conciliação de fatura.
// Cada mutação recarrega o histórico e as queries financeiras afetadas.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CardInvoiceReconciliationActionService } from "@/services/CardInvoiceReconciliationActionService";
import type { UUID } from "@/models";
import type { ExecuteInvoiceActionInput } from "@/models/CardInvoiceReconciliationAction";

export function useInvoiceReconciliationActions(invoiceId: UUID | undefined) {
  return useQuery({
    queryKey: ["invoice_reconciliation_actions", invoiceId],
    queryFn: () => CardInvoiceReconciliationActionService.listActions(invoiceId as UUID),
    enabled: !!invoiceId,
  });
}

function useRefresh(invoiceId: UUID | undefined) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["invoice_reconciliation_actions", invoiceId] });
    qc.invalidateQueries({ queryKey: ["movements"] });
    qc.invalidateQueries({ queryKey: ["card_invoices"] });
    qc.invalidateQueries({ queryKey: ["card_invoice", invoiceId] });
  };
}

export function useExecuteInvoiceAction(invoiceId: UUID | undefined) {
  const refresh = useRefresh(invoiceId);
  return useMutation({
    mutationFn: (input: ExecuteInvoiceActionInput) =>
      CardInvoiceReconciliationActionService.execute(input),
    onSuccess: refresh,
  });
}

export function useUndoInvoiceAction(invoiceId: UUID | undefined) {
  const refresh = useRefresh(invoiceId);
  return useMutation({
    mutationFn: (actionId: UUID) =>
      CardInvoiceReconciliationActionService.undo(actionId),
    onSuccess: refresh,
  });
}
