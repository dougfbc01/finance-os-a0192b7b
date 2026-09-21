ALTER TYPE public.import_source ADD VALUE IF NOT EXISTS 'B3';

ALTER TABLE public.imports
  ADD COLUMN IF NOT EXISTS batch_ref TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS imports_workspace_batch_ref_unique
  ON public.imports(workspace_id, batch_ref)
  WHERE batch_ref IS NOT NULL;

CREATE TABLE public.b3_import_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID NOT NULL REFERENCES public.imports(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL,
  raw_row JSONB NOT NULL,
  fingerprint TEXT NOT NULL,
  original_type TEXT NOT NULL,
  event TEXT NOT NULL,
  event_group TEXT NOT NULL,
  ticker TEXT,
  institution TEXT,
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  movement_id UUID REFERENCES public.movements(id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT b3_import_items_status_check CHECK (status IN ('IMPORTED','ALREADY_IMPORTED','PENDING_REVIEW','ERROR')),
  CONSTRAINT b3_import_items_workspace_fingerprint_unique UNIQUE (workspace_id, fingerprint)
);

GRANT SELECT, INSERT, UPDATE ON public.b3_import_items TO authenticated;
GRANT ALL ON public.b3_import_items TO service_role;

ALTER TABLE public.b3_import_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view B3 import items of own workspaces"
  ON public.b3_import_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = b3_import_items.workspace_id
      AND w.owner_id = auth.uid()
      AND w.deleted_at IS NULL
  ));

CREATE POLICY "Owners can create B3 import items in own workspaces"
  ON public.b3_import_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = b3_import_items.workspace_id
      AND w.owner_id = auth.uid()
      AND w.deleted_at IS NULL
  ));

CREATE POLICY "Owners can update B3 import items of own workspaces"
  ON public.b3_import_items FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = b3_import_items.workspace_id
      AND w.owner_id = auth.uid()
      AND w.deleted_at IS NULL
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = b3_import_items.workspace_id
      AND w.owner_id = auth.uid()
      AND w.deleted_at IS NULL
  ));

CREATE INDEX b3_import_items_import_idx ON public.b3_import_items(import_id, row_index);
CREATE INDEX b3_import_items_asset_idx ON public.b3_import_items(asset_id, created_at DESC);

CREATE TRIGGER b3_import_items_set_updated_at
  BEFORE UPDATE ON public.b3_import_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();