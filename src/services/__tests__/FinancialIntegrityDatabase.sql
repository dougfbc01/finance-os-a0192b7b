-- Integration regressions: run with psql -X -v ON_ERROR_STOP=1 -f this file.
-- Every fixture and mutation is rolled back; existing financial data is untouched.
BEGIN;
SELECT set_config('request.jwt.claim.sub', owner_id::text, true)
FROM public.workspaces WHERE deleted_at IS NULL LIMIT 1;
INSERT INTO public.workspaces(owner_id, name)
VALUES (auth.uid(), 'financial-integrity-transaction-test');
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  ws uuid; a uuid; b uuid; c uuid; o uuid; i uuid; other uuid;
  ot timestamptz; it timestamptz; group_before uuid; card uuid; inv uuid;
  actual numeric; decision_count integer; rejected boolean;
BEGIN
  SELECT id INTO ws FROM public.workspaces WHERE name='financial-integrity-transaction-test' AND owner_id=auth.uid();
  INSERT INTO public.accounts(workspace_id,name) VALUES(ws,'Test origin') RETURNING id INTO a;
  INSERT INTO public.accounts(workspace_id,name) VALUES(ws,'Test destination') RETURNING id INTO b;
  INSERT INTO public.accounts(workspace_id,name) VALUES(ws,'Test wrong destination') RETURNING id INTO c;
  INSERT INTO public.movements(workspace_id,account_id,type,description,amount,transaction_date)
  VALUES(ws,a,'EXPENSE','Test out',500,'2026-10-01') RETURNING id,updated_at INTO o,ot;
  INSERT INTO public.movements(workspace_id,account_id,type,description,amount,transaction_date)
  VALUES(ws,b,'INCOME','Test in',500,'2026-10-01') RETURNING id,updated_at INTO i,it;
  PERFORM public.confirm_transfer_pair(ws,o,i,ot,it);
  IF NOT EXISTS(SELECT 1 FROM public.movements x JOIN public.movements y ON y.transfer_group_id=x.transfer_group_id
    WHERE x.id=o AND y.id=i AND x.type='TRANSFER' AND y.type='TRANSFER' AND x.transfer_account_id=b AND y.transfer_account_id IS NULL)
  THEN RAISE EXCEPTION 'FAIL: two legs were not linked'; END IF;
  SELECT count(*) INTO decision_count FROM public.reconciliation_decisions WHERE workspace_id=ws AND kind='TRANSFER_MATCH';
  IF decision_count<>1 THEN RAISE EXCEPTION 'FAIL: MATCH not persisted'; END IF;
  PERFORM public.confirm_transfer_pair(ws,o,i,ot,it);
  IF (SELECT count(*) FROM public.reconciliation_decisions WHERE workspace_id=ws AND kind='TRANSFER_MATCH')<>1
  THEN RAISE EXCEPTION 'FAIL: repeated confirmation duplicated decision'; END IF;
  RAISE NOTICE 'PASS: confirmation and retry are atomic and idempotent';

  INSERT INTO public.movements(workspace_id,account_id,type,description,amount,transaction_date)
  VALUES(ws,b,'INCOME','Third leg',500,'2026-10-01') RETURNING id,updated_at INTO other,it;
  SELECT updated_at INTO ot FROM public.movements WHERE id=o;
  rejected:=false;
  BEGIN PERFORM public.confirm_transfer_pair(ws,o,other,ot,it);
  EXCEPTION WHEN OTHERS THEN rejected:=true; END;
  IF NOT rejected OR (SELECT type FROM public.movements WHERE id=other)<>'INCOME'
  THEN RAISE EXCEPTION 'FAIL: full group gained a third leg'; END IF;
  RAISE NOTICE 'PASS: full groups reject third legs without partial writes';

  group_before:=gen_random_uuid();
  INSERT INTO public.movements(workspace_id,account_id,transfer_account_id,transfer_group_id,type,description,amount,transaction_date)
  VALUES(ws,a,b,group_before,'TRANSFER','Existing transfer',700,'2026-10-02') RETURNING id,updated_at INTO o,ot;
  INSERT INTO public.movements(workspace_id,account_id,type,description,amount,transaction_date)
  VALUES(ws,c,'INCOME','Wrong destination',700,'2026-10-02') RETURNING id,updated_at INTO i,it;
  rejected:=false;
  BEGIN PERFORM public.confirm_transfer_pair(ws,o,i,ot,it);
  EXCEPTION WHEN OTHERS THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'FAIL: wrong destination allowed'; END IF;
  UPDATE public.movements SET account_id=b WHERE id=i RETURNING updated_at INTO it;
  PERFORM public.confirm_transfer_pair(ws,o,i,ot,it);
  IF (SELECT transfer_group_id FROM public.movements WHERE id=i)<>group_before
  THEN RAISE EXCEPTION 'FAIL: existing group replaced'; END IF;
  RAISE NOTICE 'PASS: reimport preserves existing group and validates destination';

  INSERT INTO public.movements(workspace_id,account_id,type,description,amount,transaction_date)
  VALUES(ws,a,'EXPENSE','Rejected out',800,'2026-10-03') RETURNING id,updated_at INTO o,ot;
  INSERT INTO public.movements(workspace_id,account_id,type,description,amount,transaction_date)
  VALUES(ws,b,'INCOME','Rejected in',800,'2026-10-03') RETURNING id,updated_at INTO i,it;
  INSERT INTO public.reconciliation_decisions(workspace_id,movement_a_id,movement_b_id,kind,decision,source)
  VALUES(ws,least(o,i),greatest(o,i),'TRANSFER_MATCH','REJECT','MANUAL');
  rejected:=false;
  BEGIN PERFORM public.confirm_transfer_pair(ws,o,i,ot,it);
  EXCEPTION WHEN OTHERS THEN rejected:=true; END;
  IF NOT rejected OR (SELECT type FROM public.movements WHERE id=o)<>'EXPENSE'
  THEN RAISE EXCEPTION 'FAIL: manual rejection overwritten'; END IF;
  RAISE NOTICE 'PASS: rejection keeps original movements unchanged';

  INSERT INTO public.movements(workspace_id,account_id,type,description,amount,transaction_date)
  VALUES(ws,a,'EXPENSE','Stale out',900,'2026-10-04') RETURNING id,updated_at INTO o,ot;
  INSERT INTO public.movements(workspace_id,account_id,type,description,amount,transaction_date)
  VALUES(ws,b,'INCOME','Stale in',900,'2026-10-04') RETURNING id,updated_at INTO i,it;
  rejected:=false;
  BEGIN PERFORM public.confirm_transfer_pair(ws,o,i,ot-interval '1 second',it);
  EXCEPTION WHEN OTHERS THEN rejected:=true; END;
  IF NOT rejected OR (SELECT type FROM public.movements WHERE id=o)<>'EXPENSE'
  THEN RAISE EXCEPTION 'FAIL: stale version accepted'; END IF;
  RAISE NOTICE 'PASS: stale confirmations rejected without partial writes';

  INSERT INTO public.cards(workspace_id,name,closing_day,due_day) VALUES(ws,'Test card',20,28) RETURNING id INTO card;
  INSERT INTO public.card_invoices(workspace_id,card_id,competence,closing_date,due_date)
  VALUES(ws,card,'2026-10-01','2026-10-20','2026-10-28') RETURNING id INTO inv;
  INSERT INTO public.movements(workspace_id,card_id,invoice_id,type,description,amount,transaction_date) VALUES
    (ws,card,inv,'EXPENSE','Purchase',100,'2026-10-01'),
    (ws,card,inv,'FEE','Fee',10,'2026-10-01'),
    (ws,card,inv,'TAX','Tax',5,'2026-10-01'),
    (ws,card,inv,'REFUND','Refund',20,'2026-10-01'),
    (ws,card,inv,'CARD_PAYMENT','Payment representation',95,'2026-10-01');
  SELECT amount INTO actual FROM public.card_invoices WHERE id=inv;
  IF actual<>95 THEN RAISE EXCEPTION 'FAIL: invoice amount %, expected 95',actual; END IF;
  IF (public.financial_health_check(ws)->>'invoices_divergentes')::integer<>0
  THEN RAISE EXCEPTION 'FAIL: diagnostic disagrees with invoice totals'; END IF;
  IF (public.financial_health_check(ws)->>'transferencias_incompletas')::integer<>0
  THEN RAISE EXCEPTION 'FAIL: valid mirror falsely flagged'; END IF;
  RAISE NOTICE 'PASS: invoice includes charges/refunds, excludes payments, and health agrees';
END $$;
RESET ROLE;
ROLLBACK;