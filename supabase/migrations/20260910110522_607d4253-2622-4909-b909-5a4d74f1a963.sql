ALTER TABLE public.invoice_reconciliation_actions
  DROP CONSTRAINT IF EXISTS invoice_reconciliation_actions_action_check;

ALTER TABLE public.invoice_reconciliation_actions
  ADD CONSTRAINT invoice_reconciliation_actions_action_check
  CHECK (action = ANY (ARRAY[
    'LINK_EXISTING_MOVEMENT'::text,
    'SELECT_MATCH_CANDIDATE'::text,
    'CORRECT_AMOUNT'::text,
    'CORRECT_DATE'::text,
    'CORRECT_COMPETENCE'::text,
    'MARK_NOT_SAME_MOVEMENT'::text,
    'IGNORE_DIVERGENCE'::text,
    'CREATE_MISSING_MOVEMENT'::text,
    'MOVE_TO_ANOTHER_INVOICE'::text
  ]));