CREATE TABLE public.monthly_budgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','CLOSED')),
  mode TEXT NOT NULL DEFAULT 'SIMPLE' CHECK (mode IN ('SIMPLE','ADVANCED')),
  name TEXT NOT NULL DEFAULT 'Planejamento',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_budgets TO authenticated;
GRANT ALL ON public.monthly_budgets TO service_role;
ALTER TABLE public.monthly_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners select budgets" ON public.monthly_budgets FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));
CREATE POLICY "Owners insert budgets" ON public.monthly_budgets FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));
CREATE POLICY "Owners update budgets" ON public.monthly_budgets FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));
CREATE POLICY "Owners delete budgets" ON public.monthly_budgets FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));

CREATE INDEX idx_monthly_budgets_ws_period ON public.monthly_budgets (workspace_id, year, month);
CREATE UNIQUE INDEX uq_monthly_budgets_active_period ON public.monthly_budgets (workspace_id, year, month)
  WHERE deleted_at IS NULL AND status = 'ACTIVE';

CREATE TRIGGER monthly_budgets_set_updated_at BEFORE UPDATE ON public.monthly_budgets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.monthly_budget_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id UUID NOT NULL REFERENCES public.monthly_budgets(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id),
  subcategory_id UUID REFERENCES public.subcategories(id),
  planned_amount NUMERIC NOT NULL DEFAULT 0 CHECK (planned_amount >= 0),
  goal_kind TEXT CHECK (goal_kind IN ('SAVINGS','INVESTMENT','NET_WORTH','RESERVE')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_budget_items TO authenticated;
GRANT ALL ON public.monthly_budget_items TO service_role;
ALTER TABLE public.monthly_budget_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners select budget items" ON public.monthly_budget_items FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));
CREATE POLICY "Owners insert budget items" ON public.monthly_budget_items FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));
CREATE POLICY "Owners update budget items" ON public.monthly_budget_items FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));
CREATE POLICY "Owners delete budget items" ON public.monthly_budget_items FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));

CREATE INDEX idx_monthly_budget_items_budget ON public.monthly_budget_items (budget_id);
CREATE UNIQUE INDEX uq_monthly_budget_items_target ON public.monthly_budget_items
  (budget_id, category_id, COALESCE(subcategory_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE deleted_at IS NULL;

CREATE TRIGGER monthly_budget_items_set_updated_at BEFORE UPDATE ON public.monthly_budget_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();