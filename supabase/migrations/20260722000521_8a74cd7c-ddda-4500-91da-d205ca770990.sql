-- Enum de tipos de conta financeira
CREATE TYPE public.account_type AS ENUM (
  'CHECKING',
  'SAVINGS',
  'DIGITAL',
  'WALLET',
  'BROKER',
  'CASH',
  'INTERNATIONAL',
  'OTHER'
);

-- Tabela accounts
CREATE TABLE public.accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  institution TEXT,
  account_type public.account_type NOT NULL DEFAULT 'CHECKING',
  currency TEXT NOT NULL DEFAULT 'BRL',
  initial_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#7C3AED',
  icon TEXT NOT NULL DEFAULT 'wallet',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Índice único para impedir nomes duplicados de contas ativas no mesmo workspace
CREATE UNIQUE INDEX accounts_workspace_name_active_unique
  ON public.accounts (workspace_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE INDEX accounts_workspace_id_idx ON public.accounts (workspace_id);
CREATE INDEX accounts_display_order_idx ON public.accounts (workspace_id, display_order);

-- GRANTs (obrigatório no schema public)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;

-- RLS
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- Policies: apenas o dono do workspace tem acesso
CREATE POLICY "Owners can view accounts of own workspaces"
  ON public.accounts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = accounts.workspace_id
        AND w.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owners can insert accounts in own workspaces"
  ON public.accounts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = accounts.workspace_id
        AND w.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owners can update accounts of own workspaces"
  ON public.accounts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = accounts.workspace_id
        AND w.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = accounts.workspace_id
        AND w.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owners can delete accounts of own workspaces"
  ON public.accounts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = accounts.workspace_id
        AND w.owner_id = auth.uid()
    )
  );

-- Trigger para manter updated_at
CREATE TRIGGER accounts_set_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
