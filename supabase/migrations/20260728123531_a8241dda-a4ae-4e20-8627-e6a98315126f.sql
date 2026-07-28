
-- 1) Default status PENDING para compras em cartão
CREATE OR REPLACE FUNCTION public.trg_default_card_purchase_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.card_id IS NOT NULL
     AND NEW.type <> 'CARD_PAYMENT'
     AND NEW.type <> 'TRANSFER' THEN
    -- Preserva status explícito só se for RECONCILED; caso contrário força PENDING.
    IF NEW.status IS NULL OR NEW.status = 'CLEARED' THEN
      NEW.status := 'PENDING';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS movements_default_card_status ON public.movements;
CREATE TRIGGER movements_default_card_status
BEFORE INSERT ON public.movements
FOR EACH ROW EXECUTE FUNCTION public.trg_default_card_purchase_status();

-- 2) Recompute agora também sincroniza status das compras da fatura
CREATE OR REPLACE FUNCTION public.recompute_card_invoice(_invoice_id UUID)
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
  WHERE invoice_id = _invoice_id AND deleted_at IS NULL;

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

  -- Sincroniza status das compras vinculadas à fatura
  IF new_status = 'PAID' THEN
    UPDATE public.movements
       SET status = 'CLEARED',
           updated_at = now()
     WHERE invoice_id = _invoice_id
       AND deleted_at IS NULL
       AND status <> 'CLEARED'
       AND status <> 'RECONCILED';
  ELSE
    UPDATE public.movements
       SET status = 'PENDING',
           updated_at = now()
     WHERE invoice_id = _invoice_id
       AND deleted_at IS NULL
       AND status = 'CLEARED';
  END IF;
END; $$;

REVOKE ALL ON FUNCTION public.recompute_card_invoice(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_default_card_purchase_status() FROM PUBLIC, anon, authenticated;

-- 3) Reprocessa todas as faturas existentes
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.card_invoices WHERE deleted_at IS NULL LOOP
    PERFORM public.recompute_card_invoice(r.id);
  END LOOP;
END $$;
