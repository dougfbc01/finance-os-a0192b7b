CREATE TABLE public.market_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  ticker text NOT NULL,
  price_date date NOT NULL,
  close_price numeric NOT NULL,
  open_price numeric,
  high_price numeric,
  low_price numeric,
  volume numeric,
  provider text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_price_history TO authenticated;
GRANT ALL ON public.market_price_history TO service_role;

ALTER TABLE public.market_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage market history of their workspaces"
ON public.market_price_history FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));

CREATE UNIQUE INDEX market_price_history_asset_date_uq
  ON public.market_price_history (asset_id, price_date);

CREATE INDEX market_price_history_ws_ticker_date_idx
  ON public.market_price_history (workspace_id, ticker, price_date DESC);