ALTER TABLE public.reconciliation_decisions
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'MOVEMENT_DUPLICATE';

ALTER TABLE public.reconciliation_decisions
  DROP CONSTRAINT IF EXISTS reconciliation_decisions_kind_check;

ALTER TABLE public.reconciliation_decisions
  ADD CONSTRAINT reconciliation_decisions_kind_check
  CHECK (kind = ANY (ARRAY['MOVEMENT_DUPLICATE'::text, 'TRANSFER_MATCH'::text]));

DROP INDEX IF EXISTS public.reconciliation_decisions_pair_uidx;

CREATE UNIQUE INDEX reconciliation_decisions_pair_kind_uidx
  ON public.reconciliation_decisions
  USING btree (workspace_id, kind, LEAST(movement_a_id, movement_b_id), GREATEST(movement_a_id, movement_b_id));