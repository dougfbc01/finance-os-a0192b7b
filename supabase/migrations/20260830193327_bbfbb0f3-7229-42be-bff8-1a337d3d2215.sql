CREATE TABLE public.reconciliation_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  movement_a_id uuid NOT NULL REFERENCES public.movements(id) ON DELETE CASCADE,
  movement_b_id uuid NOT NULL REFERENCES public.movements(id) ON DELETE CASCADE,
  decision text NOT NULL DEFAULT 'REJECT',
  source text NOT NULL DEFAULT 'MANUAL',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reconciliation_decisions_decision_check CHECK (decision IN ('MATCH','REJECT')),
  CONSTRAINT reconciliation_decisions_source_check CHECK (source IN ('MANUAL','SYSTEM'))
);

CREATE UNIQUE INDEX reconciliation_decisions_pair_uidx
  ON public.reconciliation_decisions (
    workspace_id,
    LEAST(movement_a_id, movement_b_id),
    GREATEST(movement_a_id, movement_b_id)
  );

CREATE INDEX reconciliation_decisions_workspace_idx
  ON public.reconciliation_decisions (workspace_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reconciliation_decisions TO authenticated;
GRANT ALL ON public.reconciliation_decisions TO service_role;

ALTER TABLE public.reconciliation_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view reconciliation decisions"
  ON public.reconciliation_decisions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));

CREATE POLICY "Owners can create reconciliation decisions"
  ON public.reconciliation_decisions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));

CREATE POLICY "Owners can update reconciliation decisions"
  ON public.reconciliation_decisions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));

CREATE POLICY "Owners can delete reconciliation decisions"
  ON public.reconciliation_decisions FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));

CREATE TRIGGER reconciliation_decisions_set_updated_at
  BEFORE UPDATE ON public.reconciliation_decisions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();