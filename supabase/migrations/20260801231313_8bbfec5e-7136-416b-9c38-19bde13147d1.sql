CREATE TABLE public.health_check_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  frequency TEXT NOT NULL DEFAULT 'DAILY' CHECK (frequency IN ('DAILY','WEEKLY')),
  hour_utc SMALLINT NOT NULL DEFAULT 9 CHECK (hour_utc BETWEEN 0 AND 23),
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_check_schedules TO authenticated;
GRANT ALL ON public.health_check_schedules TO service_role;
ALTER TABLE public.health_check_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage schedules of their workspaces"
ON public.health_check_schedules FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));

CREATE TABLE public.health_check_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  issues INTEGER NOT NULL DEFAULT 0,
  report JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL DEFAULT 'SCHEDULED',
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX health_check_runs_ws_created_idx ON public.health_check_runs (workspace_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_check_runs TO authenticated;
GRANT ALL ON public.health_check_runs TO service_role;
ALTER TABLE public.health_check_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage runs of their workspaces"
ON public.health_check_runs FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_health_check_schedules_updated_at
BEFORE UPDATE ON public.health_check_schedules
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER update_health_check_runs_updated_at
BEFORE UPDATE ON public.health_check_runs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();