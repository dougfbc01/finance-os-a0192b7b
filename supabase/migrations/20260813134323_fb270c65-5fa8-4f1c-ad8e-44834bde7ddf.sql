ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS valuation_source text NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS opening_value numeric NOT NULL DEFAULT 0;

ALTER TABLE public.assets
  DROP CONSTRAINT IF EXISTS assets_valuation_source_check;

ALTER TABLE public.assets
  ADD CONSTRAINT assets_valuation_source_check
  CHECK (valuation_source IN ('MANUAL', 'MOVEMENTS', 'ACCOUNT'));

CREATE INDEX IF NOT EXISTS assets_account_id_idx ON public.assets(account_id);

ALTER TABLE public.imports
  ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS movements_import_id_idx ON public.movements(import_id) WHERE import_id IS NOT NULL;