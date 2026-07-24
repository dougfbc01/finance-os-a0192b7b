-- Classification rules: aplicadas automaticamente em importações e no MovementService.
CREATE TABLE public.classification_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  text_pattern TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  subcategory_id UUID REFERENCES public.subcategories(id) ON DELETE SET NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  enabled BOOLEAN NOT NULL DEFAULT true,
  match_count INTEGER NOT NULL DEFAULT 0,
  last_matched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.classification_rules TO authenticated;
GRANT ALL ON public.classification_rules TO service_role;

ALTER TABLE public.classification_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view rules of own workspaces" ON public.classification_rules
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = classification_rules.workspace_id AND w.owner_id = auth.uid()));
CREATE POLICY "Owners can insert rules in own workspaces" ON public.classification_rules
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = classification_rules.workspace_id AND w.owner_id = auth.uid()));
CREATE POLICY "Owners can update rules of own workspaces" ON public.classification_rules
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = classification_rules.workspace_id AND w.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = classification_rules.workspace_id AND w.owner_id = auth.uid()));
CREATE POLICY "Owners can delete rules of own workspaces" ON public.classification_rules
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = classification_rules.workspace_id AND w.owner_id = auth.uid()));

CREATE INDEX classification_rules_workspace_idx
  ON public.classification_rules(workspace_id, priority DESC)
  WHERE deleted_at IS NULL AND enabled = true;

CREATE UNIQUE INDEX classification_rules_pattern_unique
  ON public.classification_rules(workspace_id, lower(text_pattern))
  WHERE deleted_at IS NULL;

CREATE TRIGGER classification_rules_set_updated_at
  BEFORE UPDATE ON public.classification_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
