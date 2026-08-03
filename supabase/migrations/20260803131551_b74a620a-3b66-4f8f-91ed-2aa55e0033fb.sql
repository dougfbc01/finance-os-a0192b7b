CREATE TABLE public.dedup_audits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  original_movement_id UUID REFERENCES public.movements(id) ON DELETE SET NULL,
  incoming_movement_id UUID REFERENCES public.movements(id) ON DELETE SET NULL,
  incoming_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  original_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence_match NUMERIC NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT '',
  changed_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  performed_by UUID,
  source TEXT NOT NULL DEFAULT 'SYSTEM',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dedup_audits TO authenticated;
GRANT ALL ON public.dedup_audits TO service_role;

ALTER TABLE public.dedup_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage dedup audits in their workspaces"
ON public.dedup_audits FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = dedup_audits.workspace_id AND w.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = dedup_audits.workspace_id AND w.owner_id = auth.uid()));

CREATE INDEX idx_dedup_audits_workspace ON public.dedup_audits (workspace_id, created_at DESC);

CREATE TRIGGER update_dedup_audits_updated_at
BEFORE UPDATE ON public.dedup_audits
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();