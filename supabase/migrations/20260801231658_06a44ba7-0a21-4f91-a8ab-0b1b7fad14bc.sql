ALTER TABLE public.health_check_runs
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'SUCCESS',
  ADD COLUMN IF NOT EXISTS duration_ms integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_message text;

ALTER TABLE public.health_check_runs
  DROP CONSTRAINT IF EXISTS health_check_runs_status_check;

ALTER TABLE public.health_check_runs
  ADD CONSTRAINT health_check_runs_status_check CHECK (status IN ('SUCCESS','FAILED'));

CREATE INDEX IF NOT EXISTS health_check_runs_ws_created_idx
  ON public.health_check_runs (workspace_id, created_at DESC);