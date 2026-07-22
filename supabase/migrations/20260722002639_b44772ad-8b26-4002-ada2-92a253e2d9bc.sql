
-- Enums
CREATE TYPE public.movement_type AS ENUM (
  'INCOME','EXPENSE','TRANSFER','CARD_PAYMENT',
  'INVESTMENT','DIVIDEND','INTEREST','FEE','TAX','REFUND','ADJUSTMENT'
);
CREATE TYPE public.movement_status AS ENUM ('PENDING','CLEARED','RECONCILED');

-- Tabela central
CREATE TABLE public.movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  transfer_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  subcategory_id UUID REFERENCES public.subcategories(id) ON DELETE SET NULL,
  card_id UUID,
  asset_id UUID,
  import_id UUID,
  transfer_group_id UUID,
  type public.movement_type NOT NULL,
  status public.movement_status NOT NULL DEFAULT 'CLEARED',
  description TEXT NOT NULL DEFAULT '',
  notes TEXT,
  amount NUMERIC(18,2) NOT NULL,
  transaction_date DATE NOT NULL,
  competence_date DATE,
  due_date DATE,
  tags TEXT[] NOT NULL DEFAULT '{}',
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.movements TO authenticated;
GRANT ALL ON public.movements TO service_role;

ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view movements of own workspaces"
  ON public.movements FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = movements.workspace_id AND w.owner_id = auth.uid()));

CREATE POLICY "Owners can insert movements in own workspaces"
  ON public.movements FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = movements.workspace_id AND w.owner_id = auth.uid()));

CREATE POLICY "Owners can update movements of own workspaces"
  ON public.movements FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = movements.workspace_id AND w.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = movements.workspace_id AND w.owner_id = auth.uid()));

CREATE POLICY "Owners can delete movements of own workspaces"
  ON public.movements FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = movements.workspace_id AND w.owner_id = auth.uid()));

CREATE INDEX movements_workspace_date_idx ON public.movements (workspace_id, transaction_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX movements_account_idx ON public.movements (account_id) WHERE deleted_at IS NULL;
CREATE INDEX movements_transfer_account_idx ON public.movements (transfer_account_id) WHERE deleted_at IS NULL;
CREATE INDEX movements_category_idx ON public.movements (category_id) WHERE deleted_at IS NULL;
CREATE INDEX movements_transfer_group_idx ON public.movements (transfer_group_id) WHERE transfer_group_id IS NOT NULL;

CREATE TRIGGER set_movements_updated_at
  BEFORE UPDATE ON public.movements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
