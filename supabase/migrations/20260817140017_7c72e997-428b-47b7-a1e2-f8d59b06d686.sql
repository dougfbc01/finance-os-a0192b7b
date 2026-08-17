CREATE TYPE public.commitment_type AS ENUM ('SUBSCRIPTION','INSTALLMENT','LOAN','FINANCING','FIXED_BILL','OTHER');
CREATE TYPE public.commitment_status AS ENUM ('ACTIVE','SETTLED','CANCELLED','PAUSED');
CREATE TYPE public.commitment_installment_status AS ENUM ('FORECAST','POSTED','PAID','CANCELLED');

CREATE TABLE public.commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  commitment_type public.commitment_type NOT NULL DEFAULT 'INSTALLMENT',
  status public.commitment_status NOT NULL DEFAULT 'ACTIVE',
  total_amount numeric NOT NULL DEFAULT 0,
  installment_amount numeric NOT NULL DEFAULT 0,
  installments_count integer NOT NULL DEFAULT 1,
  due_day integer,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  card_id uuid REFERENCES public.cards(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  subcategory_id uuid REFERENCES public.subcategories(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commitments TO authenticated;
GRANT ALL ON public.commitments TO service_role;
ALTER TABLE public.commitments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commitments_select" ON public.commitments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));
CREATE POLICY "commitments_insert" ON public.commitments FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));
CREATE POLICY "commitments_update" ON public.commitments FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));
CREATE POLICY "commitments_delete" ON public.commitments FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));

CREATE INDEX idx_commitments_ws ON public.commitments(workspace_id) WHERE deleted_at IS NULL;

CREATE TRIGGER commitments_set_updated_at BEFORE UPDATE ON public.commitments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.commitment_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  commitment_id uuid NOT NULL REFERENCES public.commitments(id) ON DELETE CASCADE,
  installment_number integer NOT NULL,
  due_date date NOT NULL,
  competence_date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  status public.commitment_installment_status NOT NULL DEFAULT 'FORECAST',
  movement_id uuid REFERENCES public.movements(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (commitment_id, installment_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commitment_installments TO authenticated;
GRANT ALL ON public.commitment_installments TO service_role;
ALTER TABLE public.commitment_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commitment_installments_select" ON public.commitment_installments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));
CREATE POLICY "commitment_installments_insert" ON public.commitment_installments FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));
CREATE POLICY "commitment_installments_update" ON public.commitment_installments FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));
CREATE POLICY "commitment_installments_delete" ON public.commitment_installments FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));

CREATE INDEX idx_commitment_installments_commitment ON public.commitment_installments(commitment_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_commitment_installments_due ON public.commitment_installments(workspace_id, due_date) WHERE deleted_at IS NULL;

CREATE TRIGGER commitment_installments_set_updated_at BEFORE UPDATE ON public.commitment_installments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();