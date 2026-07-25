
-- ============================================================
-- Cards (cartões de crédito)
-- ============================================================
CREATE TABLE public.cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  parent_card_id UUID REFERENCES public.cards(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  brand TEXT,
  holder_name TEXT,
  last_digits TEXT,
  credit_limit NUMERIC(14,2) NOT NULL DEFAULT 0,
  closing_day SMALLINT NOT NULL CHECK (closing_day BETWEEN 1 AND 31),
  due_day SMALLINT NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  color TEXT NOT NULL DEFAULT '#6366F1',
  notes TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_cards_workspace ON public.cards(workspace_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_cards_workspace_name_unique
  ON public.cards(workspace_id, lower(name))
  WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cards TO authenticated;
GRANT ALL ON public.cards TO service_role;

ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view cards of own workspaces" ON public.cards
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = cards.workspace_id AND w.owner_id = auth.uid()));
CREATE POLICY "Owners can insert cards in own workspaces" ON public.cards
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = cards.workspace_id AND w.owner_id = auth.uid()));
CREATE POLICY "Owners can update cards of own workspaces" ON public.cards
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = cards.workspace_id AND w.owner_id = auth.uid()));
CREATE POLICY "Owners can delete cards of own workspaces" ON public.cards
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = cards.workspace_id AND w.owner_id = auth.uid()));

CREATE TRIGGER trg_cards_updated_at BEFORE UPDATE ON public.cards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Card Invoices (faturas)
-- ============================================================
CREATE TYPE public.card_invoice_status AS ENUM ('OPEN','CLOSED','PAID','OVERDUE');

CREATE TABLE public.card_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  competence DATE NOT NULL, -- sempre o primeiro dia do mês da fatura
  closing_date DATE NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0, -- soma das compras, recalculada
  status public.card_invoice_status NOT NULL DEFAULT 'OPEN',
  paid_at DATE,
  paid_movement_id UUID REFERENCES public.movements(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_card_invoices_workspace ON public.card_invoices(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_card_invoices_card ON public.card_invoices(card_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_card_invoices_card_competence_unique
  ON public.card_invoices(card_id, competence)
  WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_invoices TO authenticated;
GRANT ALL ON public.card_invoices TO service_role;

ALTER TABLE public.card_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view invoices of own workspaces" ON public.card_invoices
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = card_invoices.workspace_id AND w.owner_id = auth.uid()));
CREATE POLICY "Owners can insert invoices in own workspaces" ON public.card_invoices
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = card_invoices.workspace_id AND w.owner_id = auth.uid()));
CREATE POLICY "Owners can update invoices of own workspaces" ON public.card_invoices
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = card_invoices.workspace_id AND w.owner_id = auth.uid()));
CREATE POLICY "Owners can delete invoices of own workspaces" ON public.card_invoices
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = card_invoices.workspace_id AND w.owner_id = auth.uid()));

CREATE TRIGGER trg_card_invoices_updated_at BEFORE UPDATE ON public.card_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Movements: vincular movimentação a uma fatura
-- ============================================================
ALTER TABLE public.movements
  ADD COLUMN invoice_id UUID REFERENCES public.card_invoices(id) ON DELETE SET NULL;

CREATE INDEX idx_movements_invoice ON public.movements(invoice_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_movements_card ON public.movements(card_id) WHERE deleted_at IS NULL;
