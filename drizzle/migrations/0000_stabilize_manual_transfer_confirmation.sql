CREATE OR REPLACE FUNCTION public.confirm_transfer_pair(_workspace_id uuid, _outflow_id uuid, _inflow_id uuid, _outflow_updated_at timestamptz, _inflow_updated_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE o public.movements%ROWTYPE; i public.movements%ROWTYPE; g uuid; existing_decision text;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.workspaces WHERE id = _workspace_id AND owner_id = auth.uid() AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Workspace inacessível'; END IF;
  IF _outflow_id = _inflow_id THEN RAISE EXCEPTION 'Selecione dois lançamentos distintos'; END IF;
  PERFORM id FROM public.movements WHERE id IN (_outflow_id, _inflow_id) ORDER BY id FOR UPDATE;
  SELECT * INTO o FROM public.movements WHERE id = _outflow_id AND workspace_id = _workspace_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Saída indisponível'; END IF;
  SELECT * INTO i FROM public.movements WHERE id = _inflow_id AND workspace_id = _workspace_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entrada indisponível'; END IF;
  SELECT decision INTO existing_decision FROM public.reconciliation_decisions WHERE workspace_id = _workspace_id AND kind = 'TRANSFER_MATCH' AND LEAST(movement_a_id, movement_b_id) = LEAST(o.id, i.id) AND GREATEST(movement_a_id, movement_b_id) = GREATEST(o.id, i.id);
  IF existing_decision = 'REJECT' THEN RAISE EXCEPTION 'Par rejeitado manualmente'; END IF;
  IF existing_decision = 'MATCH' AND o.type = 'TRANSFER' AND i.type = 'TRANSFER' AND o.transfer_group_id = i.transfer_group_id AND o.transfer_account_id = i.account_id AND i.transfer_account_id IS NULL THEN RETURN; END IF;
  IF o.updated_at IS DISTINCT FROM _outflow_updated_at OR i.updated_at IS DISTINCT FROM _inflow_updated_at THEN RAISE EXCEPTION 'Lançamentos alterados; atualize a revisão'; END IF;
  IF o.is_historical OR i.is_historical OR o.card_id IS NOT NULL OR i.card_id IS NOT NULL OR o.invoice_id IS NOT NULL OR i.invoice_id IS NOT NULL OR o.account_id IS NULL OR i.account_id IS NULL OR o.account_id = i.account_id OR abs(o.amount - i.amount) >= 0.005 OR abs(o.transaction_date - i.transaction_date) > 3 THEN RAISE EXCEPTION 'Par incompatível'; END IF;
  IF o.type NOT IN ('EXPENSE','FEE','TAX','TRANSFER') OR i.type NOT IN ('INCOME','DIVIDEND','INTEREST','REFUND') THEN RAISE EXCEPTION 'Direções incompatíveis'; END IF;
  IF o.type = 'TRANSFER' AND o.transfer_account_id IS DISTINCT FROM i.account_id THEN RAISE EXCEPTION 'Destino incompatível'; END IF;
  IF i.transfer_group_id IS NOT NULL OR (o.transfer_group_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.movements WHERE transfer_group_id = o.transfer_group_id AND id <> o.id AND deleted_at IS NULL)) THEN RAISE EXCEPTION 'Transferência já vinculada'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE id=o.account_id AND workspace_id=_workspace_id AND deleted_at IS NULL) OR NOT EXISTS (SELECT 1 FROM public.accounts WHERE id=i.account_id AND workspace_id=_workspace_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Contas indisponíveis'; END IF;
  g := COALESCE(o.transfer_group_id, gen_random_uuid());
  UPDATE public.movements SET type='TRANSFER', transfer_account_id=i.account_id, transfer_group_id=g, category_id=NULL, subcategory_id=NULL, status='RECONCILED' WHERE id=o.id;
  UPDATE public.movements SET type='TRANSFER', transfer_account_id=NULL, transfer_group_id=g, category_id=NULL, subcategory_id=NULL, status='RECONCILED' WHERE id=i.id;
  INSERT INTO public.reconciliation_decisions(workspace_id,movement_a_id,movement_b_id,decision,kind,source) VALUES (_workspace_id,LEAST(o.id,i.id),GREATEST(o.id,i.id),'MATCH','TRANSFER_MATCH','MANUAL');
END $$;
REVOKE ALL ON FUNCTION public.confirm_transfer_pair(uuid,uuid,uuid,timestamptz,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_transfer_pair(uuid,uuid,uuid,timestamptz,timestamptz) TO authenticated;