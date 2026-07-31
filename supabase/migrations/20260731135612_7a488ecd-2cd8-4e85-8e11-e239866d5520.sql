-- Causa raiz: linhas "Pagamento recebido" do CSV do cartão foram importadas como
-- REFUND vinculado à fatura, zerando o total da fatura.
UPDATE public.movements
   SET type = 'CARD_PAYMENT',
       invoice_id = NULL,
       updated_at = now()
 WHERE card_id IS NOT NULL
   AND type = 'REFUND'
   AND deleted_at IS NULL
   AND (description ILIKE 'pagamento%' OR description ILIKE '%pagamento de fatura%');

-- O total da fatura considera exclusivamente compras e estornos.
CREATE OR REPLACE FUNCTION public.recompute_card_invoice(_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv RECORD;
  total NUMERIC := 0;
  new_status public.card_invoice_status;
BEGIN
  SELECT * INTO inv FROM public.card_invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(SUM(
    CASE WHEN type = 'REFUND' THEN -amount ELSE amount END
  ), 0) INTO total
  FROM public.movements
  WHERE invoice_id = _invoice_id
    AND deleted_at IS NULL
    AND type IN ('EXPENSE', 'REFUND');

  IF total < 0 THEN total := 0; END IF;

  IF inv.status = 'PAID' THEN
    new_status := 'PAID';
  ELSIF CURRENT_DATE > inv.due_date THEN
    new_status := 'OVERDUE';
  ELSIF CURRENT_DATE > inv.closing_date THEN
    new_status := 'CLOSED';
  ELSE
    new_status := 'OPEN';
  END IF;

  UPDATE public.card_invoices
     SET amount = total,
         status = new_status,
         updated_at = now()
   WHERE id = _invoice_id;

  IF new_status = 'PAID' THEN
    UPDATE public.movements
       SET status = 'CLEARED', updated_at = now()
     WHERE invoice_id = _invoice_id
       AND deleted_at IS NULL
       AND status <> 'CLEARED'
       AND status <> 'RECONCILED';
  ELSE
    UPDATE public.movements
       SET status = 'PENDING', updated_at = now()
     WHERE invoice_id = _invoice_id
       AND deleted_at IS NULL
       AND status = 'CLEARED';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_card_invoice(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recompute_card_invoice(uuid) TO authenticated, service_role;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.card_invoices WHERE deleted_at IS NULL LOOP
    PERFORM public.recompute_card_invoice(r.id);
  END LOOP;
END $$;