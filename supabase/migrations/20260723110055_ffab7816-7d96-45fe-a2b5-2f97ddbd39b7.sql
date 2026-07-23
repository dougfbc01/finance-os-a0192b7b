
DO $$ BEGIN
  CREATE TYPE public.import_source AS ENUM ('NUBANK_ACCOUNT','NUBANK_CREDIT_CARD','OFX','MANUAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.import_status AS ENUM ('PENDING','PROCESSING','COMPLETED','FAILED','PARTIAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  source public.import_source NOT NULL,
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  imported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_rows INT NOT NULL DEFAULT 0,
  imported_rows INT NOT NULL DEFAULT 0,
  ignored_rows INT NOT NULL DEFAULT 0,
  duplicated_rows INT NOT NULL DEFAULT 0,
  status public.import_status NOT NULL DEFAULT 'PENDING',
  log JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS imports_workspace_idx ON public.imports(workspace_id, imported_at DESC);
CREATE INDEX IF NOT EXISTS imports_hash_idx ON public.imports(workspace_id, file_hash);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imports TO authenticated;
GRANT ALL ON public.imports TO service_role;

ALTER TABLE public.imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view imports of own workspaces" ON public.imports FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = imports.workspace_id AND w.owner_id = auth.uid()));
CREATE POLICY "Owners can insert imports in own workspaces" ON public.imports FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = imports.workspace_id AND w.owner_id = auth.uid()));
CREATE POLICY "Owners can update imports of own workspaces" ON public.imports FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = imports.workspace_id AND w.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = imports.workspace_id AND w.owner_id = auth.uid()));
CREATE POLICY "Owners can delete imports of own workspaces" ON public.imports FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = imports.workspace_id AND w.owner_id = auth.uid()));

CREATE TRIGGER set_imports_updated_at BEFORE UPDATE ON public.imports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.movements
  ADD COLUMN IF NOT EXISTS duplicate_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS movements_workspace_duphash_unique
  ON public.movements(workspace_id, duplicate_hash)
  WHERE duplicate_hash IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE public.movements
  ADD CONSTRAINT movements_import_id_fkey FOREIGN KEY (import_id)
  REFERENCES public.imports(id) ON DELETE SET NULL;
