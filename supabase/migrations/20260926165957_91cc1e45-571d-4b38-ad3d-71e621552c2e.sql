WITH source_rows AS (
  SELECT
    m.id,
    b.event,
    CASE
      WHEN NULLIF(BTRIM(b.raw_row->>'Quantidade'), '') IS NULL OR BTRIM(b.raw_row->>'Quantidade') = '-' THEN NULL
      ELSE REPLACE(BTRIM(b.raw_row->>'Quantidade'), ',', '.')::numeric
    END AS raw_quantity,
    CASE
      WHEN NULLIF(BTRIM(b.raw_row->>'Valor da Operação'), '') IS NULL OR BTRIM(b.raw_row->>'Valor da Operação') = '-' THEN 0
      ELSE REPLACE(BTRIM(b.raw_row->>'Valor da Operação'), ',', '.')::numeric
    END AS raw_amount
  FROM public.b3_import_items b
  JOIN public.movements m ON m.id = b.movement_id
  WHERE b.status = 'IMPORTED'
    AND m.is_historical = true
    AND m.deleted_at IS NULL
    AND b.event IN ('TRANSFER_SETTLEMENT', 'UPDATE', 'REVERSE_SPLIT', 'FRACTION', 'FRACTION_AUCTION', 'INCORPORATION')
)
UPDATE public.movements m
SET quantity = s.raw_quantity,
    amount = CASE WHEN s.event = 'FRACTION_AUCTION' THEN s.raw_amount ELSE 0 END,
    updated_at = now()
FROM source_rows s
WHERE m.id = s.id
  AND (
    m.quantity IS DISTINCT FROM s.raw_quantity
    OR m.amount IS DISTINCT FROM CASE WHEN s.event = 'FRACTION_AUCTION' THEN s.raw_amount ELSE 0 END
  );