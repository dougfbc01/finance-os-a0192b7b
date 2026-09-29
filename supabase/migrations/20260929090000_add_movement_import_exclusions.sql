CREATE TABLE public.movement_import_exclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  duplicate_hash text NOT NULL,
  movement_id uuid REFERENCES public.movements(id) ON DELETE SET NULL,
  reason text NOT NULL DEFAULT 'MOVEMENT_SOFT_DELETE',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, duplicate_hash)
);

CREATE INDEX idx_movement_import_exclusions_workspace
  ON public.movement_import_exclusions(workspace_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.movement_import_exclusions TO authenticated;
GRANT ALL ON public.movement_import_exclusions TO service_role;

ALTER TABLE public.movement_import_exclusions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view movement import exclusions"
  ON public.movement_import_exclusions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));
CREATE POLICY "Owners can create movement import exclusions"
  ON public.movement_import_exclusions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));
CREATE POLICY "Owners can update movement import exclusions"
  ON public.movement_import_exclusions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));
CREATE POLICY "Owners can delete movement import exclusions"
  ON public.movement_import_exclusions FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));
