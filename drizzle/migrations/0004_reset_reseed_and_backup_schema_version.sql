DROP FUNCTION IF EXISTS public.reset_workspace_data(uuid, text, boolean);

CREATE OR REPLACE FUNCTION public.reset_workspace_data(_workspace_id uuid, _mode text, _dry_run boolean DEFAULT true, _reseed boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  base_tables text[] := ARRAY[
    'reconciliation_decisions','invoice_reconciliation_actions','dedup_audits','movement_import_exclusions',
    'b3_import_items','commitment_installments','commitments','monthly_closing_events','monthly_closings',
    'market_price_history','movements','card_invoices','imports','assets'];
  all_tables text[] := ARRAY[
    'financial_goal_accounts','financial_goal_contributions','financial_goals','monthly_budget_items','monthly_budgets',
    'classification_rules','subcategories','categories','cards','accounts'];
  tables text[];
  t text;
  n bigint;
  counts jsonb := '{}'::jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.workspaces WHERE id = _workspace_id AND owner_id = auth.uid() AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Workspace inacessível';
  END IF;
  IF _mode NOT IN ('MOVEMENTS_AND_INVESTMENTS','ALL') THEN
    RAISE EXCEPTION 'Modo inválido';
  END IF;
  tables := CASE WHEN _mode = 'ALL' THEN base_tables || all_tables ELSE base_tables END;

  IF NOT _dry_run THEN
    UPDATE public.card_invoices SET paid_movement_id = NULL WHERE workspace_id = _workspace_id AND paid_movement_id IS NOT NULL;
  END IF;

  FOREACH t IN ARRAY tables LOOP
    IF _dry_run THEN
      EXECUTE format('SELECT count(*) FROM public.%I WHERE workspace_id = $1', t) INTO n USING _workspace_id;
    ELSE
      IF t = 'movements' THEN
        UPDATE public.movements SET invoice_id = NULL WHERE workspace_id = _workspace_id AND invoice_id IS NOT NULL;
      END IF;
      EXECUTE format('DELETE FROM public.%I WHERE workspace_id = $1', t) USING _workspace_id;
      GET DIAGNOSTICS n = ROW_COUNT;
    END IF;
    counts := counts || jsonb_build_object(t, n);
  END LOOP;

  IF NOT _dry_run AND _mode = 'ALL' AND _reseed THEN
    PERFORM public.seed_default_categories(_workspace_id);
  END IF;

  IF NOT _dry_run THEN
    INSERT INTO public.admin_audit_logs (actor_id, target_user_id, action, details)
    VALUES (auth.uid(), auth.uid(), 'WORKSPACE_DATA_RESET',
      jsonb_build_object('workspace_id', _workspace_id, 'mode', _mode, 'reseed', _reseed, 'counts', counts));
  END IF;

  RETURN counts;
END;
$function$;

REVOKE ALL ON FUNCTION public.reset_workspace_data(uuid, text, boolean, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reset_workspace_data(uuid, text, boolean, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.reset_workspace_data(uuid, text, boolean, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.restore_workspace_data(_workspace_id uuid, _backup jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  expected_schema text := '0004_reset_reseed_and_backup_schema_version';
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
  IF _backup->>'schema_version' IS DISTINCT FROM expected_schema THEN
    RAISE EXCEPTION 'Versão do backup incompatível: arquivo %, sistema %. Gere um novo backup nesta versão.',
      coalesce(_backup->>'schema_version', 'sem versão'), expected_schema;
  END IF;

  PERFORM public.reset_workspace_data(_workspace_id, 'ALL', false, false);

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

  UPDATE public.card_invoices ci SET paid_movement_id = (e->>'paid_movement_id')::uuid
    FROM jsonb_array_elements(coalesce(_backup->'tables'->'card_invoices', '[]'::jsonb)) e
   WHERE ci.id = (e->>'id')::uuid AND ci.workspace_id = _workspace_id AND e->>'paid_movement_id' IS NOT NULL;

  INSERT INTO public.admin_audit_logs (actor_id, target_user_id, action, details)
  VALUES (auth.uid(), auth.uid(), 'WORKSPACE_DATA_RESTORE',
    jsonb_build_object('workspace_id', _workspace_id, 'exported_at', _backup->>'exported_at',
      'schema_version', _backup->>'schema_version', 'counts', counts));

  RETURN counts;
END;
$function$;

REVOKE ALL ON FUNCTION public.restore_workspace_data(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_workspace_data(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.restore_workspace_data(uuid, jsonb) TO authenticated;