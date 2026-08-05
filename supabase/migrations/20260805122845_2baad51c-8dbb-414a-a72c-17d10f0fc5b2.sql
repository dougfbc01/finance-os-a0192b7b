CREATE TABLE public.monthly_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  year integer NOT NULL,
  month smallint NOT NULL CHECK (month BETWEEN 1 AND 12),
  status text NOT NULL DEFAULT 'CLOSED' CHECK (status IN ('OPEN','CLOSED','LOCKED')),
  closed_at timestamptz,
  closed_by uuid,
  reopened_at timestamptz,
  reopened_by uuid,
  reopen_reason text,
  notes text,
  snapshot_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_closings TO authenticated;
GRANT ALL ON public.monthly_closings TO service_role;

ALTER TABLE public.monthly_closings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their closings" ON public.monthly_closings
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));

CREATE POLICY "Owners can insert their closings" ON public.monthly_closings
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));

CREATE POLICY "Owners can update their closings" ON public.monthly_closings
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));

CREATE POLICY "Owners can delete their closings" ON public.monthly_closings
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));

CREATE UNIQUE INDEX monthly_closings_ws_period_uniq
  ON public.monthly_closings (workspace_id, year, month)
  WHERE deleted_at IS NULL;

CREATE INDEX monthly_closings_ws_idx ON public.monthly_closings (workspace_id, year DESC, month DESC);

CREATE TRIGGER monthly_closings_set_updated_at
  BEFORE UPDATE ON public.monthly_closings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.monthly_closing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_id uuid NOT NULL REFERENCES public.monthly_closings(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  event text NOT NULL CHECK (event IN ('CLOSED','REOPENED','RECLOSED')),
  reason text,
  performed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.monthly_closing_events TO authenticated;
GRANT ALL ON public.monthly_closing_events TO service_role;

ALTER TABLE public.monthly_closing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their closing events" ON public.monthly_closing_events
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));

CREATE POLICY "Owners can insert their closing events" ON public.monthly_closing_events
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));

CREATE INDEX monthly_closing_events_closing_idx ON public.monthly_closing_events (closing_id, created_at DESC);

CREATE TRIGGER monthly_closing_events_set_updated_at
  BEFORE UPDATE ON public.monthly_closing_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();