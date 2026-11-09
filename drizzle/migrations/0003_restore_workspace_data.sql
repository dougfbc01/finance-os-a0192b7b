CREATE OR REPLACE FUNCTION public.restore_workspace_data(_workspace_id uuid, _backup jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  tables text[] := ARRAY[
    'accounts','cards','categories','subcategories','classification_rules','monthly_budgets','monthly_budget_items',
    'financial_goals','financial_goal_contributions','financial_goal_accounts','assets','imports','card_invoices',
    'movements','market_price_history','monthly_closings','monthly_closing_events','commitments',
    'commitment_installments','b3_import_items','movement_import_exclusions','dedup_audits',
    'invoice_reconciliation_actions','reconciliation_decisions'];
  t text;
  cols text;
  rows jsonb;
  n bigint;
  counts jsonb := '{}'::jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.workspaces WHERE id = _workspace_id AND owner_id = auth.uid() AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Workspace inacessível';
  END IF;
  IF _backup->>'format' IS DISTINCT FROM 'finance-os-backup' OR jsonb_typeof(_backup->'tables') <> 'object' THEN
    RAISE EXCEPTION 'Arquivo de backup inválido';
  END IF;

  -- Substitui os dados atuais (mesma transação: qualquer erro desfaz tudo).
  PERFORM public.reset_workspace_data(_workspace_id, 'ALL', false);

  FOREACH t IN ARRAY tables LOOP
    SELECT coalesce(jsonb_agg(
      CASE WHEN t = 'card_invoices' THEN (e || jsonb_build_object('workspace_id', _workspace_id)) - 'paid_movement_id'
           ELSE e || jsonb_build_object('workspace_id', _workspace_id) END), '[]'::jsonb)
      INTO rows
      FROM jsonb_array_elements(coalesce(_backup->'tables'->t, '[]'::jsonb)) e;

    SELECT string_agg(quote_ident(a.attname), ',' ORDER BY a.attnum) INTO cols
      FROM pg_attribute a
     WHERE a.attrelid = format('public.%I', t)::regclass AND a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated = '';

    EXECUTE format('INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_recordset(NULL::public.%I, $1)', t, cols, cols, t)
      USING rows;
    GET DIAGNOSTICS n = ROW_COUNT;
    counts := counts || jsonb_build_object(t, n);
  END LOOP;

  -- Religa o pagamento das faturas depois que as movimentações existem.
  UPDATE public.card_invoices ci SET paid_movement_id = (e->>'paid_movement_id')::uuid
    FROM jsonb_array_elements(coalesce(_backup->'tables'->'card_invoices', '[]'::jsonb)) e
   WHERE ci.id = (e->>'id')::uuid AND ci.workspace_id = _workspace_id AND e->>'paid_movement_id' IS NOT NULL;

  INSERT INTO public.admin_audit_logs (actor_id, target_user_id, action, details)
  VALUES (auth.uid(), auth.uid(), 'WORKSPACE_DATA_RESTORE',
    jsonb_build_object('workspace_id', _workspace_id, 'exported_at', _backup->>'exported_at', 'counts', counts));

  RETURN counts;
END;
$function$;

REVOKE ALL ON FUNCTION public.restore_workspace_data(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_workspace_data(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.restore_workspace_data(uuid, jsonb) TO authenticated;