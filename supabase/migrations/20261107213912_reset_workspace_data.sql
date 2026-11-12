CREATE OR REPLACE FUNCTION public.reset_workspace_data(_workspace_id uuid, _mode text, _dry_run boolean DEFAULT true)
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
    -- Quebra o ciclo movements <-> card_invoices antes dos DELETEs.
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

  IF NOT _dry_run THEN
    INSERT INTO public.admin_audit_logs (actor_id, target_user_id, action, details)
    VALUES (auth.uid(), auth.uid(), 'WORKSPACE_DATA_RESET',
      jsonb_build_object('workspace_id', _workspace_id, 'mode', _mode, 'counts', counts));
  END IF;

  RETURN counts;
END;
$function$;

REVOKE ALL ON FUNCTION public.reset_workspace_data(uuid, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reset_workspace_data(uuid, text, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.reset_workspace_data(uuid, text, boolean) TO authenticated;