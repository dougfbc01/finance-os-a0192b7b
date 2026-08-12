ALTER TABLE public.classification_rules
  ADD COLUMN IF NOT EXISTS counterparty_pattern text,
  ADD COLUMN IF NOT EXISTS movement_type public.movement_type,
  ADD COLUMN IF NOT EXISTS direction text,
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS card_id uuid REFERENCES public.cards(id) ON DELETE SET NULL;

ALTER TABLE public.classification_rules
  DROP CONSTRAINT IF EXISTS classification_rules_direction_check;

ALTER TABLE public.classification_rules
  ADD CONSTRAINT classification_rules_direction_check
  CHECK (direction IS NULL OR direction IN ('IN','OUT'));