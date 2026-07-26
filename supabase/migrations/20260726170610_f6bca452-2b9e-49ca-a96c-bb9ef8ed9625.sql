-- Enum
DO $$ BEGIN
  CREATE TYPE public.asset_type AS ENUM (
    'BANK','CASH','CDB','TESOURO','LCI','LCA','DEBENTURE',
    'ACAO','FII','ETF','BDR','CRIPTO','PREVIDENCIA','FUNDO','CAIXINHA','OUTRO'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table
CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  asset_type public.asset_type NOT NULL,
  institution TEXT,
  currency TEXT NOT NULL DEFAULT 'BRL',
  quantity NUMERIC(20,8) NOT NULL DEFAULT 0,
  unit_price NUMERIC(20,8) NOT NULL DEFAULT 0,
  current_value NUMERIC(20,2) NOT NULL DEFAULT 0,
  acquisition_value NUMERIC(20,2) NOT NULL DEFAULT 0,
  acquisition_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX assets_workspace_idx ON public.assets(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX assets_type_idx ON public.assets(workspace_id, asset_type) WHERE deleted_at IS NULL;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;
GRANT ALL ON public.assets TO service_role;

-- RLS
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assets_select_own" ON public.assets
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));

CREATE POLICY "assets_insert_own" ON public.assets
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));

CREATE POLICY "assets_update_own" ON public.assets
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));

CREATE POLICY "assets_delete_own" ON public.assets
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));

-- updated_at trigger
CREATE TRIGGER assets_set_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();