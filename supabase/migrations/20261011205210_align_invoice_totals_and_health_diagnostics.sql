DO $$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.recompute_card_invoice(uuid)'::regprocedure) INTO definition;
  definition := replace(definition, 'AND type IN (''EXPENSE'', ''REFUND'')', 'AND NOT is_historical AND type NOT IN (''TRANSFER'', ''CARD_PAYMENT'')');
  EXECUTE definition;
  SELECT pg_get_functiondef('private.financial_health_check(uuid)'::regprocedure) INTO definition;
  definition := replace(definition, 'WHERE m.invoice_id = i.id AND m.deleted_at IS NULL', 'WHERE m.invoice_id = i.id AND m.deleted_at IS NULL AND NOT m.is_historical AND m.type NOT IN (''TRANSFER'', ''CARD_PAYMENT'')');
  definition := replace(definition, 'AND (m.account_id IS NULL OR m.transfer_account_id IS NULL)', 'AND (m.account_id IS NULL OR (m.transfer_account_id IS NULL AND NOT (m.transfer_group_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.movements origin WHERE origin.workspace_id = m.workspace_id AND origin.transfer_group_id = m.transfer_group_id AND origin.deleted_at IS NULL AND origin.type = ''TRANSFER'' AND origin.transfer_account_id = m.account_id))))');
  EXECUTE definition;
END $$;