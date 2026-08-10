CREATE TABLE public.financial_goal_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES public.financial_goals(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (goal_id, account_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_goal_accounts TO authenticated;
GRANT ALL ON public.financial_goal_accounts TO service_role;

ALTER TABLE public.financial_goal_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view goal accounts"
  ON public.financial_goal_accounts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));

CREATE POLICY "Owners can insert goal accounts"
  ON public.financial_goal_accounts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));

CREATE POLICY "Owners can update goal accounts"
  ON public.financial_goal_accounts FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));

CREATE POLICY "Owners can delete goal accounts"
  ON public.financial_goal_accounts FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));

CREATE INDEX idx_financial_goal_accounts_goal ON public.financial_goal_accounts(goal_id);
CREATE INDEX idx_financial_goal_accounts_ws ON public.financial_goal_accounts(workspace_id);

CREATE TRIGGER financial_goal_accounts_set_updated_at
  BEFORE UPDATE ON public.financial_goal_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();