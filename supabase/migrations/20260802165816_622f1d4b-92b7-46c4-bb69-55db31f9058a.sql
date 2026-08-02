-- 1) Internaliza a rotina de recálculo: nenhum usuário logado pode chamá-la diretamente.
REVOKE EXECUTE ON FUNCTION public.recompute_card_invoice(uuid) FROM PUBLIC, anon, authenticated;

-- 2) Wrapper seguro para o app: valida a posse do workspace antes de recalcular.
CREATE OR REPLACE FUNCTION public.recompute_my_card_invoice(_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM public.card_invoices i
      JOIN public.workspaces w ON w.id = i.workspace_id
     WHERE i.id = _invoice_id
       AND i.deleted_at IS NULL
       AND w.owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Fatura inacessível';
  END IF;

  PERFORM public.recompute_card_invoice(_invoice_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recompute_my_card_invoice(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recompute_my_card_invoice(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_my_card_invoice(uuid) TO service_role;