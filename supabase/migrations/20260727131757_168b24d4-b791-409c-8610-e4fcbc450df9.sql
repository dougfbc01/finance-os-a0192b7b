-- Recompute helper: sums non-deleted movements linked to an invoice
-- and normalises status against today's date.
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
END; $$;

-- Trigger: after every insert/update/delete on movements, recompute both the
-- previous and next invoice_id (covers moves between faturas and soft-delete).
CREATE OR REPLACE FUNCTION public.trg_recompute_card_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.invoice_id IS NOT NULL THEN
      PERFORM public.recompute_card_invoice(OLD.invoice_id);
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.invoice_id IS NOT NULL THEN
    PERFORM public.recompute_card_invoice(NEW.invoice_id);
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.invoice_id IS NOT NULL
     AND OLD.invoice_id IS DISTINCT FROM NEW.invoice_id THEN
    PERFORM public.recompute_card_invoice(OLD.invoice_id);
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS movements_recompute_invoice ON public.movements;
CREATE TRIGGER movements_recompute_invoice
AFTER INSERT OR UPDATE OR DELETE ON public.movements
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_card_invoice();

-- Backfill existing invoices so historical zeros disappear.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.card_invoices WHERE deleted_at IS NULL LOOP
    PERFORM public.recompute_card_invoice(r.id);
  END LOOP;
END $$;