ALTER TABLE public.movements
  ADD COLUMN IF NOT EXISTS is_historical boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quantity numeric,
  ADD COLUMN IF NOT EXISTS unit_price numeric,
  ADD COLUMN IF NOT EXISTS external_ref text;

COMMENT ON COLUMN public.movements.is_historical IS 'Operação anterior ao início do controle: afeta o ativo/patrimônio, nunca o caixa.';
COMMENT ON COLUMN public.movements.quantity IS 'Quantidade negociada do ativo (opcional).';
COMMENT ON COLUMN public.movements.unit_price IS 'Preço unitário da operação (opcional).';
COMMENT ON COLUMN public.movements.external_ref IS 'Referência externa (futura conciliação B3/corretoras).';

CREATE INDEX IF NOT EXISTS movements_asset_historical_idx
  ON public.movements (asset_id, transaction_date)
  WHERE asset_id IS NOT NULL AND deleted_at IS NULL;