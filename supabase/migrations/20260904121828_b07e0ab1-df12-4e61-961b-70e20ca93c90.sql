CREATE TABLE public.invoice_reconciliation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.card_invoices(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  movement_id uuid REFERENCES public.movements(id) ON DELETE SET NULL,
  related_movement_id uuid REFERENCES public.movements(id) ON DELETE SET NULL,
  action text NOT NULL,
  before_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  source text NOT NULL DEFAULT 'MANUAL',
  idempotency_key text NOT NULL,
  performed_by uuid REFERENCES auth.users(id),
  undone_at timestamptz,
  undone_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoice_reconciliation_actions_action_check CHECK (action IN (
    'LINK_EXISTING_MOVEMENT','SELECT_MATCH_CANDIDATE','CORRECT_AMOUNT','CORRECT_DATE',
    'CORRECT_COMPETENCE','MARK_NOT_SAME_MOVEMENT','IGNORE_DIVERGENCE'
  ))
);

CREATE UNIQUE INDEX invoice_reconciliation_actions_idem_uidx
  ON public.invoice_reconciliation_actions (workspace_id, idempotency_key);
CREATE INDEX invoice_reconciliation_actions_invoice_idx
  ON public.invoice_reconciliation_actions (invoice_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.invoice_reconciliation_actions TO authenticated;
GRANT ALL ON public.invoice_reconciliation_actions TO service_role;

ALTER TABLE public.invoice_reconciliation_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view invoice reconciliation actions"
  ON public.invoice_reconciliation_actions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));

CREATE POLICY "Owners can insert invoice reconciliation actions"
  ON public.invoice_reconciliation_actions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));

CREATE POLICY "Owners can update invoice reconciliation actions"
  ON public.invoice_reconciliation_actions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));

CREATE TRIGGER invoice_reconciliation_actions_set_updated_at
  BEFORE UPDATE ON public.invoice_reconciliation_actions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();