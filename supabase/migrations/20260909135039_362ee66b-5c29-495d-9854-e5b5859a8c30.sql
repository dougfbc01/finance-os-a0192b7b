CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- has_role (internal, definer)
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION private.financial_health_check(_workspace_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces w
     WHERE w.id = _workspace_id AND w.owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Workspace inacessível';
  END IF;

  SELECT jsonb_build_object(
    'invoices_orfas', (
      SELECT count(*) FROM public.card_invoices i
       LEFT JOIN public.cards c ON c.id = i.card_id AND c.deleted_at IS NULL
       WHERE i.workspace_id = _workspace_id AND i.deleted_at IS NULL AND c.id IS NULL),
    'invoices_zeradas', (
      SELECT count(*) FROM public.card_invoices i
       WHERE i.workspace_id = _workspace_id AND i.deleted_at IS NULL AND i.amount = 0
         AND EXISTS (SELECT 1 FROM public.movements m
                      WHERE m.invoice_id = i.id AND m.deleted_at IS NULL)),
    'invoices_divergentes', (
      SELECT count(*) FROM public.card_invoices i
       WHERE i.workspace_id = _workspace_id AND i.deleted_at IS NULL
         AND i.amount <> GREATEST(COALESCE((
              SELECT SUM(CASE WHEN m.type = 'REFUND' THEN -m.amount ELSE m.amount END)
                FROM public.movements m
               WHERE m.invoice_id = i.id AND m.deleted_at IS NULL), 0), 0)),
    'compras_sem_invoice', (
      SELECT count(*) FROM public.movements m
       WHERE m.workspace_id = _workspace_id AND m.deleted_at IS NULL
         AND m.card_id IS NOT NULL AND m.invoice_id IS NULL
         AND m.type NOT IN ('CARD_PAYMENT','TRANSFER')),
    'invoice_id_invalido', (
      SELECT count(*) FROM public.movements m
       LEFT JOIN public.card_invoices i ON i.id = m.invoice_id AND i.deleted_at IS NULL
       WHERE m.workspace_id = _workspace_id AND m.deleted_at IS NULL
         AND m.invoice_id IS NOT NULL AND i.id IS NULL),
    'assets_inconsistentes', (
      SELECT count(*) FROM public.assets a
       WHERE a.workspace_id = _workspace_id AND a.deleted_at IS NULL
         AND (a.current_value IS NULL OR a.current_value < 0)),
    'investimentos_sem_asset', (
      SELECT count(*) FROM public.movements m
       WHERE m.workspace_id = _workspace_id AND m.deleted_at IS NULL
         AND m.type = 'INVESTMENT' AND m.asset_id IS NULL),
    'transferencias_incompletas', (
      SELECT count(*) FROM public.movements m
       WHERE m.workspace_id = _workspace_id AND m.deleted_at IS NULL
         AND m.type = 'TRANSFER'
         AND (m.account_id IS NULL OR m.transfer_account_id IS NULL)),
    'categorias_invalidas', (
      SELECT count(*) FROM public.movements m
       LEFT JOIN public.subcategories s ON s.id = m.subcategory_id AND s.deleted_at IS NULL
       WHERE m.workspace_id = _workspace_id AND m.deleted_at IS NULL
         AND m.subcategory_id IS NOT NULL
         AND (s.id IS NULL OR s.category_id IS DISTINCT FROM m.category_id)),
    'imports_inconsistentes', (
      SELECT count(*) FROM public.imports im
       WHERE im.workspace_id = _workspace_id
         AND (im.status = 'FAILED' OR im.total_rows IS NULL)),
    'movimentacoes_sem_categoria', (
      SELECT count(*) FROM public.movements m
       WHERE m.workspace_id = _workspace_id AND m.deleted_at IS NULL
         AND m.category_id IS NULL
         AND m.type NOT IN ('TRANSFER','CARD_PAYMENT')),
    'checked_at', to_jsonb(now())
  ) INTO result;

  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION private.recompute_my_card_invoice(_invoice_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION private.recompute_workspace_invoices(_workspace_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
  n integer := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces w
     WHERE w.id = _workspace_id AND w.owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Workspace inacessível';
  END IF;

  FOR r IN SELECT id FROM public.card_invoices
            WHERE workspace_id = _workspace_id AND deleted_at IS NULL LOOP
    PERFORM public.recompute_card_invoice(r.id);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$function$;

-- Public entry points become SECURITY INVOKER wrappers
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$ SELECT private.has_role(_user_id, _role) $$;

CREATE OR REPLACE FUNCTION public.financial_health_check(_workspace_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$ SELECT private.financial_health_check(_workspace_id) $$;

CREATE OR REPLACE FUNCTION public.recompute_my_card_invoice(_invoice_id uuid)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path TO 'public'
AS $$ SELECT private.recompute_my_card_invoice(_invoice_id) $$;

CREATE OR REPLACE FUNCTION public.recompute_workspace_invoices(_workspace_id uuid)
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path TO 'public'
AS $$ SELECT private.recompute_workspace_invoices(_workspace_id) $$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.financial_health_check(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.recompute_my_card_invoice(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.recompute_workspace_invoices(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.financial_health_check(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.recompute_my_card_invoice(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.recompute_workspace_invoices(uuid) TO authenticated, service_role;