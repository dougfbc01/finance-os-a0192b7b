CREATE TYPE public.financial_goal_type AS ENUM ('EMERGENCY_RESERVE','PURCHASE','TRAVEL','INVESTMENT','PATRIMONY','CUSTOM');
CREATE TYPE public.financial_goal_status AS ENUM ('ACTIVE','COMPLETED','PAUSED','CANCELLED');

CREATE TABLE public.financial_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  goal_type public.financial_goal_type NOT NULL DEFAULT 'CUSTOM',
  target_amount numeric NOT NULL DEFAULT 0,
  initial_amount numeric NOT NULL DEFAULT 0,
  target_date date,
  status public.financial_goal_status NOT NULL DEFAULT 'ACTIVE',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_goals TO authenticated;
GRANT ALL ON public.financial_goals TO service_role;
ALTER TABLE public.financial_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financial_goals_select" ON public.financial_goals FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));
CREATE POLICY "financial_goals_insert" ON public.financial_goals FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));
CREATE POLICY "financial_goals_update" ON public.financial_goals FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));
CREATE POLICY "financial_goals_delete" ON public.financial_goals FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));

CREATE INDEX idx_financial_goals_ws ON public.financial_goals(workspace_id) WHERE deleted_at IS NULL;

CREATE TRIGGER financial_goals_set_updated_at BEFORE UPDATE ON public.financial_goals
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.financial_goal_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES public.financial_goals(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  contribution_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_goal_contributions TO authenticated;
GRANT ALL ON public.financial_goal_contributions TO service_role;
ALTER TABLE public.financial_goal_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goal_contributions_select" ON public.financial_goal_contributions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));
CREATE POLICY "goal_contributions_insert" ON public.financial_goal_contributions FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));
CREATE POLICY "goal_contributions_update" ON public.financial_goal_contributions FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));
CREATE POLICY "goal_contributions_delete" ON public.financial_goal_contributions FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));

CREATE INDEX idx_goal_contributions_goal ON public.financial_goal_contributions(goal_id) WHERE deleted_at IS NULL;

CREATE TRIGGER goal_contributions_set_updated_at BEFORE UPDATE ON public.financial_goal_contributions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();