REVOKE ALL ON FUNCTION public.recompute_card_invoice(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_recompute_card_invoice() FROM PUBLIC, anon, authenticated;